create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint profiles_display_name_check
    check (
      display_name is null
      or (
        display_name = btrim(display_name)
        and char_length(display_name) between 1 and 120
      )
    ),
  constraint profiles_avatar_url_check
    check (avatar_url is null or char_length(avatar_url) <= 2048)
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  locale text not null default 'en-GB',
  time_zone text not null default 'UTC',
  reporting_currency text not null default 'GBP',
  status text not null default 'provisioning',
  version integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  status_changed_at timestamptz not null default statement_timestamp(),
  status_changed_by_user_id uuid references auth.users(id) on delete restrict,
  status_reason text,
  constraint organisations_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$'
    ),
  constraint organisations_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint organisations_locale_check
    check (char_length(locale) between 2 and 35),
  constraint organisations_time_zone_check
    check (char_length(time_zone) between 1 and 100),
  constraint organisations_reporting_currency_check
    check (reporting_currency ~ '^[A-Z]{3}$'),
  constraint organisations_status_check
    check (status in ('provisioning', 'active', 'suspended', 'closed')),
  constraint organisations_version_check check (version > 0),
  constraint organisations_status_reason_check
    check (
      status not in ('suspended', 'closed')
      or (
        status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    )
);

create table private.identity_controls (
  user_id uuid primary key references auth.users(id) on delete restrict,
  status text not null default 'provisioning',
  enrolment_status text not null default 'pending',
  stewardship_kind text not null default 'platform',
  stewardship_organisation_id uuid references public.organisations(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  status_changed_at timestamptz not null default statement_timestamp(),
  enrolment_completed_at timestamptz,
  last_password_change_at timestamptz,
  last_security_event_at timestamptz,
  status_changed_by_user_id uuid references auth.users(id) on delete restrict,
  status_reason text,
  constraint identity_controls_status_check
    check (status in ('provisioning', 'active', 'disabled')),
  constraint identity_controls_enrolment_status_check
    check (
      enrolment_status in ('pending', 'password_change_required', 'complete')
    ),
  constraint identity_controls_stewardship_check
    check (
      (stewardship_kind = 'platform' and stewardship_organisation_id is null)
      or (
        stewardship_kind = 'organisation'
        and stewardship_organisation_id is not null
      )
    ),
  constraint identity_controls_enrolment_completed_check
    check (
      (enrolment_status = 'complete' and enrolment_completed_at is not null)
      or (enrolment_status <> 'complete' and enrolment_completed_at is null)
    ),
  constraint identity_controls_disabled_reason_check
    check (
      status <> 'disabled'
      or (
        status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    )
);

create table public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  display_name text,
  job_title text,
  status text not null default 'pending',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  status_changed_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  inactivated_at timestamptz,
  status_changed_by_membership_id uuid,
  status_reason text,
  constraint organisation_memberships_organisation_id_id_key
    unique (organisation_id, id),
  constraint organisation_memberships_organisation_id_user_id_key
    unique (organisation_id, user_id),
  constraint organisation_memberships_organisation_id_id_user_id_key
    unique (organisation_id, id, user_id),
  constraint organisation_memberships_display_name_check
    check (
      display_name is null
      or (
        display_name = btrim(display_name)
        and char_length(display_name) between 1 and 120
      )
    ),
  constraint organisation_memberships_job_title_check
    check (
      job_title is null
      or (
        job_title = btrim(job_title)
        and char_length(job_title) between 1 and 120
      )
    ),
  constraint organisation_memberships_status_check
    check (status in ('pending', 'active', 'inactive')),
  constraint organisation_memberships_lifecycle_check
    check (
      (status = 'pending' and activated_at is null and inactivated_at is null)
      or (status = 'active' and activated_at is not null and inactivated_at is null)
      or (
        status = 'inactive'
        and inactivated_at is not null
        and status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    ),
  constraint organisation_memberships_status_actor_fkey
    foreign key (organisation_id, status_changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table private.workforce_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  internal_login_identifier text not null unique,
  status text not null default 'provisioning',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  status_changed_at timestamptz not null default statement_timestamp(),
  identifier_rotated_at timestamptz,
  status_changed_by_user_id uuid references auth.users(id) on delete restrict,
  status_reason text,
  constraint workforce_accounts_id_user_id_key unique (id, user_id),
  constraint workforce_accounts_identifier_check
    check (
      internal_login_identifier = lower(internal_login_identifier)
      and char_length(internal_login_identifier) between 32 and 320
      and internal_login_identifier ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+$'
    ),
  constraint workforce_accounts_status_check
    check (status in ('provisioning', 'active', 'disabled')),
  constraint workforce_accounts_disabled_reason_check
    check (
      status <> 'disabled'
      or (
        status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    )
);

create table private.workforce_aliases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  user_id uuid not null,
  workforce_account_id uuid not null,
  alias_type text not null,
  canonical_alias text not null,
  status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  status_changed_by_membership_id uuid,
  status_reason text,
  constraint workforce_aliases_organisation_id_id_key
    unique (organisation_id, id),
  constraint workforce_aliases_organisation_id_canonical_alias_key
    unique (organisation_id, canonical_alias),
  constraint workforce_aliases_membership_fkey
    foreign key (organisation_id, membership_id, user_id)
    references public.organisation_memberships(organisation_id, id, user_id)
    on delete restrict,
  constraint workforce_aliases_account_fkey
    foreign key (workforce_account_id, user_id)
    references private.workforce_accounts(id, user_id)
    on delete restrict,
  constraint workforce_aliases_status_actor_fkey
    foreign key (organisation_id, status_changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint workforce_aliases_alias_type_check
    check (alias_type in ('workforce_id', 'username')),
  constraint workforce_aliases_canonical_alias_check
    check (
      canonical_alias = lower(canonical_alias)
      and canonical_alias ~ '^[a-z0-9][a-z0-9._-]{0,127}$'
    ),
  constraint workforce_aliases_status_check
    check (status in ('active', 'retired')),
  constraint workforce_aliases_lifecycle_check
    check (
      (status = 'active' and retired_at is null)
      or (
        status = 'retired'
        and retired_at is not null
        and status_reason = btrim(status_reason)
        and char_length(status_reason) between 1 and 1000
      )
    )
);

create index organisation_memberships_org_user_status_idx
  on public.organisation_memberships (organisation_id, user_id, status);
create index organisation_memberships_user_status_org_idx
  on public.organisation_memberships (user_id, status, organisation_id);
create index organisation_memberships_org_status_id_idx
  on public.organisation_memberships (organisation_id, status, id);
create index organisations_status_idx
  on public.organisations (status, id);
create index workforce_aliases_org_alias_status_idx
  on private.workforce_aliases (organisation_id, canonical_alias, status);
create index workforce_aliases_account_status_idx
  on private.workforce_aliases (workforce_account_id, status);
create unique index workforce_aliases_active_type_key
  on private.workforce_aliases (organisation_id, membership_id, alias_type)
  where status = 'active';

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger organisations_touch_updated_at
before update on public.organisations
for each row execute function private.touch_updated_at();

create trigger organisation_memberships_touch_updated_at
before update on public.organisation_memberships
for each row execute function private.touch_updated_at();

create trigger organisation_memberships_immutable_tenant
before update on public.organisation_memberships
for each row execute function private.prevent_organisation_id_change();

create trigger identity_controls_touch_updated_at
before update on private.identity_controls
for each row execute function private.touch_updated_at();

create trigger workforce_accounts_touch_updated_at
before update on private.workforce_accounts
for each row execute function private.touch_updated_at();

create trigger workforce_aliases_touch_updated_at
before update on private.workforce_aliases
for each row execute function private.touch_updated_at();

create trigger workforce_aliases_immutable_tenant
before update on private.workforce_aliases
for each row execute function private.prevent_organisation_id_change();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into private.identity_controls (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

alter function private.handle_new_auth_user() owner to lean_hub_private_owner;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

grant usage on schema public to lean_hub_private_owner;
grant insert on public.profiles to lean_hub_private_owner;
grant insert on private.identity_controls to lean_hub_private_owner;

create trigger lean_hub_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.organisations enable row level security;
alter table public.organisations force row level security;
alter table public.organisation_memberships enable row level security;
alter table public.organisation_memberships force row level security;
alter table private.identity_controls enable row level security;
alter table private.identity_controls force row level security;
alter table private.workforce_accounts enable row level security;
alter table private.workforce_accounts force row level security;
alter table private.workforce_aliases enable row level security;
alter table private.workforce_aliases force row level security;

alter table private.identity_controls owner to lean_hub_private_owner;
alter table private.workforce_accounts owner to lean_hub_private_owner;
alter table private.workforce_aliases owner to lean_hub_private_owner;

revoke all on public.profiles from public, anon, authenticated;
revoke all on public.organisations from public, anon, authenticated;
revoke all on public.organisation_memberships from public, anon, authenticated;
revoke all on private.identity_controls from public, anon, authenticated;
revoke all on private.workforce_accounts from public, anon, authenticated;
revoke all on private.workforce_aliases from public, anon, authenticated;
