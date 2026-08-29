-- M1 workforce provisioning schema.

create table public.workforce_provision_intents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  actor_membership_id uuid not null,
  intent_kind text not null,
  status text not null default 'pending',
  target_display_name text not null,
  target_canonical_alias text not null,
  target_alias_type text not null default 'username',
  target_job_title text,
  target_notification_email text,
  sealed_internal_login_identifier text not null,
  target_job_function_id uuid,
  target_organisational_unit_id uuid,
  target_role_version_id uuid not null,
  target_scope_type text not null,
  target_scope_unit_id uuid,
  created_auth_user_id uuid,
  created_membership_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  idempotency_key text,
  failure_reason text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint workforce_provision_intents_actor_fkey
    foreign key (organisation_id, actor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint workforce_provision_intents_job_function_fkey
    foreign key (organisation_id, target_job_function_id)
    references public.job_functions(organisation_id, id)
    on delete restrict,
  constraint workforce_provision_intents_unit_fkey
    foreign key (organisation_id, target_organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint workforce_provision_intents_role_version_fkey
    foreign key (organisation_id, target_role_version_id)
    references public.role_versions(organisation_id, id)
    on delete restrict,
  constraint workforce_provision_intents_scope_unit_fkey
    foreign key (organisation_id, target_scope_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint workforce_provision_intents_kind_check
    check (intent_kind in ('manual_create', 'credential_reset')),
  constraint workforce_provision_intents_status_check
    check (
      status in (
        'pending',
        'auth_created',
        'completed',
        'failed',
        'expired',
        'needs_platform_remediation'
      )
    ),
  constraint workforce_provision_intents_alias_type_check
    check (target_alias_type in ('workforce_id', 'username')),
  constraint workforce_provision_intents_scope_type_check
    check (target_scope_type in ('organisation', 'unit_subtree', 'self')),
  constraint workforce_provision_intents_display_name_check
    check (
      target_display_name = btrim(target_display_name)
      and char_length(target_display_name) between 1 and 120
    ),
  constraint workforce_provision_intents_alias_check
    check (
      target_canonical_alias = lower(btrim(target_canonical_alias))
      and target_canonical_alias ~ '^[a-z0-9][a-z0-9._-]{0,127}$'
    ),
  constraint workforce_provision_intents_internal_login_check
    check (
      sealed_internal_login_identifier = lower(sealed_internal_login_identifier)
      and char_length(sealed_internal_login_identifier) between 32 and 320
      and sealed_internal_login_identifier ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+$'
      and sealed_internal_login_identifier like '%@workforce.invalid'
    ),
  constraint workforce_provision_intents_notification_email_check
    check (
      target_notification_email is null
      or (
        target_notification_email = lower(btrim(target_notification_email))
        and char_length(target_notification_email) between 3 and 320
      )
    ),
  constraint workforce_provision_intents_job_title_check
    check (
      target_job_title is null
      or (
        target_job_title = btrim(target_job_title)
        and char_length(target_job_title) between 1 and 120
      )
    ),
  constraint workforce_provision_intents_completed_shape_check
    check (
      status <> 'completed'
      or (
        created_auth_user_id is not null
        and created_membership_id is not null
        and consumed_at is not null
      )
    ),
  constraint workforce_provision_intents_auth_created_shape_check
    check (
      status not in ('auth_created', 'completed')
      or created_auth_user_id is not null
    )
);

create unique index workforce_provision_intents_org_idempotency_key_idx
  on public.workforce_provision_intents (organisation_id, idempotency_key)
  where idempotency_key is not null;

create unique index workforce_provision_intents_active_alias_idx
  on public.workforce_provision_intents (organisation_id, target_canonical_alias)
  where status in ('pending', 'auth_created');

create unique index workforce_provision_intents_internal_login_active_idx
  on public.workforce_provision_intents (sealed_internal_login_identifier)
  where status in ('pending', 'auth_created');

create index workforce_provision_intents_org_status_idx
  on public.workforce_provision_intents (organisation_id, status, expires_at);

create trigger workforce_provision_intents_touch_updated_at
before update on public.workforce_provision_intents
for each row execute function private.touch_updated_at();

alter table public.workforce_provision_intents enable row level security;
alter table public.workforce_provision_intents force row level security;

revoke all on public.workforce_provision_intents from public, anon, authenticated, service_role;
grant select, insert, update on public.workforce_provision_intents to lean_hub_private_owner;

create policy private_owner_all_workforce_provision_intents
on public.workforce_provision_intents
for all
to lean_hub_private_owner
using (true)
with check (true);

create table public.membership_notification_contacts (
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  channel_type text not null default 'email',
  contact_address text not null,
  status text not null default 'active',
  source text not null default 'manual',
  verified_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint membership_notification_contacts_pkey
    primary key (organisation_id, membership_id, channel_type),
  constraint membership_notification_contacts_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint membership_notification_contacts_channel_check
    check (channel_type = 'email'),
  constraint membership_notification_contacts_status_check
    check (status in ('active', 'removed')),
  constraint membership_notification_contacts_source_check
    check (source in ('manual', 'import', 'auth_email_default')),
  constraint membership_notification_contacts_address_check
    check (
      contact_address = lower(btrim(contact_address))
      and char_length(contact_address) between 3 and 320
    )
);

create trigger membership_notification_contacts_touch_updated_at
before update on public.membership_notification_contacts
for each row execute function private.touch_updated_at();

alter table public.membership_notification_contacts enable row level security;
alter table public.membership_notification_contacts force row level security;

revoke all on public.membership_notification_contacts from public, anon, authenticated, service_role;
grant select, insert, update on public.membership_notification_contacts to lean_hub_private_owner;

create policy private_owner_all_membership_notification_contacts
on public.membership_notification_contacts
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy membership_notification_contacts_select_scoped
on public.membership_notification_contacts
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    membership_id = private.current_membership_id(organisation_id)
    or private.has_scoped_permission(
      organisation_id,
      'memberships.read',
      null,
      null
    )
  )
);

grant select on public.membership_notification_contacts to authenticated;
