create table public.training_courses (
  id uuid primary key,
  organisation_id uuid not null,
  name text not null,
  code text not null,
  category text,
  description text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz,
  constraint training_courses_organisation_id_id_key unique (organisation_id, id),
  constraint training_courses_organisation_id_code_key unique (organisation_id, code),
  constraint training_courses_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint training_courses_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_courses_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint training_courses_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint training_courses_status_check
    check (status in ('active', 'deactivated')),
  constraint training_courses_deactivated_check
    check (
      (status = 'active' and deactivated_at is null)
      or (status = 'deactivated' and deactivated_at is not null)
    )
);

create table public.training_course_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  course_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  duration_minutes integer,
  learning_objectives text,
  validity_days integer,
  delivery_method text,
  trainer_requirements text,
  evidence_requirements jsonb,
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint training_course_versions_organisation_id_id_key unique (organisation_id, id),
  constraint training_course_versions_course_version_key
    unique (organisation_id, course_id, version_number),
  constraint training_course_versions_course_fkey
    foreign key (organisation_id, course_id)
    references public.training_courses(organisation_id, id)
    on delete restrict,
  constraint training_course_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_course_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_course_versions_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint training_course_versions_duration_check
    check (duration_minutes is null or duration_minutes > 0),
  constraint training_course_versions_validity_check
    check (validity_days is null or validity_days > 0),
  constraint training_course_versions_delivery_method_check
    check (
      delivery_method is null
      or delivery_method in (
        'classroom',
        'workshop',
        'coaching',
        'practical',
        'online',
        'external',
        'blended'
      )
    ),
  constraint training_course_versions_evidence_check
    check (
      evidence_requirements is null
      or pg_catalog.jsonb_typeof(evidence_requirements) = 'object'
    )
);

create table public.training_curricula (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint training_curricula_organisation_id_id_key unique (organisation_id, id),
  constraint training_curricula_organisation_id_code_key unique (organisation_id, code),
  constraint training_curricula_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_curricula_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint training_curricula_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint training_curricula_status_check
    check (status in ('active', 'deactivated'))
);

create table public.training_curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  curriculum_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint training_curriculum_versions_organisation_id_id_key unique (organisation_id, id),
  constraint training_curriculum_versions_curriculum_version_key
    unique (organisation_id, curriculum_id, version_number),
  constraint training_curriculum_versions_curriculum_fkey
    foreign key (organisation_id, curriculum_id)
    references public.training_curricula(organisation_id, id)
    on delete restrict,
  constraint training_curriculum_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_curriculum_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_curriculum_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.training_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  curriculum_version_id uuid not null,
  course_id uuid not null,
  job_function_id uuid,
  organisational_unit_id uuid,
  applies_to_all_members boolean not null default false,
  mandatory boolean not null default true,
  required_within_days integer,
  validity_days_override integer,
  grace_period_days integer,
  notes text,
  created_at timestamptz not null default statement_timestamp(),
  constraint training_requirements_organisation_id_id_key unique (organisation_id, id),
  constraint training_requirements_version_fkey
    foreign key (organisation_id, curriculum_version_id)
    references public.training_curriculum_versions(organisation_id, id)
    on delete restrict,
  constraint training_requirements_course_fkey
    foreign key (organisation_id, course_id)
    references public.training_courses(organisation_id, id)
    on delete restrict,
  constraint training_requirements_job_function_fkey
    foreign key (organisation_id, job_function_id)
    references public.job_functions(organisation_id, id)
    on delete restrict,
  constraint training_requirements_unit_fkey
    foreign key (organisation_id, organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint training_requirements_target_check
    check (
      applies_to_all_members
      or job_function_id is not null
    ),
  constraint training_requirements_required_within_check
    check (required_within_days is null or required_within_days > 0),
  constraint training_requirements_validity_override_check
    check (validity_days_override is null or validity_days_override > 0),
  constraint training_requirements_grace_period_check
    check (grace_period_days is null or grace_period_days >= 0)
);

create table public.training_sessions (
  id uuid primary key,
  organisation_id uuid not null,
  course_version_id uuid not null,
  title text not null,
  organisational_unit_id uuid,
  trainer_membership_id uuid,
  trainer_name text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  location text,
  online_metadata jsonb,
  capacity integer,
  status text not null default 'scheduled',
  notes text,
  schedule_occurrence_id uuid,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint training_sessions_organisation_id_id_key unique (organisation_id, id),
  constraint training_sessions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint training_sessions_course_version_fkey
    foreign key (organisation_id, course_version_id)
    references public.training_course_versions(organisation_id, id)
    on delete restrict,
  constraint training_sessions_unit_fkey
    foreign key (organisation_id, organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint training_sessions_trainer_fkey
    foreign key (organisation_id, trainer_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_sessions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_sessions_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint training_sessions_status_check
    check (
      status in (
        'scheduled',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  constraint training_sessions_capacity_check
    check (capacity is null or capacity > 0),
  constraint training_sessions_schedule_range_check
    check (
      scheduled_end is null
      or scheduled_start is null
      or scheduled_end >= scheduled_start
    )
);

create table public.training_session_participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  session_id uuid not null,
  membership_id uuid not null,
  status text not null default 'invited',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint training_session_participants_organisation_id_id_key unique (organisation_id, id),
  constraint training_session_participants_session_membership_key
    unique (organisation_id, session_id, membership_id),
  constraint training_session_participants_session_fkey
    foreign key (organisation_id, session_id)
    references public.training_sessions(organisation_id, id)
    on delete restrict,
  constraint training_session_participants_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_session_participants_status_check
    check (
      status in (
        'invited',
        'attended',
        'completed',
        'absent',
        'cancelled'
      )
    )
);

create table public.training_completions (
  id uuid primary key,
  organisation_id uuid not null,
  membership_id uuid not null,
  course_id uuid not null,
  course_version_id uuid not null,
  completed_at timestamptz not null,
  recorded_by_membership_id uuid not null,
  trainer_membership_id uuid,
  trainer_name text,
  completion_method text,
  session_id uuid,
  expires_at timestamptz,
  validity_days_applied integer,
  status text not null default 'completed',
  external_certificate_reference text,
  notes text,
  superseded_by_completion_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint training_completions_organisation_id_id_key unique (organisation_id, id),
  constraint training_completions_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint training_completions_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_completions_course_fkey
    foreign key (organisation_id, course_id)
    references public.training_courses(organisation_id, id)
    on delete restrict,
  constraint training_completions_course_version_fkey
    foreign key (organisation_id, course_version_id)
    references public.training_course_versions(organisation_id, id)
    on delete restrict,
  constraint training_completions_recorded_by_fkey
    foreign key (organisation_id, recorded_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_completions_trainer_fkey
    foreign key (organisation_id, trainer_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint training_completions_session_fkey
    foreign key (organisation_id, session_id)
    references public.training_sessions(organisation_id, id)
    on delete restrict,
  constraint training_completions_superseded_fkey
    foreign key (organisation_id, superseded_by_completion_id)
    references public.training_completions(organisation_id, id)
    on delete restrict,
  constraint training_completions_status_check
    check (status in ('completed', 'revoked', 'superseded')),
  constraint training_completions_completion_method_check
    check (
      completion_method is null
      or completion_method in (
        'classroom',
        'workshop',
        'coaching',
        'practical',
        'online',
        'external',
        'blended',
        'manager_sign_off'
      )
    )
);

create table public.training_course_skill_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  course_id uuid not null,
  skill_id uuid not null,
  notes text,
  created_at timestamptz not null default statement_timestamp(),
  constraint training_course_skill_links_organisation_id_id_key unique (organisation_id, id),
  constraint training_course_skill_links_course_skill_key
    unique (organisation_id, course_id, skill_id),
  constraint training_course_skill_links_course_fkey
    foreign key (organisation_id, course_id)
    references public.training_courses(organisation_id, id)
    on delete restrict
);

create index training_course_versions_course_status_idx
  on public.training_course_versions (organisation_id, course_id, status);

create index training_curriculum_versions_curriculum_status_idx
  on public.training_curriculum_versions (organisation_id, curriculum_id, status);

create index training_requirements_curriculum_version_idx
  on public.training_requirements (organisation_id, curriculum_version_id);

create index training_completions_membership_course_idx
  on public.training_completions (organisation_id, membership_id, course_id, completed_at desc);

create index training_completions_expires_at_idx
  on public.training_completions (organisation_id, expires_at)
  where status = 'completed';

create index training_sessions_course_version_idx
  on public.training_sessions (organisation_id, course_version_id);

create trigger training_courses_prevent_organisation_id_change
before update on public.training_courses
for each row execute function private.prevent_organisation_id_change();

create trigger training_course_versions_prevent_organisation_id_change
before update on public.training_course_versions
for each row execute function private.prevent_organisation_id_change();

create trigger training_curricula_prevent_organisation_id_change
before update on public.training_curricula
for each row execute function private.prevent_organisation_id_change();

create trigger training_curriculum_versions_prevent_organisation_id_change
before update on public.training_curriculum_versions
for each row execute function private.prevent_organisation_id_change();

create trigger training_requirements_prevent_organisation_id_change
before update on public.training_requirements
for each row execute function private.prevent_organisation_id_change();

create trigger training_sessions_prevent_organisation_id_change
before update on public.training_sessions
for each row execute function private.prevent_organisation_id_change();

create trigger training_session_participants_prevent_organisation_id_change
before update on public.training_session_participants
for each row execute function private.prevent_organisation_id_change();

create trigger training_completions_prevent_organisation_id_change
before update on public.training_completions
for each row execute function private.prevent_organisation_id_change();

create trigger training_course_skill_links_prevent_organisation_id_change
before update on public.training_course_skill_links
for each row execute function private.prevent_organisation_id_change();

alter table public.training_courses enable row level security;
alter table public.training_courses force row level security;
alter table public.training_course_versions enable row level security;
alter table public.training_course_versions force row level security;
alter table public.training_curricula enable row level security;
alter table public.training_curricula force row level security;
alter table public.training_curriculum_versions enable row level security;
alter table public.training_curriculum_versions force row level security;
alter table public.training_requirements enable row level security;
alter table public.training_requirements force row level security;
alter table public.training_sessions enable row level security;
alter table public.training_sessions force row level security;
alter table public.training_session_participants enable row level security;
alter table public.training_session_participants force row level security;
alter table public.training_completions enable row level security;
alter table public.training_completions force row level security;
alter table public.training_course_skill_links enable row level security;
alter table public.training_course_skill_links force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'training_courses',
    'training_course_versions',
    'training_curricula',
    'training_curriculum_versions',
    'training_requirements',
    'training_sessions',
    'training_session_participants',
    'training_completions',
    'training_course_skill_links'
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
