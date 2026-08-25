-- Training authoritative operations, validity derivation, and RLS policies.

create or replace function private.can_read_training_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'training.read',
    null,
    null
  )
$$;

create or replace function private.can_manage_training_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'training.catalog.manage',
    null,
    null
  )
$$;

create or replace function private.can_manage_training_curriculum(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'training.curriculum.manage',
    null,
    null
  )
$$;

create or replace function private.can_manage_training_sessions(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'training.sessions.manage',
    null,
    null
  )
$$;

create or replace function private.can_manage_training_completions(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'training.completions.manage',
    null,
    null
  )
$$;

create or replace function private.can_read_training_completion(
  target_organisation_id uuid,
  target_completion_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.training_completions completion_row
    where completion_row.organisation_id = target_organisation_id
      and completion_row.id = target_completion_id
      and (
        private.can_read_training_catalog(target_organisation_id)
        or private.has_scoped_permission(
          target_organisation_id,
          'people.capability.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'people.capability.read',
          completion_row.membership_id,
          null
        )
      )
  )
$$;

create or replace function private.can_read_training_session(
  target_organisation_id uuid,
  target_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.training_sessions session_row
    where session_row.organisation_id = target_organisation_id
      and session_row.id = target_session_id
      and private.can_read_training_catalog(target_organisation_id)
  )
$$;

-- Authoritative validity precedence: requirement override → course version default → no expiry.
create or replace function private.derive_training_validity_days(
  target_validity_days_override integer,
  target_course_version_validity_days integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when target_validity_days_override is not null then target_validity_days_override
    when target_course_version_validity_days is not null then target_course_version_validity_days
    else null
  end
$$;

create or replace function private.derive_training_completion_validity_state(
  target_status text,
  target_expires_at timestamptz,
  target_as_of timestamptz default statement_timestamp(),
  target_expiring_window_days integer default 30
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if target_status <> 'completed' then
    return 'none';
  end if;

  if target_expires_at is null then
    return 'valid';
  end if;

  if target_as_of >= target_expires_at then
    return 'expired';
  end if;

  if target_as_of >= target_expires_at - make_interval(days => target_expiring_window_days) then
    return 'expiring';
  end if;

  return 'valid';
end;
$$;

create or replace function private.create_training_course_draft(
  target_name text,
  target_code text,
  target_category text default null,
  target_description text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_course_id uuid;
  new_version_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course creation is not authorised'
      using errcode = '42501';
  end if;

  new_course_id := private.register_resource_record(
    org_id,
    'training_course',
    gen_random_uuid(),
    actor_membership_id
  );

  insert into public.training_courses (
    id, organisation_id, name, code, category, description, created_by_membership_id
  )
  values (
    new_course_id,
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_category,
    target_description,
    actor_membership_id
  );

  insert into public.training_course_versions (
    organisation_id,
    course_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (org_id, new_course_id, 1, 'draft', actor_membership_id)
  returning id into new_version_id;

  perform private.append_business_audit(
    org_id,
    'training.course.created',
    new_course_id,
    'succeeded',
    jsonb_build_object('version_id', new_version_id)
  );

  return new_course_id;
end;
$$;

create or replace function private.update_training_course_draft_version(
  target_course_version_id uuid,
  target_duration_minutes integer default null,
  target_learning_objectives text default null,
  target_validity_days integer default null,
  target_delivery_method text default null,
  target_trainer_requirements text default null,
  target_evidence_requirements jsonb default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course update is not authorised'
      using errcode = '42501';
  end if;

  update public.training_course_versions version_row
  set
    duration_minutes = target_duration_minutes,
    learning_objectives = target_learning_objectives,
    validity_days = target_validity_days,
    delivery_method = target_delivery_method,
    trainer_requirements = target_trainer_requirements,
    evidence_requirements = target_evidence_requirements
  where version_row.organisation_id = org_id
    and version_row.id = target_course_version_id
    and version_row.status = 'draft';

  if not found then
    raise exception 'draft course version not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.publish_training_course_version(
  target_course_version_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  version_row public.training_course_versions%rowtype;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_catalog(org_id) then
    raise exception 'training course publish is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.training_course_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_course_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft course version not found'
      using errcode = 'P0002';
  end if;

  update public.training_course_versions published_row
  set
    status = 'archived',
    archived_at = statement_timestamp()
  where published_row.organisation_id = org_id
    and published_row.course_id = version_row.course_id
    and published_row.status = 'published';

  update public.training_course_versions version_registry
  set
    status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = actor_membership_id
  where version_registry.organisation_id = org_id
    and version_registry.id = target_course_version_id;

  perform private.enqueue_domain_event(
    org_id,
    version_row.course_id,
    'TrainingCoursePublished',
    target_course_version_id::text,
    jsonb_build_object('course_version_id', target_course_version_id)
  );

  return true;
end;
$$;

create or replace function private.create_training_curriculum_draft(
  target_name text,
  target_code text,
  target_description text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  new_curriculum_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training curriculum creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.training_curricula (
    organisation_id, name, code, description, created_by_membership_id
  )
  values (
    org_id,
    btrim(target_name),
    lower(btrim(target_code)),
    target_description,
    actor_membership_id
  )
  returning id into new_curriculum_id;

  insert into public.training_curriculum_versions (
    organisation_id,
    curriculum_id,
    version_number,
    status,
    created_by_membership_id
  )
  values (org_id, new_curriculum_id, 1, 'draft', actor_membership_id);

  return new_curriculum_id;
end;
$$;

create or replace function private.add_training_requirement(
  target_curriculum_version_id uuid,
  target_course_id uuid,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_applies_to_all_members boolean default false,
  target_mandatory boolean default true,
  target_required_within_days integer default null,
  target_validity_days_override integer default null,
  target_grace_period_days integer default null,
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  new_requirement_id uuid;
begin
  if org_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training requirement creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.training_requirements (
    organisation_id,
    curriculum_version_id,
    course_id,
    job_function_id,
    organisational_unit_id,
    applies_to_all_members,
    mandatory,
    required_within_days,
    validity_days_override,
    grace_period_days,
    notes
  )
  values (
    org_id,
    target_curriculum_version_id,
    target_course_id,
    target_job_function_id,
    target_organisational_unit_id,
    target_applies_to_all_members,
    target_mandatory,
    target_required_within_days,
    target_validity_days_override,
    target_grace_period_days,
    target_notes
  )
  returning id into new_requirement_id;

  perform private.enqueue_domain_event(
    org_id,
    target_course_id,
    'TrainingRequirementChanged',
    new_requirement_id::text,
    jsonb_build_object('curriculum_version_id', target_curriculum_version_id)
  );

  return new_requirement_id;
end;
$$;

create or replace function private.publish_training_curriculum_version(
  target_curriculum_version_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  version_row public.training_curriculum_versions%rowtype;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_curriculum(org_id) then
    raise exception 'training curriculum publish is not authorised'
      using errcode = '42501';
  end if;

  select version_registry.*
  into version_row
  from public.training_curriculum_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_curriculum_version_id
    and version_registry.status = 'draft'
  for update;

  if not found then
    raise exception 'draft curriculum version not found'
      using errcode = 'P0002';
  end if;

  update public.training_curriculum_versions published_row
  set
    status = 'archived',
    archived_at = statement_timestamp()
  where published_row.organisation_id = org_id
    and published_row.curriculum_id = version_row.curriculum_id
    and published_row.status = 'published';

  update public.training_curriculum_versions version_registry
  set
    status = 'published',
    published_at = statement_timestamp(),
    published_by_membership_id = actor_membership_id
  where version_registry.organisation_id = org_id
    and version_registry.id = target_curriculum_version_id;

  return true;
end;
$$;

create or replace function private.record_training_completion_internal(
  target_membership_id uuid,
  target_course_version_id uuid,
  target_completed_at timestamptz,
  target_recorded_by_membership_id uuid,
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_external_certificate_reference text default null,
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  membership_row public.organisation_memberships%rowtype;
  version_row public.training_course_versions%rowtype;
  applied_validity_days integer;
  new_completion_id uuid;
  computed_expires_at timestamptz;
begin
  select membership_registry.*
  into membership_row
  from public.organisation_memberships membership_registry
  where membership_registry.organisation_id = org_id
    and membership_registry.id = target_membership_id;

  if not found or membership_row.organisation_id <> org_id then
    raise exception 'membership not found in organisation'
      using errcode = 'P0002';
  end if;

  select version_registry.*
  into version_row
  from public.training_course_versions version_registry
  where version_registry.organisation_id = org_id
    and version_registry.id = target_course_version_id
    and version_registry.status = 'published';

  if not found then
    raise exception 'published course version not found'
      using errcode = 'P0002';
  end if;

  applied_validity_days := private.derive_training_validity_days(
    target_validity_days_override,
    version_row.validity_days
  );

  if applied_validity_days is not null then
    computed_expires_at := target_completed_at + make_interval(days => applied_validity_days);
  else
    computed_expires_at := null;
  end if;

  new_completion_id := private.register_resource_record(
    org_id,
    'training_completion',
    gen_random_uuid(),
    target_recorded_by_membership_id
  );

  insert into public.training_completions (
    id,
    organisation_id,
    membership_id,
    course_id,
    course_version_id,
    completed_at,
    recorded_by_membership_id,
    trainer_membership_id,
    trainer_name,
    completion_method,
    session_id,
    expires_at,
    validity_days_applied,
    external_certificate_reference,
    notes,
    status
  )
  values (
    new_completion_id,
    org_id,
    target_membership_id,
    version_row.course_id,
    target_course_version_id,
    target_completed_at,
    target_recorded_by_membership_id,
    target_trainer_membership_id,
    target_trainer_name,
    target_completion_method,
    target_session_id,
    computed_expires_at,
    applied_validity_days,
    target_external_certificate_reference,
    target_notes,
    'completed'
  );

  perform private.enqueue_domain_event(
    org_id,
    new_completion_id,
    'TrainingCompleted',
    new_completion_id::text,
    jsonb_build_object(
      'membership_id', target_membership_id,
      'course_id', version_row.course_id,
      'course_version_id', target_course_version_id
    )
  );

  return new_completion_id;
end;
$$;

create or replace function private.record_training_completion(
  target_membership_id uuid,
  target_course_version_id uuid,
  target_completed_at timestamptz default statement_timestamp(),
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_external_certificate_reference text default null,
  target_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_completions(org_id) then
    raise exception 'training completion is not authorised'
      using errcode = '42501';
  end if;

  return private.record_training_completion_internal(
    target_membership_id,
    target_course_version_id,
    target_completed_at,
    actor_membership_id,
    target_trainer_membership_id,
    target_trainer_name,
    target_completion_method,
    target_session_id,
    target_validity_days_override,
    target_external_certificate_reference,
    target_notes
  );
end;
$$;

create or replace function private.bulk_record_training_completions(
  target_membership_ids uuid[],
  target_course_version_id uuid,
  target_completed_at timestamptz default statement_timestamp(),
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_notes text default null
)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  membership_id_item uuid;
  completion_ids uuid[] := '{}';
  new_completion_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_training_completions(org_id) then
    raise exception 'bulk training completion is not authorised'
      using errcode = '42501';
  end if;

  if target_membership_ids is null or cardinality(target_membership_ids) = 0 then
    raise exception 'membership ids are required'
      using errcode = '22023';
  end if;

  foreach membership_id_item in array target_membership_ids
  loop
    new_completion_id := private.record_training_completion_internal(
      membership_id_item,
      target_course_version_id,
      target_completed_at,
      actor_membership_id,
      target_trainer_membership_id,
      target_trainer_name,
      target_completion_method,
      target_session_id,
      target_validity_days_override,
      null,
      target_notes
    );
    completion_ids := array_append(completion_ids, new_completion_id);
  end loop;

  return completion_ids;
end;
$$;

create or replace function private.revoke_training_completion(
  target_completion_id uuid,
  target_notes text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null
    or not private.can_manage_training_completions(org_id) then
    raise exception 'training completion revoke is not authorised'
      using errcode = '42501';
  end if;

  update public.training_completions completion_row
  set
    status = 'revoked',
    notes = coalesce(target_notes, completion_row.notes),
    updated_at = statement_timestamp()
  where completion_row.organisation_id = org_id
    and completion_row.id = target_completion_id
    and completion_row.status = 'completed';

  if not found then
    raise exception 'active completion not found'
      using errcode = 'P0002';
  end if;

  perform private.enqueue_domain_event(
    org_id,
    target_completion_id,
    'TrainingCompletionRevoked',
    target_completion_id::text,
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.membership_has_valid_training_completion(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_course_id uuid,
  target_as_of timestamptz default statement_timestamp()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.training_completions completion_row
    where completion_row.organisation_id = target_organisation_id
      and completion_row.membership_id = target_membership_id
      and completion_row.course_id = target_course_id
      and completion_row.status = 'completed'
      and (
        completion_row.expires_at is null
        or completion_row.expires_at > target_as_of
      )
  )
$$;

-- RLS SELECT policies
create policy training_courses_select
on public.training_courses for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_catalog(organisation_id)
);

create policy training_course_versions_select
on public.training_course_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_catalog(organisation_id)
);

create policy training_curricula_select
on public.training_curricula for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_catalog(organisation_id)
);

create policy training_curriculum_versions_select
on public.training_curriculum_versions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_catalog(organisation_id)
);

create policy training_requirements_select
on public.training_requirements for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_catalog(organisation_id)
);

create policy training_sessions_select
on public.training_sessions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_session(organisation_id, id)
);

create policy training_session_participants_select
on public.training_session_participants for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_session(organisation_id, session_id)
);

create policy training_completions_select
on public.training_completions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_completion(organisation_id, id)
);

create policy training_course_skill_links_select
on public.training_course_skill_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_training_catalog(organisation_id)
);

grant select on public.training_courses to authenticated;
grant select on public.training_course_versions to authenticated;
grant select on public.training_curricula to authenticated;
grant select on public.training_curriculum_versions to authenticated;
grant select on public.training_requirements to authenticated;
grant select on public.training_sessions to authenticated;
grant select on public.training_session_participants to authenticated;
grant select on public.training_completions to authenticated;
grant select on public.training_course_skill_links to authenticated;

create or replace function public.create_training_course_draft(
  target_name text,
  target_code text,
  target_category text default null,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_training_course_draft(target_name, target_code, target_category, target_description) $$;

create or replace function public.update_training_course_draft_version(
  target_course_version_id uuid,
  target_duration_minutes integer default null,
  target_learning_objectives text default null,
  target_validity_days integer default null,
  target_delivery_method text default null,
  target_trainer_requirements text default null,
  target_evidence_requirements jsonb default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.update_training_course_draft_version(
  target_course_version_id,
  target_duration_minutes,
  target_learning_objectives,
  target_validity_days,
  target_delivery_method,
  target_trainer_requirements,
  target_evidence_requirements
) $$;

create or replace function public.publish_training_course_version(target_course_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_training_course_version(target_course_version_id) $$;

create or replace function public.create_training_curriculum_draft(
  target_name text,
  target_code text,
  target_description text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.create_training_curriculum_draft(target_name, target_code, target_description) $$;

create or replace function public.add_training_requirement(
  target_curriculum_version_id uuid,
  target_course_id uuid,
  target_job_function_id uuid default null,
  target_organisational_unit_id uuid default null,
  target_applies_to_all_members boolean default false,
  target_mandatory boolean default true,
  target_required_within_days integer default null,
  target_validity_days_override integer default null,
  target_grace_period_days integer default null,
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.add_training_requirement(
  target_curriculum_version_id,
  target_course_id,
  target_job_function_id,
  target_organisational_unit_id,
  target_applies_to_all_members,
  target_mandatory,
  target_required_within_days,
  target_validity_days_override,
  target_grace_period_days,
  target_notes
) $$;

create or replace function public.publish_training_curriculum_version(target_curriculum_version_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.publish_training_curriculum_version(target_curriculum_version_id) $$;

create or replace function public.record_training_completion(
  target_membership_id uuid,
  target_course_version_id uuid,
  target_completed_at timestamptz default statement_timestamp(),
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_external_certificate_reference text default null,
  target_notes text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_training_completion(
  target_membership_id,
  target_course_version_id,
  target_completed_at,
  target_trainer_membership_id,
  target_trainer_name,
  target_completion_method,
  target_session_id,
  target_validity_days_override,
  target_external_certificate_reference,
  target_notes
) $$;

create or replace function public.bulk_record_training_completions(
  target_membership_ids uuid[],
  target_course_version_id uuid,
  target_completed_at timestamptz default statement_timestamp(),
  target_trainer_membership_id uuid default null,
  target_trainer_name text default null,
  target_completion_method text default null,
  target_session_id uuid default null,
  target_validity_days_override integer default null,
  target_notes text default null
)
returns uuid[]
language sql volatile security definer set search_path = ''
as $$ select private.bulk_record_training_completions(
  target_membership_ids,
  target_course_version_id,
  target_completed_at,
  target_trainer_membership_id,
  target_trainer_name,
  target_completion_method,
  target_session_id,
  target_validity_days_override,
  target_notes
) $$;

create or replace function public.revoke_training_completion(
  target_completion_id uuid,
  target_notes text default null
)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.revoke_training_completion(target_completion_id, target_notes) $$;

create or replace function public.derive_training_completion_validity_state(
  target_status text,
  target_expires_at timestamptz,
  target_as_of timestamptz default statement_timestamp(),
  target_expiring_window_days integer default 30
)
returns text
language sql stable security definer set search_path = ''
as $$ select private.derive_training_completion_validity_state(
  target_status,
  target_expires_at,
  target_as_of,
  target_expiring_window_days
) $$;

grant execute on function public.create_training_course_draft(text, text, text, text) to authenticated;
grant execute on function public.update_training_course_draft_version(
  uuid, integer, text, integer, text, text, jsonb
) to authenticated;
grant execute on function public.publish_training_course_version(uuid) to authenticated;
grant execute on function public.create_training_curriculum_draft(text, text, text) to authenticated;
grant execute on function public.add_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) to authenticated;
grant execute on function public.publish_training_curriculum_version(uuid) to authenticated;
grant execute on function public.record_training_completion(
  uuid, uuid, timestamptz, uuid, text, text, uuid, integer, text, text
) to authenticated;
grant execute on function public.bulk_record_training_completions(
  uuid[], uuid, timestamptz, uuid, text, text, uuid, integer, text
) to authenticated;
grant execute on function public.revoke_training_completion(uuid, text) to authenticated;
grant execute on function public.derive_training_completion_validity_state(
  text, timestamptz, timestamptz, integer
) to authenticated;

revoke all on function public.create_training_course_draft(text, text, text, text) from public, anon;
revoke all on function public.update_training_course_draft_version(
  uuid, integer, text, integer, text, text, jsonb
) from public, anon;
revoke all on function public.publish_training_course_version(uuid) from public, anon;
revoke all on function public.create_training_curriculum_draft(text, text, text) from public, anon;
revoke all on function public.add_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) from public, anon;
revoke all on function public.publish_training_curriculum_version(uuid) from public, anon;
revoke all on function public.record_training_completion(
  uuid, uuid, timestamptz, uuid, text, text, uuid, integer, text, text
) from public, anon;
revoke all on function public.bulk_record_training_completions(
  uuid[], uuid, timestamptz, uuid, text, text, uuid, integer, text
) from public, anon;
revoke all on function public.revoke_training_completion(uuid, text) from public, anon;
revoke all on function public.derive_training_completion_validity_state(
  text, timestamptz, timestamptz, integer
) from public, anon;

alter function private.can_read_training_catalog(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_training_catalog(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_training_curriculum(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_training_sessions(uuid) owner to lean_hub_private_owner;
alter function private.can_manage_training_completions(uuid) owner to lean_hub_private_owner;
alter function private.can_read_training_completion(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_training_session(uuid, uuid) owner to lean_hub_private_owner;
alter function private.derive_training_validity_days(integer, integer) owner to lean_hub_private_owner;
alter function private.derive_training_completion_validity_state(text, timestamptz, timestamptz, integer) owner to lean_hub_private_owner;
alter function private.create_training_course_draft(text, text, text, text) owner to lean_hub_private_owner;
alter function private.update_training_course_draft_version(
  uuid, integer, text, integer, text, text, jsonb
) owner to lean_hub_private_owner;
alter function private.publish_training_course_version(uuid) owner to lean_hub_private_owner;
alter function private.create_training_curriculum_draft(text, text, text) owner to lean_hub_private_owner;
alter function private.add_training_requirement(
  uuid, uuid, uuid, uuid, boolean, boolean, integer, integer, integer, text
) owner to lean_hub_private_owner;
alter function private.publish_training_curriculum_version(uuid) owner to lean_hub_private_owner;
alter function private.record_training_completion_internal(
  uuid, uuid, timestamptz, uuid, uuid, text, text, uuid, integer, text, text
) owner to lean_hub_private_owner;
alter function private.record_training_completion(
  uuid, uuid, timestamptz, uuid, text, text, uuid, integer, text, text
) owner to lean_hub_private_owner;
alter function private.bulk_record_training_completions(
  uuid[], uuid, timestamptz, uuid, text, text, uuid, integer, text
) owner to lean_hub_private_owner;
alter function private.revoke_training_completion(uuid, text) owner to lean_hub_private_owner;
alter function private.membership_has_valid_training_completion(uuid, uuid, uuid, timestamptz) owner to lean_hub_private_owner;
