-- MULTISITE-EXPAND-01C: first-customer multi-site intent.
-- Product context only. Never used as security authority or billing capacity.
-- Legacy NULL means "not sure" in product UX.
-- Do not apply this migration to hosted Supabase from this change.

alter table public.organisations
  add column if not exists multi_site_intent text;

alter table public.organisations
  drop constraint if exists organisations_multi_site_intent_check;

alter table public.organisations
  add constraint organisations_multi_site_intent_check
  check (
    multi_site_intent is null
    or multi_site_intent in ('yes', 'no', 'not_sure')
  );

comment on column public.organisations.multi_site_intent is
  'First-customer product context: yes/no/not_sure for a wider multi-site organisation. NULL is legacy/unknown and must be treated as not sure. Never grants access or site capacity.';

drop function if exists public.create_founding_organisation(text, text, text, text, text, text, integer, text);
drop function if exists private.create_founding_organisation(text, text, text, text, text, text, integer, text);

create or replace function private.create_founding_organisation(
  organisation_name text,
  organisation_country_code text,
  organisation_locale text,
  organisation_time_zone text,
  organisation_reporting_currency text,
  first_site_name text,
  site_quantity integer,
  billing_provider text default 'fake',
  multi_site_intent text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := private.auth_uid();
  new_organisation_id uuid;
  organisation_code text;
  site_code text;
  country text := upper(btrim(organisation_country_code));
  quantity integer := site_quantity;
  intent text := nullif(lower(btrim(multi_site_intent)), '');
begin
  if actor_user_id is null then
    raise exception 'organisation founding is not authorised'
      using errcode = '42501';
  end if;

  update private.identity_controls
  set can_found_organisation = false
  where user_id = actor_user_id
    and can_found_organisation
    and status = 'active'
    and enrolment_status = 'complete';

  if not found then
    raise exception 'organisation founding is not authorised'
      using errcode = '42501';
  end if;

  if quantity is null or quantity < 1 or quantity > 500 then
    raise exception 'site quantity is invalid'
      using errcode = '23514';
  end if;

  if country is null or country !~ '^[A-Z]{2}$' then
    raise exception 'country code is invalid'
      using errcode = '23514';
  end if;

  if billing_provider not in ('stripe', 'fake') then
    raise exception 'billing provider is invalid'
      using errcode = '22023';
  end if;

  if intent is not null and intent not in ('yes', 'no', 'not_sure') then
    raise exception 'multi-site intent is invalid'
      using errcode = '23514';
  end if;

  organisation_code := private.allocate_unique_organisation_code(organisation_name);
  site_code := private.allocate_unique_organisation_code(first_site_name);

  new_organisation_id := private.provision_organisation(
    actor_user_id,
    organisation_code,
    btrim(organisation_name),
    coalesce(nullif(btrim(organisation_locale), ''), 'en-GB'),
    coalesce(nullif(btrim(organisation_time_zone), ''), 'UTC'),
    coalesce(nullif(btrim(organisation_reporting_currency), ''), 'GBP')
  );

  update public.organisations
  set country_code = country,
      onboarding_required = true,
      multi_site_intent = intent
  where id = new_organisation_id;

  if not private.switch_organisation(new_organisation_id) then
    raise exception 'organisation founding session could not be selected'
      using errcode = '42501';
  end if;

  perform private.create_organisation_unit(
    new_organisation_id,
    null,
    site_code,
    btrim(first_site_name),
    'site'
  );

  update public.organisations
  set status = 'provisioning',
      status_reason = null,
      status_changed_at = statement_timestamp(),
      version = version + 1,
      onboarding_required = true,
      country_code = country,
      multi_site_intent = intent
  where id = new_organisation_id;

  perform private.ensure_organisation_billing_account(
    new_organisation_id,
    billing_provider,
    null
  );

  update public.organisation_billing_accounts
  set intended_site_quantity = quantity
  where organisation_id = new_organisation_id;

  perform private.append_security_audit(
    new_organisation_id,
    'organisation.founded',
    'organisation',
    new_organisation_id,
    'succeeded',
    jsonb_build_object(
      'site_quantity', quantity,
      'multi_site_intent', intent
    )
  );

  return new_organisation_id;
end;
$$;

create or replace function public.create_founding_organisation(
  organisation_name text,
  organisation_country_code text,
  organisation_locale text,
  organisation_time_zone text,
  organisation_reporting_currency text,
  first_site_name text,
  site_quantity integer,
  billing_provider text default 'fake',
  multi_site_intent text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_founding_organisation(
    organisation_name,
    organisation_country_code,
    organisation_locale,
    organisation_time_zone,
    organisation_reporting_currency,
    first_site_name,
    site_quantity,
    billing_provider,
    multi_site_intent
  )
$$;

create or replace function private.set_organisation_multi_site_intent(
  target_intent text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  organisation_id uuid := private.current_organisation_id();
  intent text := nullif(lower(btrim(target_intent)), '');
begin
  if organisation_id is null
    or private.current_membership_id(organisation_id) is null
    or not private.has_scoped_permission(
      organisation_id,
      'hierarchy.manage',
      null,
      null
    ) then
    raise exception 'multi-site intent cannot be updated'
      using errcode = '42501';
  end if;

  if intent is null or intent not in ('yes', 'no', 'not_sure') then
    raise exception 'multi-site intent is invalid'
      using errcode = '23514';
  end if;

  update public.organisations
  set multi_site_intent = intent
  where id = organisation_id;

  perform private.append_security_audit(
    organisation_id,
    'organisation.multi_site_intent_updated',
    'organisation',
    organisation_id,
    'succeeded',
    jsonb_build_object('multi_site_intent', intent)
  );

  return intent;
end;
$$;

create or replace function public.set_organisation_multi_site_intent(
  target_intent text
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.set_organisation_multi_site_intent(target_intent)
$$;

revoke all on function private.create_founding_organisation(text, text, text, text, text, text, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_founding_organisation(text, text, text, text, text, text, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.set_organisation_multi_site_intent(text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_organisation_multi_site_intent(text)
  from public, anon, authenticated, service_role;

alter function private.create_founding_organisation(text, text, text, text, text, text, integer, text, text)
  owner to lean_hub_private_owner;
alter function private.set_organisation_multi_site_intent(text)
  owner to lean_hub_private_owner;

-- Expose only the permission-checked public wrappers. Keep private helpers
-- non-callable directly by authenticated roles.
grant execute on function public.create_founding_organisation(text, text, text, text, text, text, integer, text, text)
  to authenticated;
grant execute on function public.set_organisation_multi_site_intent(text)
  to authenticated;
