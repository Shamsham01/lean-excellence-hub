-- M2 workforce bulk import job and credential vault schema.

alter table public.workforce_provision_intents
  drop constraint if exists workforce_provision_intents_kind_check;

alter table public.workforce_provision_intents
  add constraint workforce_provision_intents_kind_check
  check (intent_kind in ('manual_create', 'credential_reset', 'bulk_import_create'));

alter table public.workforce_provision_intents
  add column if not exists source_import_job_id uuid,
  add column if not exists source_import_row_id uuid;

create table public.workforce_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  created_by_membership_id uuid not null,
  status text not null default 'draft',
  original_filename text not null,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  warning_rows integer not null default 0,
  provisioned_rows integer not null default 0,
  failed_rows integer not null default 0,
  remediation_rows integer not null default 0,
  credential_export_status text not null default 'none',
  credential_expires_at timestamptz,
  validation_completed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint workforce_import_jobs_actor_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint workforce_import_jobs_status_check
    check (
      status in (
        'draft',
        'validated',
        'validation_failed',
        'provisioning',
        'completed',
        'completed_with_remediation',
        'failed',
        'cancelled'
      )
    ),
  constraint workforce_import_jobs_export_status_check
    check (
      credential_export_status in ('none', 'available', 'exported', 'expired')
    ),
  constraint workforce_import_jobs_total_rows_check
    check (total_rows >= 0 and total_rows <= 1000),
  constraint workforce_import_jobs_filename_check
    check (
      original_filename = btrim(original_filename)
      and char_length(original_filename) between 1 and 255
    )
);

create table public.workforce_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.workforce_import_jobs(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  row_number integer not null,
  input_payload jsonb not null,
  resolved_payload jsonb,
  status text not null default 'pending',
  provisioning_intent_id uuid references public.workforce_provision_intents(id) on delete set null,
  created_membership_id uuid,
  error_code text,
  error_message text,
  field_errors jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint workforce_import_rows_job_fkey
    foreign key (import_job_id)
    references public.workforce_import_jobs(id)
    on delete restrict,
  constraint workforce_import_rows_membership_fkey
    foreign key (organisation_id, created_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint workforce_import_rows_row_number_check
    check (row_number > 0),
  constraint workforce_import_rows_status_check
    check (
      status in (
        'pending',
        'valid',
        'error',
        'warning',
        'provisioning',
        'completed',
        'failed',
        'needs_platform_remediation'
      )
    ),
  constraint workforce_import_rows_unique_row
    unique (import_job_id, row_number)
);

create table public.workforce_import_row_credentials (
  import_row_id uuid primary key references public.workforce_import_rows(id) on delete cascade,
  import_job_id uuid not null,
  organisation_id uuid not null,
  credential_ciphertext bytea not null,
  credential_nonce bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint workforce_import_row_credentials_job_fkey
    foreign key (import_job_id)
    references public.workforce_import_jobs(id)
    on delete restrict,
  constraint workforce_import_row_credentials_nonce_len_check
    check (octet_length(credential_nonce) = 12),
  constraint workforce_import_row_credentials_ciphertext_check
    check (octet_length(credential_ciphertext) > 0)
);

create index workforce_import_jobs_org_created_idx
  on public.workforce_import_jobs (organisation_id, created_at desc);

create index workforce_import_rows_job_status_idx
  on public.workforce_import_rows (import_job_id, status, row_number);

create index workforce_import_row_credentials_job_expires_idx
  on public.workforce_import_row_credentials (import_job_id, expires_at);

create trigger workforce_import_jobs_touch_updated_at
before update on public.workforce_import_jobs
for each row execute function private.touch_updated_at();

create trigger workforce_import_rows_touch_updated_at
before update on public.workforce_import_rows
for each row execute function private.touch_updated_at();

alter table public.workforce_import_jobs enable row level security;
alter table public.workforce_import_jobs force row level security;

alter table public.workforce_import_rows enable row level security;
alter table public.workforce_import_rows force row level security;

alter table public.workforce_import_row_credentials enable row level security;
alter table public.workforce_import_row_credentials force row level security;

revoke all on public.workforce_import_jobs from public, anon, authenticated, service_role;
revoke all on public.workforce_import_rows from public, anon, authenticated, service_role;
revoke all on public.workforce_import_row_credentials from public, anon, authenticated, service_role;

grant select, insert, update on public.workforce_import_jobs to lean_hub_private_owner;
grant select, insert, update on public.workforce_import_rows to lean_hub_private_owner;
grant select, insert, update, delete on public.workforce_import_row_credentials to lean_hub_private_owner;

create policy private_owner_all_workforce_import_jobs
on public.workforce_import_jobs
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_workforce_import_rows
on public.workforce_import_rows
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_workforce_import_row_credentials
on public.workforce_import_row_credentials
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy workforce_import_jobs_select_scoped
on public.workforce_import_jobs
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.membership_has_scoped_permission(
    private.current_membership_id(organisation_id),
    organisation_id,
    'workforce.import',
    null,
    null
  )
);

create policy workforce_import_rows_select_scoped
on public.workforce_import_rows
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.membership_has_scoped_permission(
    private.current_membership_id(organisation_id),
    organisation_id,
    'workforce.import',
    null,
    null
  )
);

grant select on public.workforce_import_jobs to authenticated;
grant select on public.workforce_import_rows to authenticated;

alter table public.security_audit_events
  drop constraint if exists security_audit_events_target_type_check;

alter table public.security_audit_events
  add constraint security_audit_events_target_type_check
  check (
    target_type is null
    or target_type in (
      'identity',
      'organisation',
      'membership',
      'invitation',
      'unit',
      'role',
      'role_version',
      'grant',
      'session',
      'workforce_account',
      'workforce_alias',
      'workforce_provision_intent',
      'workforce_import_job',
      'authentication'
    )
  );
