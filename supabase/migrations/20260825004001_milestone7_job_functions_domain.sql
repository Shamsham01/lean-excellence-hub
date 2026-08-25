create extension if not exists btree_gist with schema extensions;

create table public.job_functions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  version integer not null default 1,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz,
  constraint job_functions_organisation_id_id_key unique (organisation_id, id),
  constraint job_functions_organisation_id_code_key unique (organisation_id, code),
  constraint job_functions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint job_functions_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint job_functions_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint job_functions_status_check
    check (status in ('active', 'deactivated')),
  constraint job_functions_version_check check (version > 0),
  constraint job_functions_deactivated_check
    check (
      (status = 'active' and deactivated_at is null)
      or (status = 'deactivated' and deactivated_at is not null)
    )
);

create table public.membership_job_function_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  membership_id uuid not null,
  job_function_id uuid not null,
  organisational_unit_id uuid,
  is_primary boolean not null default false,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  job_function_name_snapshot text not null,
  job_function_code_snapshot text not null,
  assigned_by_membership_id uuid not null,
  assignment_reason text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint membership_job_function_assignments_organisation_id_id_key
    unique (organisation_id, id),
  constraint membership_job_function_assignments_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint membership_job_function_assignments_job_function_fkey
    foreign key (organisation_id, job_function_id)
    references public.job_functions(organisation_id, id)
    on delete restrict,
  constraint membership_job_function_assignments_unit_fkey
    foreign key (organisation_id, organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint membership_job_function_assignments_assigned_by_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint membership_job_function_assignments_valid_range_check
    check (valid_to is null or valid_to > valid_from),
  constraint membership_job_function_assignments_snapshot_name_check
    check (
      job_function_name_snapshot = btrim(job_function_name_snapshot)
      and char_length(job_function_name_snapshot) between 1 and 160
    ),
  constraint membership_job_function_assignments_snapshot_code_check
    check (
      job_function_code_snapshot = lower(job_function_code_snapshot)
      and char_length(job_function_code_snapshot) between 1 and 80
    )
);

alter table public.membership_job_function_assignments
  add constraint membership_job_function_primary_no_overlap
  exclude using gist (
    organisation_id with =,
    membership_id with =,
    tstzrange(
      valid_from,
      coalesce(valid_to, 'infinity'::timestamptz),
      '[)'
    ) with &&
  ) where (is_primary = true);

create index membership_job_function_assignments_membership_idx
  on public.membership_job_function_assignments (organisation_id, membership_id, valid_from desc);

create index membership_job_function_assignments_job_function_idx
  on public.membership_job_function_assignments (organisation_id, job_function_id);

create index job_functions_organisation_status_idx
  on public.job_functions (organisation_id, status);

create trigger job_functions_prevent_organisation_id_change
before update on public.job_functions
for each row execute function private.prevent_organisation_id_change();

create trigger membership_job_function_assignments_prevent_organisation_id_change
before update on public.membership_job_function_assignments
for each row execute function private.prevent_organisation_id_change();

alter table public.job_functions enable row level security;
alter table public.job_functions force row level security;
alter table public.membership_job_function_assignments enable row level security;
alter table public.membership_job_function_assignments force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'job_functions',
    'membership_job_function_assignments'
  ]
  loop
    execute format(
      'revoke all on public.%I from public, anon, authenticated, service_role',
      relation_name
    );
    execute format(
      'grant select, insert, update, delete on public.%I to lean_hub_private_owner',
      relation_name
    );
    execute format(
      'create policy private_owner_all_%I on public.%I for all to lean_hub_private_owner using (true) with check (true)',
      relation_name,
      relation_name
    );
  end loop;
end
$$;
