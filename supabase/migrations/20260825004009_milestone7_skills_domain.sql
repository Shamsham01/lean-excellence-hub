create table public.skill_proficiency_scales (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  name text not null,
  description text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint skill_proficiency_scales_organisation_id_id_key unique (organisation_id, id),
  constraint skill_proficiency_scales_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_proficiency_scales_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint skill_proficiency_scales_status_check
    check (status in ('active', 'deactivated'))
);

create table public.skill_proficiency_scale_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  scale_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint skill_proficiency_scale_versions_organisation_id_id_key unique (organisation_id, id),
  constraint skill_proficiency_scale_versions_scale_version_key
    unique (organisation_id, scale_id, version_number),
  constraint skill_proficiency_scale_versions_scale_fkey
    foreign key (organisation_id, scale_id)
    references public.skill_proficiency_scales(organisation_id, id)
    on delete restrict,
  constraint skill_proficiency_scale_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_proficiency_scale_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_proficiency_scale_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.skill_proficiency_levels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  scale_version_id uuid not null,
  order_value integer not null,
  label text not null,
  description text,
  semantic_token text,
  guidance text,
  created_at timestamptz not null default statement_timestamp(),
  constraint skill_proficiency_levels_organisation_id_id_key unique (organisation_id, id),
  constraint skill_proficiency_levels_version_order_key
    unique (organisation_id, scale_version_id, order_value),
  constraint skill_proficiency_levels_version_fkey
    foreign key (organisation_id, scale_version_id)
    references public.skill_proficiency_scale_versions(organisation_id, id)
    on delete restrict,
  constraint skill_proficiency_levels_label_check
    check (label = btrim(label) and char_length(label) between 1 and 120),
  constraint skill_proficiency_levels_order_check check (order_value >= 0)
);

create table public.skills (
  id uuid primary key,
  organisation_id uuid not null,
  name text not null,
  code text not null,
  category text,
  description text,
  evidence_expectations text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz,
  constraint skills_organisation_id_id_key unique (organisation_id, id),
  constraint skills_organisation_id_code_key unique (organisation_id, code),
  constraint skills_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint skills_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skills_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint skills_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint skills_status_check
    check (status in ('active', 'deactivated')),
  constraint skills_deactivated_check
    check (
      (status = 'active' and deactivated_at is null)
      or (status = 'deactivated' and deactivated_at is not null)
    )
);

create table public.skill_capability_sets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint skill_capability_sets_organisation_id_id_key unique (organisation_id, id),
  constraint skill_capability_sets_organisation_id_code_key unique (organisation_id, code),
  constraint skill_capability_sets_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_capability_sets_name_check
    check (name = btrim(name) and char_length(name) between 1 and 160),
  constraint skill_capability_sets_code_check
    check (
      code = lower(code)
      and code ~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    ),
  constraint skill_capability_sets_status_check
    check (status in ('active', 'deactivated'))
);

create table public.skill_capability_set_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  capability_set_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  published_by_membership_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint skill_capability_set_versions_organisation_id_id_key unique (organisation_id, id),
  constraint skill_capability_set_versions_set_version_key
    unique (organisation_id, capability_set_id, version_number),
  constraint skill_capability_set_versions_set_fkey
    foreign key (organisation_id, capability_set_id)
    references public.skill_capability_sets(organisation_id, id)
    on delete restrict,
  constraint skill_capability_set_versions_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_capability_set_versions_publisher_fkey
    foreign key (organisation_id, published_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint skill_capability_set_versions_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table public.skill_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  capability_set_version_id uuid not null,
  skill_id uuid not null,
  job_function_id uuid,
  organisational_unit_id uuid,
  proficiency_scale_version_id uuid not null,
  target_proficiency_level_id uuid not null,
  mandatory boolean not null default true,
  evidence_requirement text,
  notes text,
  created_at timestamptz not null default statement_timestamp(),
  constraint skill_requirements_organisation_id_id_key unique (organisation_id, id),
  constraint skill_requirements_version_fkey
    foreign key (organisation_id, capability_set_version_id)
    references public.skill_capability_set_versions(organisation_id, id)
    on delete restrict,
  constraint skill_requirements_skill_fkey
    foreign key (organisation_id, skill_id)
    references public.skills(organisation_id, id)
    on delete restrict,
  constraint skill_requirements_job_function_fkey
    foreign key (organisation_id, job_function_id)
    references public.job_functions(organisation_id, id)
    on delete restrict,
  constraint skill_requirements_unit_fkey
    foreign key (organisation_id, organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint skill_requirements_scale_version_fkey
    foreign key (organisation_id, proficiency_scale_version_id)
    references public.skill_proficiency_scale_versions(organisation_id, id)
    on delete restrict,
  constraint skill_requirements_target_level_fkey
    foreign key (organisation_id, target_proficiency_level_id)
    references public.skill_proficiency_levels(organisation_id, id)
    on delete restrict,
  constraint skill_requirements_job_function_check
    check (job_function_id is not null)
);

create table public.membership_skill_assessments (
  id uuid primary key,
  organisation_id uuid not null,
  membership_id uuid not null,
  skill_id uuid not null,
  proficiency_scale_version_id uuid not null,
  proficiency_level_id uuid not null,
  assertion_type text not null,
  is_authoritative boolean not null default false,
  assessed_at timestamptz not null,
  assessor_membership_id uuid,
  organisational_unit_id uuid,
  assessment_method text,
  valid_until timestamptz,
  status text not null default 'active',
  notes text,
  supersedes_assessment_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint membership_skill_assessments_organisation_id_id_key unique (organisation_id, id),
  constraint membership_skill_assessments_resource_fkey
    foreign key (organisation_id, id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_skill_fkey
    foreign key (organisation_id, skill_id)
    references public.skills(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_scale_version_fkey
    foreign key (organisation_id, proficiency_scale_version_id)
    references public.skill_proficiency_scale_versions(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_level_fkey
    foreign key (organisation_id, proficiency_level_id)
    references public.skill_proficiency_levels(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_assessor_fkey
    foreign key (organisation_id, assessor_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_unit_fkey
    foreign key (organisation_id, organisational_unit_id)
    references public.organisation_units(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_supersedes_fkey
    foreign key (organisation_id, supersedes_assessment_id)
    references public.membership_skill_assessments(organisation_id, id)
    on delete restrict,
  constraint membership_skill_assessments_assertion_type_check
    check (assertion_type in ('self_assessed', 'validated')),
  constraint membership_skill_assessments_authoritative_check
    check (
      (assertion_type = 'validated' and is_authoritative = true)
      or (assertion_type = 'self_assessed' and is_authoritative = false)
    ),
  constraint membership_skill_assessments_status_check
    check (status in ('active', 'superseded', 'revoked')),
  constraint membership_skill_assessments_method_check
    check (
      assessment_method is null
      or assessment_method in (
        'manager_assessment',
        'practical_observation',
        'qualification',
        'self_assessment',
        'trainer_sign_off',
        'external_certification'
      )
    )
);

alter table public.training_course_skill_links
  add constraint training_course_skill_links_skill_fkey
  foreign key (organisation_id, skill_id)
  references public.skills(organisation_id, id)
  on delete restrict;

create index membership_skill_assessments_membership_skill_idx
  on public.membership_skill_assessments (organisation_id, membership_id, skill_id, assessed_at desc);

create index skill_proficiency_levels_scale_version_idx
  on public.skill_proficiency_levels (organisation_id, scale_version_id, order_value);

create index skill_requirements_capability_version_idx
  on public.skill_requirements (organisation_id, capability_set_version_id);

create trigger skill_proficiency_scales_prevent_organisation_id_change
before update on public.skill_proficiency_scales
for each row execute function private.prevent_organisation_id_change();

create trigger skill_proficiency_scale_versions_prevent_organisation_id_change
before update on public.skill_proficiency_scale_versions
for each row execute function private.prevent_organisation_id_change();

create trigger skill_proficiency_levels_prevent_organisation_id_change
before update on public.skill_proficiency_levels
for each row execute function private.prevent_organisation_id_change();

create trigger skills_prevent_organisation_id_change
before update on public.skills
for each row execute function private.prevent_organisation_id_change();

create trigger skill_capability_sets_prevent_organisation_id_change
before update on public.skill_capability_sets
for each row execute function private.prevent_organisation_id_change();

create trigger skill_capability_set_versions_prevent_organisation_id_change
before update on public.skill_capability_set_versions
for each row execute function private.prevent_organisation_id_change();

create trigger skill_requirements_prevent_organisation_id_change
before update on public.skill_requirements
for each row execute function private.prevent_organisation_id_change();

create trigger membership_skill_assessments_prevent_organisation_id_change
before update on public.membership_skill_assessments
for each row execute function private.prevent_organisation_id_change();

alter table public.skill_proficiency_scales enable row level security;
alter table public.skill_proficiency_scales force row level security;
alter table public.skill_proficiency_scale_versions enable row level security;
alter table public.skill_proficiency_scale_versions force row level security;
alter table public.skill_proficiency_levels enable row level security;
alter table public.skill_proficiency_levels force row level security;
alter table public.skills enable row level security;
alter table public.skills force row level security;
alter table public.skill_capability_sets enable row level security;
alter table public.skill_capability_sets force row level security;
alter table public.skill_capability_set_versions enable row level security;
alter table public.skill_capability_set_versions force row level security;
alter table public.skill_requirements enable row level security;
alter table public.skill_requirements force row level security;
alter table public.membership_skill_assessments enable row level security;
alter table public.membership_skill_assessments force row level security;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'skill_proficiency_scales',
    'skill_proficiency_scale_versions',
    'skill_proficiency_levels',
    'skills',
    'skill_capability_sets',
    'skill_capability_set_versions',
    'skill_requirements',
    'membership_skill_assessments'
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
