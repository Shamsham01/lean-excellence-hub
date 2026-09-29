-- BILLING-LIFECYCLE-001: map authoritative billing snapshots onto organisation
-- lifecycle and allow session selection of provisioning/suspended tenants.

create or replace function private.current_lifecycle_membership_id(
  target_organisation_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.id
  from private.session_organisation_contexts context
  join public.organisation_memberships membership
    on membership.organisation_id = context.organisation_id
   and membership.id = context.membership_id
   and membership.user_id = context.user_id
  join public.organisations organisation
    on organisation.id = membership.organisation_id
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
  where context.session_id = private.current_session_id()
    and context.user_id = private.auth_uid()
    and context.organisation_id = target_organisation_id
    and membership.status = 'active'
    and organisation.status in ('provisioning', 'active', 'suspended')
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
$$;

create or replace function private.billing_state_is_operational(
  target_billing_state text,
  target_grace_expires_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_billing_state in ('trialing', 'active', 'cancel_at_period_end')
    or (
      target_billing_state = 'past_due'
      and (
        target_grace_expires_at is null
        or target_grace_expires_at > statement_timestamp()
      )
    )
$$;

create or replace function private.sync_organisation_lifecycle_from_billing(
  target_organisation_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  organisation_row public.organisations%rowtype;
  subscription_row public.organisation_subscriptions%rowtype;
  operational boolean := false;
  result_state text := 'unchanged';
begin
  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  select *
  into organisation_row
  from public.organisations organisation
  where organisation.id = target_organisation_id
  for update;

  if organisation_row.id is null or organisation_row.status = 'closed' then
    return 'unchanged';
  end if;

  select *
  into subscription_row
  from public.organisation_subscriptions subscription
  where subscription.organisation_id = target_organisation_id
  for update;

  if subscription_row.id is not null then
    operational := private.billing_state_is_operational(
      subscription_row.billing_state,
      subscription_row.grace_expires_at
    );
  end if;

  if operational then
    if organisation_row.status = 'provisioning' then
      update public.organisations
      set status = 'active',
          status_reason = null,
          status_changed_at = statement_timestamp(),
          version = version + 1
      where id = target_organisation_id
        and status = 'provisioning';
      perform private.append_security_audit(
        target_organisation_id,
        'organisation.activated',
        'organisation',
        target_organisation_id,
        'succeeded',
        jsonb_build_object('plan_code', subscription_row.plan_code)
      );
      result_state := 'activated';
    elsif organisation_row.status = 'suspended' then
      update public.organisations
      set status = 'active',
          status_reason = null,
          status_changed_at = statement_timestamp(),
          version = version + 1
      where id = target_organisation_id
        and status = 'suspended';
      perform private.append_security_audit(
        target_organisation_id,
        'organisation.reactivated',
        'organisation',
        target_organisation_id,
        'succeeded',
        jsonb_build_object('plan_code', subscription_row.plan_code)
      );
      result_state := 'reactivated';
    end if;
  elsif subscription_row.id is not null
    and subscription_row.billing_state in ('ended', 'suspended', 'past_due')
    and organisation_row.status = 'active' then
    if subscription_row.billing_state = 'past_due'
      and (
        subscription_row.grace_expires_at is null
        or subscription_row.grace_expires_at > statement_timestamp()
      ) then
      return 'unchanged';
    end if;

    update public.organisations
    set status = 'suspended',
        status_reason = case
          when subscription_row.billing_state = 'ended'
            then 'Subscription ended at period end.'
          else 'Payment was not recovered during the grace period.'
        end,
        status_changed_at = statement_timestamp(),
        version = version + 1
    where id = target_organisation_id
      and status = 'active';
    perform private.append_security_audit(
      target_organisation_id,
      'organisation.suspended',
      'organisation',
      target_organisation_id,
      'succeeded',
      jsonb_build_object('billing_state', subscription_row.billing_state)
    );
    result_state := 'suspended';
  end if;

  return result_state;
end;
$$;

create or replace function private.record_billing_state_audits(
  target_organisation_id uuid,
  previous_state text,
  next_state text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if previous_state is not distinct from next_state then
    return;
  end if;

  if next_state = 'cancel_at_period_end' then
    perform private.append_security_audit(
      target_organisation_id,
      'organisation.cancellation_scheduled',
      'organisation',
      target_organisation_id,
      'succeeded',
      '{}'::jsonb
    );
  elsif previous_state = 'cancel_at_period_end'
    and next_state in ('active', 'trialing') then
    perform private.append_security_audit(
      target_organisation_id,
      'organisation.cancellation_reversed',
      'organisation',
      target_organisation_id,
      'succeeded',
      '{}'::jsonb
    );
  elsif next_state = 'past_due' then
    perform private.append_security_audit(
      target_organisation_id,
      'organisation.payment_past_due',
      'organisation',
      target_organisation_id,
      'succeeded',
      '{}'::jsonb
    );
  end if;
end;
$$;

create or replace function private.organisation_subscriptions_lifecycle_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_billing_state_audits(
    new.organisation_id,
    case when tg_op = 'UPDATE' then old.billing_state else null end,
    new.billing_state
  );
  perform private.sync_organisation_lifecycle_from_billing(new.organisation_id);
  return new;
end;
$$;

drop trigger if exists organisation_subscriptions_lifecycle_trigger
  on public.organisation_subscriptions;

create trigger organisation_subscriptions_lifecycle_trigger
after insert or update of billing_state, grace_expires_at, ended_at
on public.organisation_subscriptions
for each row
execute function private.organisation_subscriptions_lifecycle_trigger();

drop function if exists public.list_my_eligible_organisations();
drop function if exists private.list_my_eligible_organisations();

create function private.list_my_eligible_organisations()
returns table (
  organisation_id uuid,
  membership_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_status text,
  selected boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organisation.id,
    membership.id,
    organisation.code,
    organisation.name,
    organisation.status,
    context.organisation_id is not null
  from public.organisation_memberships membership
  join public.organisations organisation
    on organisation.id = membership.organisation_id
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
  left join private.session_organisation_contexts context
    on context.session_id = private.current_session_id()
   and context.user_id = membership.user_id
   and context.organisation_id = membership.organisation_id
   and context.membership_id = membership.id
  where private.current_session_id() is not null
    and membership.user_id = private.auth_uid()
    and membership.status = 'active'
    and organisation.status in ('provisioning', 'active', 'suspended')
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
  order by organisation.name, organisation.id
$$;

create function public.list_my_eligible_organisations()
returns table (
  organisation_id uuid,
  membership_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_status text,
  selected boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.list_my_eligible_organisations()
$$;

create or replace function private.switch_organisation(
  target_organisation_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  actor_session_id uuid := private.current_session_id();
  target_membership_id uuid;
begin
  if actor_user_id is null or actor_session_id is null then
    return false;
  end if;

  select membership.id
  into target_membership_id
  from public.organisation_memberships membership
  join public.organisations organisation
    on organisation.id = membership.organisation_id
  join private.identity_controls identity_control
    on identity_control.user_id = membership.user_id
  where membership.organisation_id = target_organisation_id
    and membership.user_id = actor_user_id
    and membership.status = 'active'
    and organisation.status in ('provisioning', 'active', 'suspended')
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
  for update of membership;

  if target_membership_id is null then
    return false;
  end if;

  insert into private.session_organisation_contexts (
    session_id,
    user_id,
    organisation_id,
    membership_id
  )
  values (
    actor_session_id,
    actor_user_id,
    target_organisation_id,
    target_membership_id
  )
  on conflict (session_id) do update
    set user_id = excluded.user_id,
        organisation_id = excluded.organisation_id,
        membership_id = excluded.membership_id,
        selected_at = statement_timestamp();

  perform private.append_security_audit(
    target_organisation_id,
    'session.organisation_switched',
    'session',
    actor_session_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

drop function if exists public.get_current_organisation_billing();

create function public.get_current_organisation_billing()
returns table (
  organisation_id uuid,
  provider text,
  provider_customer_id text,
  plan_code text,
  billing_interval text,
  site_quantity integer,
  billing_state text,
  provider_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  grace_expires_at timestamptz,
  ended_at timestamptz,
  retention_eligible_at timestamptz,
  paid_site_limit integer,
  active_site_count integer,
  organisation_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    organisation.id,
    account.provider,
    account.provider_customer_id,
    subscription.plan_code,
    subscription.billing_interval,
    subscription.site_quantity,
    subscription.billing_state,
    subscription.provider_status,
    subscription.current_period_start,
    subscription.current_period_end,
    subscription.cancel_at_period_end,
    subscription.grace_expires_at,
    subscription.ended_at,
    subscription.retention_eligible_at,
    private.organisation_paid_site_limit(organisation.id),
    private.count_active_billable_sites(organisation.id),
    organisation.status
  from public.organisations organisation
  left join public.organisation_billing_accounts account
    on account.organisation_id = organisation.id
  left join public.organisation_subscriptions subscription
    on subscription.organisation_id = organisation.id
  where organisation.id = private.current_organisation_id()
    and private.current_lifecycle_membership_id(organisation.id) is not null
$$;

revoke all on function private.current_lifecycle_membership_id(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.billing_state_is_operational(text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.sync_organisation_lifecycle_from_billing(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.record_billing_state_audits(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.organisation_subscriptions_lifecycle_trigger()
  from public, anon, authenticated, service_role;
revoke all on function private.list_my_eligible_organisations()
  from public, anon, authenticated, service_role;
revoke all on function public.list_my_eligible_organisations()
  from public, anon, authenticated, service_role;
revoke all on function public.get_current_organisation_billing()
  from public, anon, authenticated, service_role;

alter function private.current_lifecycle_membership_id(uuid)
  owner to lean_hub_private_owner;
alter function private.billing_state_is_operational(text, timestamptz)
  owner to lean_hub_private_owner;
alter function private.sync_organisation_lifecycle_from_billing(uuid)
  owner to lean_hub_private_owner;
alter function private.record_billing_state_audits(uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.organisation_subscriptions_lifecycle_trigger()
  owner to lean_hub_private_owner;
alter function private.list_my_eligible_organisations()
  owner to lean_hub_private_owner;
alter function private.switch_organisation(uuid)
  owner to lean_hub_private_owner;

grant execute on function public.list_my_eligible_organisations()
  to authenticated;
grant execute on function public.switch_organisation(uuid)
  to authenticated;
grant execute on function public.get_current_organisation_billing()
  to authenticated;
grant execute on function private.current_lifecycle_membership_id(uuid)
  to authenticated;
grant execute on function private.switch_organisation(uuid)
  to authenticated;
grant execute on function private.list_my_eligible_organisations()
  to authenticated;
