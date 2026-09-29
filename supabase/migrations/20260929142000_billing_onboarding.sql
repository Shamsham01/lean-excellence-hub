-- ONBOARD-001: founder signup, provisioning organisations, and onboarding
-- completion. Invitation-only workforce signup stays in force.

alter table private.identity_controls
  add column if not exists can_found_organisation boolean not null default false;

alter table public.organisations
  add column if not exists country_code text not null default 'GB';

alter table public.organisations
  drop constraint if exists organisations_country_code_check;

alter table public.organisations
  add constraint organisations_country_code_check
    check (country_code ~ '^[A-Z]{2}$');

alter table public.organisations
  add column if not exists onboarding_required boolean not null default false;

alter table public.organisation_billing_accounts
  add column if not exists intended_site_quantity integer not null default 1;

alter table public.organisation_billing_accounts
  drop constraint if exists organisation_billing_accounts_intended_site_quantity_check;

alter table public.organisation_billing_accounts
  add constraint organisation_billing_accounts_intended_site_quantity_check
    check (intended_site_quantity >= 1);

create table if not exists public.founding_signup_bindings (
  id uuid primary key default gen_random_uuid(),
  canonical_email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint founding_signup_bindings_email_check
    check (
      canonical_email = lower(btrim(canonical_email))
      and char_length(canonical_email) between 3 and 320
    )
);

create index if not exists founding_signup_bindings_email_idx
  on public.founding_signup_bindings (canonical_email, expires_at desc);

alter table public.founding_signup_bindings enable row level security;
alter table public.founding_signup_bindings force row level security;

grant select, insert, update on public.founding_signup_bindings
  to lean_hub_private_owner;

drop policy if exists private_owner_all on public.founding_signup_bindings;
create policy private_owner_all on public.founding_signup_bindings
  for all to lean_hub_private_owner using (true) with check (true);

create or replace function private.normalise_founding_code(raw_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  slug text;
begin
  slug := trim(both '-' from regexp_replace(lower(btrim(coalesce(raw_value, ''))), '[^a-z0-9]+', '-', 'g'));
  if char_length(slug) < 2 then
    slug := 'org';
  end if;
  slug := left(slug, 24);
  slug := trim(both '-' from slug);
  if slug !~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$' then
    slug := 'org';
  end if;
  return slug;
end;
$$;

create or replace function private.allocate_unique_organisation_code(preferred text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base_code text := private.normalise_founding_code(preferred);
  candidate text := base_code;
  suffix integer := 2;
begin
  while exists (
    select 1 from public.organisations organisation where organisation.code = candidate
  ) loop
    candidate := left(base_code, 20) || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function private.prepare_founding_signup_binding(
  target_email text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  canonical text := lower(btrim(target_email));
  binding_id uuid;
begin
  if canonical is null or canonical = '' or position('@' in canonical) = 0 then
    raise exception 'founding signup email is invalid'
      using errcode = '22023';
  end if;

  select binding.id
  into binding_id
  from public.founding_signup_bindings binding
  where binding.canonical_email = canonical
    and binding.consumed_at is null
    and binding.expires_at > statement_timestamp()
  order by binding.created_at desc
  limit 1
  for update;

  if binding_id is not null then
    return binding_id;
  end if;

  insert into public.founding_signup_bindings (
    canonical_email,
    expires_at
  )
  values (
    canonical,
    statement_timestamp() + interval '24 hours'
  )
  returning id into binding_id;

  return binding_id;
end;
$$;

create or replace function public.prepare_founding_signup_binding(
  target_email text
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.prepare_founding_signup_binding(target_email)
$$;

create or replace function private.finalise_founding_signup(
  target_binding_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  binding_row public.founding_signup_bindings%rowtype;
  user_email text;
begin
  if target_binding_id is null or target_user_id is null then
    return false;
  end if;

  select lower(btrim(auth_user.email))
  into user_email
  from auth.users auth_user
  where auth_user.id = target_user_id;

  select *
  into binding_row
  from public.founding_signup_bindings binding
  where binding.id = target_binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or binding_row.canonical_email is distinct from user_email then
    return false;
  end if;

  update public.founding_signup_bindings
  set consumed_at = statement_timestamp(),
      consumed_user_id = target_user_id
  where id = target_binding_id;

  update private.identity_controls
  set can_found_organisation = true,
      status = 'active',
      enrolment_status = 'complete',
      enrolment_completed_at = coalesce(
        enrolment_completed_at,
        statement_timestamp()
      ),
      status_changed_at = statement_timestamp()
  where user_id = target_user_id
    and status <> 'disabled';

  return found;
end;
$$;

create or replace function public.finalise_founding_signup(
  target_binding_id uuid,
  target_user_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.finalise_founding_signup(target_binding_id, target_user_id)
$$;

create or replace function public.hook_require_invitation_for_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text;
  canonical_email text;
  binding_id_text text;
  binding_id uuid;
  binding_row public.organisation_invitation_signup_bindings%rowtype;
  invitation_row public.organisation_invitations%rowtype;
  workforce_intent_id_text text;
  workforce_intent_id uuid;
  founding_binding_id_text text;
  founding_binding public.founding_signup_bindings%rowtype;
begin
  signup_email := event -> 'user' ->> 'email';
  workforce_intent_id_text :=
    event -> 'user' -> 'user_metadata' ->> 'workforce_provision_intent_id';

  if workforce_intent_id_text is not null
    and workforce_intent_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and signup_email is not null
    and btrim(signup_email) <> '' then
    workforce_intent_id := workforce_intent_id_text::uuid;

    if private.validate_workforce_provision_intent_for_hook(
      workforce_intent_id,
      signup_email
    ) then
      return '{}'::jsonb;
    end if;

    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  founding_binding_id_text :=
    event -> 'user' -> 'user_metadata' ->> 'founding_signup_binding';

  if founding_binding_id_text is not null then
    if signup_email is null or btrim(signup_email) = '' then
      return jsonb_build_object(
        'error', jsonb_build_object(
          'message', 'An email address is required to create an account.',
          'http_code', 403
        )
      );
    end if;

    if founding_binding_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return jsonb_build_object(
        'error', jsonb_build_object(
          'message',
            'Account creation requires a valid organisation invitation.',
          'http_code', 403
        )
      );
    end if;

    canonical_email := lower(btrim(signup_email));

    select *
    into founding_binding
    from public.founding_signup_bindings binding
    where binding.id = founding_binding_id_text::uuid
    for update;

    if founding_binding.id is not null
      and founding_binding.consumed_at is null
      and founding_binding.expires_at > statement_timestamp()
      and founding_binding.canonical_email = canonical_email then
      return '{}'::jsonb;
    end if;

    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  binding_id_text := event -> 'user' -> 'user_metadata' ->> 'invitation_signup_binding';

  if signup_email is null or btrim(signup_email) = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'An email address is required to create an account.',
        'http_code', 403
      )
    );
  end if;

  if binding_id_text is null
    or binding_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  binding_id := binding_id_text::uuid;
  canonical_email := lower(btrim(signup_email));

  select *
  into binding_row
  from public.organisation_invitation_signup_bindings binding
  where binding.id = binding_id
  for update;

  if binding_row.id is null
    or binding_row.consumed_at is not null
    or binding_row.invalidated_at is not null
    or binding_row.expires_at <= statement_timestamp()
    or binding_row.canonical_recipient <> canonical_email then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  select *
  into invitation_row
  from public.organisation_invitations invitation
  where invitation.id = binding_row.invitation_id;

  if invitation_row.id is null
    or invitation_row.status <> 'pending'
    or invitation_row.offer_sealed_at is null
    or invitation_row.expires_at <= statement_timestamp()
    or invitation_row.canonical_recipient <> canonical_email then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message',
          'Account creation requires a valid organisation invitation.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

create or replace function private.current_can_found_organisation()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select identity_control.can_found_organisation
      from private.identity_controls identity_control
      where identity_control.user_id = private.auth_uid()
        and identity_control.status = 'active'
        and identity_control.enrolment_status = 'complete'
    ),
    false
  )
$$;

create or replace function public.current_can_found_organisation()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_can_found_organisation()
$$;

create or replace function private.create_founding_organisation(
  organisation_name text,
  organisation_country_code text,
  organisation_locale text,
  organisation_time_zone text,
  organisation_reporting_currency text,
  first_site_name text,
  site_quantity integer,
  billing_provider text default 'fake'
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
      onboarding_required = true
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
      country_code = country
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
    jsonb_build_object('site_quantity', quantity)
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
  billing_provider text default 'fake'
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
    billing_provider
  )
$$;

create or replace function private.complete_organisation_onboarding()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_organisation_id uuid := private.current_organisation_id();
begin
  if target_organisation_id is null
    or private.current_lifecycle_membership_id(target_organisation_id) is null then
    raise exception 'onboarding completion is not authorised'
      using errcode = '42501';
  end if;

  update public.organisations
  set onboarding_required = false,
      version = version + 1
  where id = target_organisation_id
    and status = 'active';

  return found;
end;
$$;

create or replace function public.complete_organisation_onboarding()
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.complete_organisation_onboarding()
$$;

drop function if exists public.list_my_eligible_organisations();
drop function if exists private.list_my_eligible_organisations();

create function private.list_my_eligible_organisations()
returns table (
  organisation_id uuid,
  membership_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_status text,
  onboarding_required boolean,
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
    organisation.onboarding_required,
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

create function public.list_my_eligible_organisations()
returns table (
  organisation_id uuid,
  membership_id uuid,
  organisation_code text,
  organisation_name text,
  organisation_status text,
  onboarding_required boolean,
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
  organisation_status text,
  onboarding_required boolean,
  intended_site_quantity integer,
  open_checkout_session_id text
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
    ),
    organisation.onboarding_required,
    account.intended_site_quantity,
    account.open_checkout_session_id
  from public.organisations organisation
  left join public.organisation_billing_accounts account
    on account.organisation_id = organisation.id
  left join public.organisation_subscriptions subscription
    on subscription.organisation_id = organisation.id
  where organisation.id = private.current_organisation_id()
    and private.current_lifecycle_membership_id(organisation.id) is not null
$$;

revoke all on function private.normalise_founding_code(text)
  from public, anon, authenticated, service_role;
revoke all on function private.allocate_unique_organisation_code(text)
  from public, anon, authenticated, service_role;
revoke all on function private.prepare_founding_signup_binding(text)
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_founding_signup_binding(text)
  from public, anon, authenticated, service_role;
revoke all on function private.finalise_founding_signup(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.finalise_founding_signup(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.current_can_found_organisation()
  from public, anon, authenticated, service_role;
revoke all on function public.current_can_found_organisation()
  from public, anon, authenticated, service_role;
revoke all on function private.create_founding_organisation(text, text, text, text, text, text, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_founding_organisation(text, text, text, text, text, text, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function private.complete_organisation_onboarding()
  from public, anon, authenticated, service_role;
revoke all on function public.complete_organisation_onboarding()
  from public, anon, authenticated, service_role;
revoke all on function private.list_my_eligible_organisations()
  from public, anon, authenticated, service_role;
revoke all on function public.list_my_eligible_organisations()
  from public, anon, authenticated, service_role;
revoke all on function public.get_current_organisation_billing()
  from public, anon, authenticated, service_role;

alter function private.normalise_founding_code(text)
  owner to lean_hub_private_owner;
alter function private.allocate_unique_organisation_code(text)
  owner to lean_hub_private_owner;
alter function private.prepare_founding_signup_binding(text)
  owner to lean_hub_private_owner;
alter function private.finalise_founding_signup(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.current_can_found_organisation()
  owner to lean_hub_private_owner;
alter function private.create_founding_organisation(text, text, text, text, text, text, integer, text)
  owner to lean_hub_private_owner;
alter function private.complete_organisation_onboarding()
  owner to lean_hub_private_owner;
alter function private.list_my_eligible_organisations()
  owner to lean_hub_private_owner;

grant execute on function public.prepare_founding_signup_binding(text)
  to service_role;
grant execute on function public.finalise_founding_signup(uuid, uuid)
  to service_role;
grant execute on function public.current_can_found_organisation()
  to authenticated;
grant execute on function private.current_can_found_organisation()
  to authenticated;
grant execute on function public.create_founding_organisation(text, text, text, text, text, text, integer, text)
  to authenticated;
grant execute on function private.create_founding_organisation(text, text, text, text, text, text, integer, text)
  to authenticated;
grant execute on function public.complete_organisation_onboarding()
  to authenticated;
grant execute on function private.complete_organisation_onboarding()
  to authenticated;
grant execute on function public.list_my_eligible_organisations()
  to authenticated;
grant execute on function private.list_my_eligible_organisations()
  to authenticated;
grant execute on function public.get_current_organisation_billing()
  to authenticated;
