-- Founding owners need a primary work-area assignment on the first site so
-- suggestion submission and other self-service flows work without an extra setup hop.

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
  site_unit_id uuid;
  owner_membership_id uuid;
  founder_job_function_id uuid;
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

  site_unit_id := private.create_organisation_unit(
    new_organisation_id,
    null,
    site_code,
    btrim(first_site_name),
    'site'
  );

  select membership_registry.id
  into owner_membership_id
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = new_organisation_id
    and membership_registry.user_id = actor_user_id
    and membership_registry.status = 'active'
  limit 1;

  if owner_membership_id is null or site_unit_id is null then
    raise exception 'founding owner primary assignment could not be resolved'
      using errcode = '22023';
  end if;

  founder_job_function_id := private.create_job_function(
    'Organisation lead',
    'organisation-lead',
    'Default job function for the founding owner.'
  );

  perform private.assign_membership_job_function(
    owner_membership_id,
    founder_job_function_id,
    true,
    site_unit_id,
    statement_timestamp(),
    null,
    'Founding owner primary site assignment'
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
      'multi_site_intent', intent,
      'founder_primary_unit_id', site_unit_id
    )
  );

  return new_organisation_id;
end;
$$;

alter function private.create_founding_organisation(
  text, text, text, text, text, text, integer, text, text
) owner to postgres;
