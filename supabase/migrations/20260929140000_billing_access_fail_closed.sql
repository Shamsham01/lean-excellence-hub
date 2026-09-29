-- BILLING-LIFECYCLE-001: fail-closed operational access when past_due grace
-- has expired without a later webhook, and lifecycle-safe billing.manage
-- authority for Customer Portal on suspended organisations.

create or replace function private.organisation_billing_allows_operational_access(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.organisation_subscriptions subscription
    where subscription.organisation_id = target_organisation_id
      and not private.billing_state_is_operational(
        subscription.billing_state,
        subscription.grace_expires_at
      )
  )
$$;

create or replace function private.effective_organisation_access_status(
  stored_status text,
  target_organisation_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when stored_status = 'active'
      and not private.organisation_billing_allows_operational_access(
        target_organisation_id
      )
    then 'suspended'
    else stored_status
  end
$$;

create or replace function private.current_membership_id(
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
    and organisation.status = 'active'
    and private.organisation_billing_allows_operational_access(organisation.id)
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
$$;

create or replace function private.list_my_eligible_organisations()
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
    private.effective_organisation_access_status(
      organisation.status,
      organisation.id
    ),
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
    and private.effective_organisation_access_status(
      organisation.status,
      organisation.id
    ) in ('provisioning', 'active', 'suspended')
    and identity_control.status = 'active'
    and identity_control.enrolment_status = 'complete'
  order by organisation.name, organisation.id
$$;

create or replace function public.get_current_organisation_billing()
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
    private.effective_organisation_access_status(
      organisation.status,
      organisation.id
    )
  from public.organisations organisation
  left join public.organisation_billing_accounts account
    on account.organisation_id = organisation.id
  left join public.organisation_subscriptions subscription
    on subscription.organisation_id = organisation.id
  where organisation.id = private.current_organisation_id()
    and private.current_lifecycle_membership_id(organisation.id) is not null
$$;

create or replace function private.membership_has_billing_management(
  actor_membership_id uuid,
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status in ('provisioning', 'active', 'suspended')
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
      join public.role_permissions role_permission
        on role_permission.organisation_id = role_version.organisation_id
       and role_permission.role_version_id = role_version.id
       and role_permission.permission_key = 'billing.manage'
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = target_organisation_id
        and actor_membership.status = 'active'
        and grant_row.scope_type = 'organisation'
    ),
    false
  )
$$;

create or replace function private.current_can_manage_billing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.membership_has_billing_management(
      private.current_lifecycle_membership_id(
        private.current_organisation_id()
      ),
      private.current_organisation_id()
    ),
    false
  )
$$;

create or replace function public.current_can_manage_billing()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_can_manage_billing()
$$;

revoke all on function private.organisation_billing_allows_operational_access(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.effective_organisation_access_status(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.membership_has_billing_management(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.current_can_manage_billing()
  from public, anon, authenticated, service_role;
revoke all on function public.current_can_manage_billing()
  from public, anon, authenticated, service_role;
revoke all on function private.current_membership_id(uuid)
  from public, anon, authenticated, service_role;

alter function private.organisation_billing_allows_operational_access(uuid)
  owner to lean_hub_private_owner;
alter function private.effective_organisation_access_status(text, uuid)
  owner to lean_hub_private_owner;
alter function private.membership_has_billing_management(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.current_can_manage_billing()
  owner to lean_hub_private_owner;
alter function private.current_membership_id(uuid)
  owner to lean_hub_private_owner;

grant execute on function public.current_can_manage_billing()
  to authenticated;
grant execute on function private.current_can_manage_billing()
  to authenticated;
grant execute on function private.organisation_billing_allows_operational_access(uuid)
  to authenticated;
grant execute on function private.effective_organisation_access_status(text, uuid)
  to authenticated;
grant execute on function private.membership_has_billing_management(uuid, uuid)
  to authenticated;
grant execute on function private.current_membership_id(uuid)
  to authenticated;
