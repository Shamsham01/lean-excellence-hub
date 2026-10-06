-- MULTISITE-EXPAND-01B follow-up: monotonic site-quantity increase claims.
-- Concurrent mixed targets (2 vs 3) must not let a stale provider update
-- reduce quantity. highest_requested_site_quantity is an increase-only
-- high-water mark, not LEH billing truth. Webhook snapshots remain
-- authoritative for site_quantity.
--
-- Same-second Stripe events share timestamptz granularity. This migration
-- does not change out-of-order detection from `<` to `<=` (that would drop a
-- legitimate later event in the same second). Equal-timestamp applies keep
-- the greater site_quantity. Subscription-update webhooks should also map
-- to current provider truth in application code.
--
-- Do not apply this migration to hosted Supabase from this change.

alter table public.organisation_subscriptions
  add column if not exists highest_requested_site_quantity integer;

update public.organisation_subscriptions
set highest_requested_site_quantity = site_quantity
where highest_requested_site_quantity is null;

alter table public.organisation_subscriptions
  alter column highest_requested_site_quantity set default 1,
  alter column highest_requested_site_quantity set not null;

alter table public.organisation_subscriptions
  drop constraint if exists organisation_subscriptions_highest_requested_check;

alter table public.organisation_subscriptions
  add constraint organisation_subscriptions_highest_requested_check
  check (
    highest_requested_site_quantity >= 1
    and highest_requested_site_quantity <= 500
  );

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
  applied_site_quantity integer;
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

  applied_site_quantity := target_site_quantity;
  if current_row.id is not null
    and current_row.last_provider_event_at is not null
    and target_event_at is not null
    and target_event_at = current_row.last_provider_event_at
    and target_site_quantity < current_row.site_quantity then
    applied_site_quantity := current_row.site_quantity;
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
      highest_requested_site_quantity,
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
      applied_site_quantity,
      applied_site_quantity,
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
        site_quantity = applied_site_quantity,
        highest_requested_site_quantity = greatest(
          subscription.highest_requested_site_quantity,
          applied_site_quantity
        ),
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

create or replace function private.claim_site_quantity_increase(
  target_desired_site_quantity integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  current_row public.organisation_subscriptions%rowtype;
  floor_quantity integer;
  next_highest integer;
begin
  org_id := private.current_organisation_id();
  if org_id is null then
    raise exception 'Select an organisation before managing billing.'
      using errcode = '42501';
  end if;

  if not coalesce(private.current_can_manage_billing(), false) then
    raise exception 'Billing management is required to change subscribed site quantity.'
      using errcode = '42501';
  end if;

  if target_desired_site_quantity is null
    or target_desired_site_quantity <> trunc(target_desired_site_quantity)
    or target_desired_site_quantity < 1
    or target_desired_site_quantity > 500 then
    raise exception 'Desired site quantity must be a whole number between 1 and 500.'
      using errcode = '22023';
  end if;

  select *
  into current_row
  from public.organisation_subscriptions subscription
  where subscription.organisation_id = org_id
  for update;

  if current_row.id is null then
    return jsonb_build_object(
      'action', 'reject',
      'reason', 'missing_subscription',
      'message', 'This organisation does not have a billing subscription to increase.',
      'highest_requested_site_quantity', null,
      'site_quantity', null
    );
  end if;

  floor_quantity := greatest(
    coalesce(
      current_row.highest_requested_site_quantity,
      current_row.site_quantity
    ),
    current_row.site_quantity
  );

  if target_desired_site_quantity < floor_quantity then
    return jsonb_build_object(
      'action', 'noop',
      'reason', 'superseded',
      'message', 'A higher subscribed site quantity is already requested or confirmed.',
      'highest_requested_site_quantity', floor_quantity,
      'site_quantity', current_row.site_quantity
    );
  end if;

  next_highest := greatest(floor_quantity, target_desired_site_quantity);

  update public.organisation_subscriptions subscription
  set highest_requested_site_quantity = next_highest,
      updated_at = statement_timestamp()
  where subscription.id = current_row.id
    and subscription.organisation_id = org_id;

  if target_desired_site_quantity = floor_quantity
    and current_row.site_quantity >= target_desired_site_quantity then
    return jsonb_build_object(
      'action', 'noop',
      'reason', 'already_at_or_above',
      'message', 'Subscribed site quantity is already at or above the requested total.',
      'highest_requested_site_quantity', next_highest,
      'site_quantity', current_row.site_quantity
    );
  end if;

  return jsonb_build_object(
    'action', 'update',
    'reason', null,
    'message', null,
    'highest_requested_site_quantity', next_highest,
    'site_quantity', current_row.site_quantity
  );
end;
$$;

create or replace function public.claim_site_quantity_increase(
  target_desired_site_quantity integer
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select private.claim_site_quantity_increase(target_desired_site_quantity)
$$;

do $$
declare
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'private.apply_organisation_subscription_snapshot(uuid,text,text,text,text,text,integer,text,text,text,timestamptz,timestamptz,boolean,timestamptz,timestamptz,boolean)'::regprocedure,
    'private.claim_site_quantity_increase(integer)'::regprocedure
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

revoke all on function public.claim_site_quantity_increase(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.claim_site_quantity_increase(integer)
  to authenticated;
grant execute on function private.claim_site_quantity_increase(integer)
  to authenticated;
