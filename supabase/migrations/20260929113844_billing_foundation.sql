-- BILLING-CORE-001: tenant-safe billing schema, plan-independent site capacity,
-- webhook idempotency, and a service-role snapshot apply path.
-- Organisation lifecycle activation/suspension is applied in BILLING-LIFECYCLE-001.

insert into public.permission_definitions (permission_key, description, is_protected)
values
  (
    'billing.manage',
    'View subscription state and manage billing self-service for the organisation.',
    false
  )
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array['billing.manage']::text[]
);

create table public.billing_runtime_policy (
  id boolean primary key default true,
  grace_period_days integer not null default 7,
  retention_days integer not null default 90,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint billing_runtime_policy_singleton_check check (id),
  constraint billing_runtime_policy_grace_check
    check (grace_period_days between 1 and 90),
  constraint billing_runtime_policy_retention_check
    check (retention_days between 1 and 3650)
);

create table public.organisation_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  provider text not null default 'stripe',
  provider_customer_id text,
  open_checkout_session_id text,
  open_checkout_expires_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint organisation_billing_accounts_organisation_id_key
    unique (organisation_id),
  constraint organisation_billing_accounts_organisation_id_id_key
    unique (organisation_id, id),
  constraint organisation_billing_accounts_provider_check
    check (provider in ('stripe', 'fake')),
  constraint organisation_billing_accounts_customer_check
    check (
      provider_customer_id is null
      or (
        provider_customer_id = btrim(provider_customer_id)
        and char_length(provider_customer_id) between 1 and 255
      )
    ),
  constraint organisation_billing_accounts_checkout_check
    check (
      (
        open_checkout_session_id is null
        and open_checkout_expires_at is null
      )
      or (
        open_checkout_session_id = btrim(open_checkout_session_id)
        and char_length(open_checkout_session_id) between 1 and 255
      )
    )
);

create unique index organisation_billing_accounts_provider_customer_uidx
  on public.organisation_billing_accounts (provider, provider_customer_id)
  where provider_customer_id is not null;

create table public.organisation_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  billing_account_id uuid not null,
  plan_code text not null,
  billing_interval text not null,
  site_quantity integer not null,
  provider text not null default 'stripe',
  provider_subscription_id text,
  provider_price_id text,
  provider_status text,
  billing_state text not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_expires_at timestamptz,
  ended_at timestamptz,
  retention_eligible_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint organisation_subscriptions_organisation_id_key
    unique (organisation_id),
  constraint organisation_subscriptions_organisation_id_id_key
    unique (organisation_id, id),
  constraint organisation_subscriptions_account_fkey
    foreign key (organisation_id, billing_account_id)
    references public.organisation_billing_accounts(organisation_id, id)
    on delete restrict,
  constraint organisation_subscriptions_plan_check
    check (plan_code in ('essentials', 'professional', 'enterprise', 'founder')),
  constraint organisation_subscriptions_interval_check
    check (billing_interval in ('monthly', 'annual')),
  constraint organisation_subscriptions_quantity_check
    check (site_quantity >= 1),
  constraint organisation_subscriptions_provider_check
    check (provider in ('stripe', 'fake')),
  constraint organisation_subscriptions_state_check
    check (
      billing_state in (
        'pending',
        'trialing',
        'active',
        'past_due',
        'cancel_at_period_end',
        'suspended',
        'ended'
      )
    ),
  constraint organisation_subscriptions_price_check
    check (
      provider_price_id is null
      or (
        provider_price_id = btrim(provider_price_id)
        and char_length(provider_price_id) between 1 and 255
      )
    ),
  constraint organisation_subscriptions_status_check
    check (
      provider_status is null
      or (
        provider_status = btrim(provider_status)
        and char_length(provider_status) between 1 and 80
      )
    ),
  constraint organisation_subscriptions_period_check
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end >= current_period_start
    ),
  constraint organisation_subscriptions_ended_check
    check (
      (
        billing_state <> 'ended'
        and ended_at is null
      )
      or (
        billing_state = 'ended'
        and ended_at is not null
      )
    )
);

create unique index organisation_subscriptions_provider_subscription_uidx
  on public.organisation_subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  organisation_id uuid references public.organisations(id) on delete restrict,
  processing_state text not null default 'processing',
  received_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  last_error text,
  diagnostic jsonb not null default '{}'::jsonb,
  constraint billing_webhook_events_provider_event_key
    unique (provider, provider_event_id),
  constraint billing_webhook_events_provider_check
    check (provider in ('stripe', 'fake')),
  constraint billing_webhook_events_event_id_check
    check (
      provider_event_id = btrim(provider_event_id)
      and char_length(provider_event_id) between 1 and 255
    ),
  constraint billing_webhook_events_type_check
    check (
      event_type = btrim(event_type)
      and char_length(event_type) between 1 and 120
    ),
  constraint billing_webhook_events_state_check
    check (processing_state in ('processing', 'processed', 'ignored', 'failed')),
  constraint billing_webhook_events_error_check
    check (
      last_error is null
      or (
        last_error = btrim(last_error)
        and char_length(last_error) between 1 and 1000
      )
    ),
  constraint billing_webhook_events_diagnostic_check
    check (pg_catalog.jsonb_typeof(diagnostic) = 'object')
);

create index billing_webhook_events_org_received_idx
  on public.billing_webhook_events (organisation_id, received_at desc);

create trigger billing_runtime_policy_touch_updated_at
before update on public.billing_runtime_policy
for each row execute function private.touch_updated_at();

create trigger organisation_billing_accounts_touch_updated_at
before update on public.organisation_billing_accounts
for each row execute function private.touch_updated_at();

create trigger organisation_subscriptions_touch_updated_at
before update on public.organisation_subscriptions
for each row execute function private.touch_updated_at();

create trigger organisation_billing_accounts_immutable_tenant
before update on public.organisation_billing_accounts
for each row execute function private.prevent_organisation_id_change();

create trigger organisation_subscriptions_immutable_tenant
before update on public.organisation_subscriptions
for each row execute function private.prevent_organisation_id_change();

alter table public.billing_runtime_policy enable row level security;
alter table public.billing_runtime_policy force row level security;
alter table public.organisation_billing_accounts enable row level security;
alter table public.organisation_billing_accounts force row level security;
alter table public.organisation_subscriptions enable row level security;
alter table public.organisation_subscriptions force row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_webhook_events force row level security;

revoke all on public.billing_runtime_policy
  from public, anon, authenticated, service_role;
revoke all on public.organisation_billing_accounts
  from public, anon, authenticated, service_role;
revoke all on public.organisation_subscriptions
  from public, anon, authenticated, service_role;
revoke all on public.billing_webhook_events
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.billing_runtime_policy
  to lean_hub_private_owner;
grant select, insert, update, delete on public.organisation_billing_accounts
  to lean_hub_private_owner;
grant select, insert, update, delete on public.organisation_subscriptions
  to lean_hub_private_owner;
grant select, insert, update, delete on public.billing_webhook_events
  to lean_hub_private_owner;

create policy private_owner_all_billing_runtime_policy
on public.billing_runtime_policy
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_organisation_billing_accounts
on public.organisation_billing_accounts
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_organisation_subscriptions
on public.organisation_subscriptions
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_billing_webhook_events
on public.billing_webhook_events
for all
to lean_hub_private_owner
using (true)
with check (true);

grant select on public.organisation_billing_accounts to authenticated;
grant select on public.organisation_subscriptions to authenticated;

create policy organisation_billing_accounts_select_current
on public.organisation_billing_accounts
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.current_membership_id(organisation_id) is not null
);

create policy organisation_subscriptions_select_current
on public.organisation_subscriptions
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and private.current_membership_id(organisation_id) is not null
);

insert into public.billing_runtime_policy (id, grace_period_days, retention_days)
values (true, 7, 90)
on conflict (id) do nothing;

create or replace function private.billing_grace_period()
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select make_interval(
    days => coalesce(
      (
        select policy.grace_period_days
        from public.billing_runtime_policy policy
        where policy.id
      ),
      7
    )
  )
$$;

create or replace function private.billing_retention_period()
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select make_interval(
    days => coalesce(
      (
        select policy.retention_days
        from public.billing_runtime_policy policy
        where policy.id
      ),
      90
    )
  )
$$;

create or replace function private.count_active_billable_sites(
  target_organisation_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.organisation_units unit
  where unit.organisation_id = target_organisation_id
    and unit.status = 'active'
    and private.normalise_organisation_unit_semantic_scope(unit.unit_type) = 'site'
$$;

create or replace function private.organisation_paid_site_limit(
  target_organisation_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select subscription.site_quantity
  from public.organisation_subscriptions subscription
  where subscription.organisation_id = target_organisation_id
    and subscription.billing_state in (
      'pending',
      'trialing',
      'active',
      'past_due',
      'cancel_at_period_end'
    )
$$;

create or replace function private.assert_organisation_can_add_site(
  target_organisation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  paid_limit integer;
  current_count integer;
begin
  paid_limit := private.organisation_paid_site_limit(target_organisation_id);
  if paid_limit is null then
    return;
  end if;

  current_count := private.count_active_billable_sites(target_organisation_id);
  if current_count >= paid_limit then
    raise exception 'site quantity is already at the paid subscription limit'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.create_organisation_unit(
  target_organisation_id uuid,
  target_parent_unit_id uuid,
  unit_code text,
  unit_name text,
  unit_type text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_unit_id uuid;
begin
  if private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_parent_unit_id
    ) then
    raise exception 'unit creation is not authorised'
      using errcode = '42501';
  end if;

  if private.organisation_requires_site_boundary(target_organisation_id)
    and private.normalise_organisation_unit_semantic_scope(unit_type) = 'site'
    and target_parent_unit_id is not null
    and private.resolve_site_unit_id(
      target_organisation_id,
      target_parent_unit_id
    ) is not null then
    raise exception 'nested site units are not permitted'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  if private.normalise_organisation_unit_semantic_scope(unit_type) = 'site' then
    perform private.assert_organisation_can_add_site(target_organisation_id);
  end if;

  if target_parent_unit_id is not null and not exists (
    select 1
    from public.organisation_units parent_unit
    where parent_unit.organisation_id = target_organisation_id
      and parent_unit.id = target_parent_unit_id
      and parent_unit.status = 'active'
    for update
  ) then
    raise exception 'parent unit is not active in organisation'
      using errcode = '23514';
  end if;

  if not private.has_scoped_permission(
    target_organisation_id,
    'hierarchy.manage',
    null,
    target_parent_unit_id
  ) then
    raise exception 'unit creation authority changed'
      using errcode = '42501';
  end if;

  insert into public.organisation_units (
    organisation_id,
    parent_unit_id,
    code,
    name,
    unit_type
  )
  values (
    target_organisation_id,
    target_parent_unit_id,
    unit_code,
    unit_name,
    unit_type
  )
  returning id into new_unit_id;

  insert into public.organisation_unit_closure (
    organisation_id,
    ancestor_unit_id,
    descendant_unit_id,
    depth
  )
  values (
    target_organisation_id,
    new_unit_id,
    new_unit_id,
    0
  );

  if target_parent_unit_id is not null then
    insert into public.organisation_unit_closure (
      organisation_id,
      ancestor_unit_id,
      descendant_unit_id,
      depth
    )
    select
      target_organisation_id,
      ancestor.ancestor_unit_id,
      new_unit_id,
      ancestor.depth + 1
    from public.organisation_unit_closure ancestor
    where ancestor.organisation_id = target_organisation_id
      and ancestor.descendant_unit_id = target_parent_unit_id;
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    'hierarchy.unit_created',
    'unit',
    new_unit_id,
    'succeeded',
    '{}'::jsonb
  );

  return new_unit_id;
end;
$$;

create or replace function private.ensure_organisation_billing_account(
  target_organisation_id uuid,
  target_provider text,
  target_customer_id text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_id uuid;
  existing_org uuid;
begin
  if target_organisation_id is null
    or target_provider not in ('stripe', 'fake') then
    raise exception 'billing account request is invalid'
      using errcode = '22023';
  end if;

  target_customer_id := nullif(btrim(target_customer_id), '');

  if target_customer_id is not null then
    select account.organisation_id
    into existing_org
    from public.organisation_billing_accounts account
    where account.provider = target_provider
      and account.provider_customer_id = target_customer_id;

    if existing_org is not null
      and existing_org <> target_organisation_id then
      raise exception 'billing customer is already bound to another organisation'
        using errcode = '42501';
    end if;
  end if;

  insert into public.organisation_billing_accounts (
    organisation_id,
    provider,
    provider_customer_id
  )
  values (
    target_organisation_id,
    target_provider,
    target_customer_id
  )
  on conflict (organisation_id) do update
    set provider = excluded.provider,
        provider_customer_id = coalesce(
          public.organisation_billing_accounts.provider_customer_id,
          excluded.provider_customer_id
        )
  returning id into account_id;

  if target_customer_id is not null then
    update public.organisation_billing_accounts account
    set provider_customer_id = target_customer_id
    where account.id = account_id
      and account.organisation_id = target_organisation_id
      and account.provider_customer_id is null;
  end if;

  return account_id;
end;
$$;

create or replace function private.claim_billing_webhook_event(
  target_provider text,
  target_event_id text,
  target_event_type text,
  target_organisation_id uuid default null,
  target_diagnostic jsonb default '{}'::jsonb
)
returns table (
  event_id uuid,
  should_process boolean,
  processing_state text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing public.billing_webhook_events%rowtype;
  inserted_id uuid;
begin
  if target_provider not in ('stripe', 'fake')
    or target_event_id is null
    or btrim(target_event_id) = ''
    or target_event_type is null
    or btrim(target_event_type) = '' then
    raise exception 'webhook claim is invalid'
      using errcode = '22023';
  end if;

  insert into public.billing_webhook_events (
    provider,
    provider_event_id,
    event_type,
    organisation_id,
    processing_state,
    diagnostic
  )
  values (
    target_provider,
    btrim(target_event_id),
    btrim(target_event_type),
    target_organisation_id,
    'processing',
    coalesce(target_diagnostic, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    event_id := inserted_id;
    should_process := true;
    processing_state := 'processing';
    return next;
    return;
  end if;

  select *
  into existing
  from public.billing_webhook_events claimed
  where claimed.provider = target_provider
    and claimed.provider_event_id = btrim(target_event_id);

  if existing.processing_state = 'failed' then
    update public.billing_webhook_events claimed
    set processing_state = 'processing',
        last_error = null,
        organisation_id = coalesce(claimed.organisation_id, target_organisation_id),
        diagnostic = coalesce(target_diagnostic, claimed.diagnostic)
    where claimed.id = existing.id;

    event_id := existing.id;
    should_process := true;
    processing_state := 'processing';
    return next;
    return;
  end if;

  event_id := existing.id;
  should_process := false;
  processing_state := existing.processing_state;
  return next;
end;
$$;

create or replace function private.finish_billing_webhook_event(
  target_event_id uuid,
  target_state text,
  target_organisation_id uuid default null,
  target_error text default null,
  target_diagnostic jsonb default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if target_state not in ('processed', 'ignored', 'failed') then
    raise exception 'webhook finish state is invalid'
      using errcode = '22023';
  end if;

  update public.billing_webhook_events event_row
  set processing_state = target_state,
      processed_at = case
        when target_state in ('processed', 'ignored') then statement_timestamp()
        else event_row.processed_at
      end,
      organisation_id = coalesce(target_organisation_id, event_row.organisation_id),
      last_error = case
        when target_state = 'failed' then btrim(target_error)
        else null
      end,
      diagnostic = coalesce(target_diagnostic, event_row.diagnostic)
  where event_row.id = target_event_id
    and event_row.processing_state = 'processing';

  return found;
end;
$$;

create or replace function private.apply_organisation_subscription_snapshot(
  target_organisation_id uuid,
  target_provider text,
  target_customer_id text,
  target_subscription_id text,
  target_plan_code text,
  target_billing_interval text,
  target_site_quantity integer,
  target_price_id text,
  target_provider_status text,
  target_billing_state text,
  target_current_period_start timestamptz,
  target_current_period_end timestamptz,
  target_cancel_at_period_end boolean,
  target_event_at timestamptz,
  target_grace_expires_at timestamptz default null,
  clear_grace boolean default false
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_id uuid;
  mapped_customer_org uuid;
  mapped_subscription_org uuid;
  current_row public.organisation_subscriptions%rowtype;
  next_ended_at timestamptz;
  next_retention timestamptz;
  next_grace timestamptz;
begin
  target_customer_id := nullif(btrim(target_customer_id), '');
  target_subscription_id := nullif(btrim(target_subscription_id), '');
  target_price_id := nullif(btrim(target_price_id), '');
  target_provider_status := nullif(btrim(target_provider_status), '');

  if target_organisation_id is null
    or target_provider not in ('stripe', 'fake')
    or target_plan_code not in ('essentials', 'professional', 'enterprise', 'founder')
    or target_billing_interval not in ('monthly', 'annual')
    or target_site_quantity is null
    or target_site_quantity < 1
    or target_billing_state not in (
      'pending',
      'trialing',
      'active',
      'past_due',
      'cancel_at_period_end',
      'suspended',
      'ended'
    ) then
    raise exception 'subscription snapshot is invalid'
      using errcode = '22023';
  end if;

  if target_customer_id is not null then
    select account.organisation_id
    into mapped_customer_org
    from public.organisation_billing_accounts account
    where account.provider = target_provider
      and account.provider_customer_id = target_customer_id;

    if mapped_customer_org is not null
      and mapped_customer_org <> target_organisation_id then
      raise exception 'billing customer does not belong to this organisation'
        using errcode = '42501';
    end if;
  end if;

  if target_subscription_id is not null then
    select subscription.organisation_id
    into mapped_subscription_org
    from public.organisation_subscriptions subscription
    where subscription.provider = target_provider
      and subscription.provider_subscription_id = target_subscription_id;

    if mapped_subscription_org is not null
      and mapped_subscription_org <> target_organisation_id then
      raise exception 'billing subscription does not belong to this organisation'
        using errcode = '42501';
    end if;
  end if;

  account_id := private.ensure_organisation_billing_account(
    target_organisation_id,
    target_provider,
    target_customer_id
  );

  select *
  into current_row
  from public.organisation_subscriptions subscription
  where subscription.organisation_id = target_organisation_id
  for update;

  if current_row.id is not null
    and current_row.last_provider_event_at is not null
    and target_event_at is not null
    and target_event_at < current_row.last_provider_event_at then
    return 'ignored_out_of_order';
  end if;

  if target_billing_state = 'ended' then
    next_ended_at := coalesce(current_row.ended_at, statement_timestamp());
    next_retention := coalesce(
      current_row.retention_eligible_at,
      statement_timestamp() + private.billing_retention_period()
    );
  else
    next_ended_at := null;
    next_retention := null;
  end if;

  if clear_grace then
    next_grace := null;
  elsif target_grace_expires_at is not null then
    next_grace := target_grace_expires_at;
  elsif target_billing_state = 'past_due' then
    next_grace := coalesce(
      current_row.grace_expires_at,
      statement_timestamp() + private.billing_grace_period()
    );
  else
    next_grace := current_row.grace_expires_at;
  end if;

  if current_row.id is null then
    insert into public.organisation_subscriptions (
      organisation_id,
      billing_account_id,
      plan_code,
      billing_interval,
      site_quantity,
      provider,
      provider_subscription_id,
      provider_price_id,
      provider_status,
      billing_state,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      grace_expires_at,
      ended_at,
      retention_eligible_at,
      last_provider_event_at
    )
    values (
      target_organisation_id,
      account_id,
      target_plan_code,
      target_billing_interval,
      target_site_quantity,
      target_provider,
      target_subscription_id,
      target_price_id,
      target_provider_status,
      target_billing_state,
      target_current_period_start,
      target_current_period_end,
      coalesce(target_cancel_at_period_end, false),
      next_grace,
      next_ended_at,
      next_retention,
      target_event_at
    );
  else
    update public.organisation_subscriptions subscription
    set billing_account_id = account_id,
        plan_code = target_plan_code,
        billing_interval = target_billing_interval,
        site_quantity = target_site_quantity,
        provider = target_provider,
        provider_subscription_id = coalesce(
          target_subscription_id,
          subscription.provider_subscription_id
        ),
        provider_price_id = coalesce(target_price_id, subscription.provider_price_id),
        provider_status = coalesce(target_provider_status, subscription.provider_status),
        billing_state = target_billing_state,
        current_period_start = coalesce(
          target_current_period_start,
          subscription.current_period_start
        ),
        current_period_end = coalesce(
          target_current_period_end,
          subscription.current_period_end
        ),
        cancel_at_period_end = coalesce(
          target_cancel_at_period_end,
          subscription.cancel_at_period_end
        ),
        grace_expires_at = next_grace,
        ended_at = next_ended_at,
        retention_eligible_at = next_retention,
        last_provider_event_at = coalesce(
          target_event_at,
          subscription.last_provider_event_at
        )
    where subscription.id = current_row.id
      and subscription.organisation_id = target_organisation_id;
  end if;

  return 'applied';
end;
$$;

create or replace function private.set_organisation_open_checkout_session(
  target_organisation_id uuid,
  target_session_id text,
  target_expires_at timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.organisation_billing_accounts account
  set open_checkout_session_id = nullif(btrim(target_session_id), ''),
      open_checkout_expires_at = case
        when nullif(btrim(target_session_id), '') is null then null
        else target_expires_at
      end
  where account.organisation_id = target_organisation_id;

  return found;
end;
$$;

create or replace function public.ensure_organisation_billing_account(
  target_organisation_id uuid,
  target_provider text,
  target_customer_id text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.ensure_organisation_billing_account(
    target_organisation_id,
    target_provider,
    target_customer_id
  )
$$;

create or replace function public.claim_billing_webhook_event(
  target_provider text,
  target_event_id text,
  target_event_type text,
  target_organisation_id uuid default null,
  target_diagnostic jsonb default '{}'::jsonb
)
returns table (
  event_id uuid,
  should_process boolean,
  processing_state text
)
language sql
volatile
security definer
set search_path = ''
as $$
  select *
  from private.claim_billing_webhook_event(
    target_provider,
    target_event_id,
    target_event_type,
    target_organisation_id,
    target_diagnostic
  )
$$;

create or replace function public.finish_billing_webhook_event(
  target_event_id uuid,
  target_state text,
  target_organisation_id uuid default null,
  target_error text default null,
  target_diagnostic jsonb default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.finish_billing_webhook_event(
    target_event_id,
    target_state,
    target_organisation_id,
    target_error,
    target_diagnostic
  )
$$;

create or replace function public.apply_organisation_subscription_snapshot(
  target_organisation_id uuid,
  target_provider text,
  target_customer_id text,
  target_subscription_id text,
  target_plan_code text,
  target_billing_interval text,
  target_site_quantity integer,
  target_price_id text,
  target_provider_status text,
  target_billing_state text,
  target_current_period_start timestamptz,
  target_current_period_end timestamptz,
  target_cancel_at_period_end boolean,
  target_event_at timestamptz,
  target_grace_expires_at timestamptz default null,
  clear_grace boolean default false
)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select private.apply_organisation_subscription_snapshot(
    target_organisation_id,
    target_provider,
    target_customer_id,
    target_subscription_id,
    target_plan_code,
    target_billing_interval,
    target_site_quantity,
    target_price_id,
    target_provider_status,
    target_billing_state,
    target_current_period_start,
    target_current_period_end,
    target_cancel_at_period_end,
    target_event_at,
    target_grace_expires_at,
    clear_grace
  )
$$;

create or replace function public.set_organisation_open_checkout_session(
  target_organisation_id uuid,
  target_session_id text,
  target_expires_at timestamptz
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_organisation_open_checkout_session(
    target_organisation_id,
    target_session_id,
    target_expires_at
  )
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
  active_site_count integer
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
    private.count_active_billable_sites(organisation.id)
  from public.organisations organisation
  left join public.organisation_billing_accounts account
    on account.organisation_id = organisation.id
  left join public.organisation_subscriptions subscription
    on subscription.organisation_id = organisation.id
  where organisation.id = private.current_organisation_id()
    and private.current_membership_id(organisation.id) is not null
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.billing_grace_period()'::regprocedure,
    'private.billing_retention_period()'::regprocedure,
    'private.count_active_billable_sites(uuid)'::regprocedure,
    'private.organisation_paid_site_limit(uuid)'::regprocedure,
    'private.assert_organisation_can_add_site(uuid)'::regprocedure,
    'private.ensure_organisation_billing_account(uuid,text,text)'::regprocedure,
    'private.claim_billing_webhook_event(text,text,text,uuid,jsonb)'::regprocedure,
    'private.finish_billing_webhook_event(uuid,text,uuid,text,jsonb)'::regprocedure,
    'private.apply_organisation_subscription_snapshot(uuid,text,text,text,text,text,integer,text,text,text,timestamptz,timestamptz,boolean,timestamptz,timestamptz,boolean)'::regprocedure,
    'private.set_organisation_open_checkout_session(uuid,text,timestamptz)'::regprocedure,
    'private.create_organisation_unit(uuid,uuid,text,text,text)'::regprocedure
  ]
  loop
    execute format('alter function %s owner to lean_hub_private_owner', function_signature);
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      function_signature
    );
  end loop;
end
$$;

revoke all on function public.ensure_organisation_billing_account(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_billing_webhook_event(text, text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_billing_webhook_event(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_organisation_subscription_snapshot(
  uuid, text, text, text, text, text, integer, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.set_organisation_open_checkout_session(
  uuid, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.get_current_organisation_billing()
  from public, anon, authenticated, service_role;

grant execute on function private.create_organisation_unit(
  uuid, uuid, text, text, text
) to authenticated;
grant execute on function public.get_current_organisation_billing()
  to authenticated;

grant execute on function public.ensure_organisation_billing_account(uuid, text, text)
  to service_role;
grant execute on function public.claim_billing_webhook_event(text, text, text, uuid, jsonb)
  to service_role;
grant execute on function public.finish_billing_webhook_event(uuid, text, uuid, text, jsonb)
  to service_role;
grant execute on function public.apply_organisation_subscription_snapshot(
  uuid, text, text, text, text, text, integer, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz, boolean
) to service_role;
grant execute on function public.set_organisation_open_checkout_session(
  uuid, text, timestamptz
) to service_role;
