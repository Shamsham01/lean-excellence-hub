-- Spec B: unit-scoped skill/training requirements, matrix RPCs, and compliance subtree honouring.

do $$
declare
  duplicate_keys text;
begin
  if current_setting('server_version_num')::integer < 170000 then
    raise exception 'Postgres 17 or newer is required for NULLS NOT DISTINCT unique indexes'
      using errcode = '22023';
  end if;

  select string_agg(distinct payload.offending_key, ', ' order by payload.offending_key)
  into duplicate_keys
  from (
    select format(
      'skill_requirements:%s:%s:%s:%s:%s',
      skill_row.organisation_id,
      skill_row.capability_set_version_id,
      skill_row.skill_id,
      skill_row.job_function_id,
      coalesce(skill_row.organisational_unit_id::text, 'org-wide')
    ) as offending_key
    from public.skill_requirements skill_row
    group by
      skill_row.organisation_id,
      skill_row.capability_set_version_id,
      skill_row.skill_id,
      skill_row.job_function_id,
      skill_row.organisational_unit_id
    having count(*) > 1
    union all
    select format(
      'training_requirements:%s:%s:%s:%s:%s:%s',
      training_row.organisation_id,
      training_row.curriculum_version_id,
      training_row.course_id,
      coalesce(training_row.job_function_id::text, 'any-job'),
      training_row.applies_to_all_members,
      coalesce(training_row.organisational_unit_id::text, 'org-wide')
    )
    from public.training_requirements training_row
    group by
      training_row.organisation_id,
      training_row.curriculum_version_id,
      training_row.course_id,
      training_row.job_function_id,
      training_row.applies_to_all_members,
      training_row.organisational_unit_id
    having count(*) > 1
  ) payload;

  if duplicate_keys is not null then
    raise exception 'duplicate scoped requirement keys exist: %', duplicate_keys
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists skill_requirements_scope_unique_idx
  on public.skill_requirements (
    organisation_id,
    capability_set_version_id,
    skill_id,
    job_function_id,
    organisational_unit_id
  )
  nulls not distinct;

create unique index if not exists training_requirements_scope_unique_idx
  on public.training_requirements (
    organisation_id,
    curriculum_version_id,
    course_id,
    job_function_id,
    applies_to_all_members,
    organisational_unit_id
  )
  nulls not distinct;

create or replace function private.requirement_unit_applies(
  target_organisation_id uuid,
  requirement_unit_id uuid,
  person_unit_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    case
      when requirement_unit_id is null then true
      when person_unit_id is null then false
      else exists (
        select 1
        from public.organisation_unit_closure closure_row
        where closure_row.organisation_id = target_organisation_id
          and closure_row.ancestor_unit_id = requirement_unit_id
          and closure_row.descendant_unit_id = person_unit_id
      )
    end
$$;

create or replace function private.resolve_effective_skill_requirement(
  target_organisation_id uuid,
  target_capability_set_version_id uuid,
  target_skill_id uuid,
  target_job_function_id uuid,
  target_person_unit_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  effective_target_order integer;
  org_wide_target_order integer;
  effective_id uuid;
  effective_requirement public.skill_requirements;
  org_wide_requirement public.skill_requirements;
  effective_below_org boolean := false;
begin
  -- Precedence (org-wide vs unit depth vs target order) mirrors training resolver below.

  with candidates as (
    select
      requirement_row.*,
      level_row.order_value as target_order,
      case
        when requirement_row.organisational_unit_id is null then 1
        else 0
      end as org_wide_rank,
      coalesce(
        (
          select min(closure_row.depth)
          from public.organisation_unit_closure closure_row
          where closure_row.organisation_id = target_organisation_id
            and closure_row.ancestor_unit_id = requirement_row.organisational_unit_id
            and closure_row.descendant_unit_id = target_person_unit_id
        ),
        2147483647
      ) as unit_depth
    from public.skill_requirements requirement_row
    join public.skill_proficiency_levels level_row
      on level_row.organisation_id = requirement_row.organisation_id
     and level_row.id = requirement_row.target_proficiency_level_id
    where requirement_row.organisation_id = target_organisation_id
      and requirement_row.capability_set_version_id = target_capability_set_version_id
      and requirement_row.skill_id = target_skill_id
      and requirement_row.job_function_id = target_job_function_id
      and private.requirement_unit_applies(
        target_organisation_id,
        requirement_row.organisational_unit_id,
        target_person_unit_id
      )
  ),
  ranked as (
    select
      candidate_row.*,
      row_number() over (
        order by
          candidate_row.org_wide_rank asc,
          candidate_row.unit_depth asc,
          candidate_row.target_order desc,
          candidate_row.id
      ) as precedence_rank
    from candidates candidate_row
  )
  select ranked.id
  into effective_id
  from ranked
  where ranked.precedence_rank = 1;

  if not found or effective_id is null then
    return null;
  end if;

  select requirement_row.*
  into effective_requirement
  from public.skill_requirements requirement_row
  where requirement_row.id = effective_id;

  select candidate_row.*
  into org_wide_requirement
  from (
    select requirement_row.*
    from public.skill_requirements requirement_row
    where requirement_row.organisation_id = target_organisation_id
      and requirement_row.capability_set_version_id = target_capability_set_version_id
      and requirement_row.skill_id = target_skill_id
      and requirement_row.job_function_id = target_job_function_id
      and requirement_row.organisational_unit_id is null
    order by (
      select level_row.order_value
      from public.skill_proficiency_levels level_row
      where level_row.organisation_id = requirement_row.organisation_id
        and level_row.id = requirement_row.target_proficiency_level_id
    ) desc,
    requirement_row.id
    limit 1
  ) candidate_row;

  if org_wide_requirement.id is null
    or org_wide_requirement.id = effective_requirement.id then
    return jsonb_build_object(
      'effective_requirement', to_jsonb(effective_requirement),
      'org_wide_requirement', null,
      'effective_below_org', false
    );
  end if;

  select level_row.order_value
  into effective_target_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = target_organisation_id
    and level_row.id = effective_requirement.target_proficiency_level_id;

  select level_row.order_value
  into org_wide_target_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = target_organisation_id
    and level_row.id = org_wide_requirement.target_proficiency_level_id;

  effective_below_org := coalesce(effective_target_order, 0)
    < coalesce(org_wide_target_order, 0);

  return jsonb_build_object(
    'effective_requirement', to_jsonb(effective_requirement),
    'org_wide_requirement', to_jsonb(org_wide_requirement),
    'effective_below_org', effective_below_org,
    'org_wide_target_order', org_wide_target_order
  );
end;
$$;

create or replace function private.resolve_effective_training_requirement(
  target_organisation_id uuid,
  target_curriculum_version_id uuid,
  target_course_id uuid,
  target_job_function_id uuid,
  target_person_unit_id uuid
)
returns public.training_requirements
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved public.training_requirements%rowtype;
  resolved_id uuid;
begin
  -- Precedence mirrors private.resolve_effective_skill_requirement (unit depth vs org-wide).

  select winner.id
  into resolved_id
  from (
    with candidates as (
      select
        requirement_row.id,
        case
          when requirement_row.organisational_unit_id is null then 1
          else 0
        end as org_wide_rank,
        coalesce(
          (
            select min(closure_row.depth)
            from public.organisation_unit_closure closure_row
            where closure_row.organisation_id = target_organisation_id
              and closure_row.ancestor_unit_id = requirement_row.organisational_unit_id
              and closure_row.descendant_unit_id = target_person_unit_id
          ),
          2147483647
        ) as unit_depth,
        requirement_row.mandatory,
        requirement_row.validity_days_override
      from public.training_requirements requirement_row
      where requirement_row.organisation_id = target_organisation_id
        and requirement_row.curriculum_version_id = target_curriculum_version_id
        and requirement_row.course_id = target_course_id
        and (
          requirement_row.applies_to_all_members
          or requirement_row.job_function_id = target_job_function_id
        )
        and private.requirement_unit_applies(
          target_organisation_id,
          requirement_row.organisational_unit_id,
          target_person_unit_id
        )
    )
    select candidates.id
    from candidates
    order by
      org_wide_rank asc,
      unit_depth asc,
      mandatory desc,
      validity_days_override asc nulls last,
      id
    limit 1
  ) winner;

  if resolved_id is null then
    return null;
  end if;

  select requirement_row.*
  into resolved
  from public.training_requirements requirement_row
  where requirement_row.id = resolved_id;

  return resolved;
end;
$$;

create or replace function private.build_skill_gap_from_resolution(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_skill_id uuid,
  target_resolution jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requirement_row public.skill_requirements%rowtype;
  org_wide_row public.skill_requirements%rowtype;
  effective_below_org boolean := false;
  org_wide_target_order integer;
  current_assessment public.membership_skill_assessments%rowtype;
  current_order integer;
  target_order integer;
begin
  if target_resolution is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  requirement_row := jsonb_populate_record(
    null::public.skill_requirements,
    target_resolution -> 'effective_requirement'
  );
  if target_resolution -> 'org_wide_requirement' is not null
    and target_resolution -> 'org_wide_requirement' <> 'null'::jsonb then
    org_wide_row := jsonb_populate_record(
      null::public.skill_requirements,
      target_resolution -> 'org_wide_requirement'
    );
  end if;
  effective_below_org := coalesce((target_resolution ->> 'effective_below_org')::boolean, false);
  org_wide_target_order := nullif(target_resolution ->> 'org_wide_target_order', '')::integer;

  if requirement_row.id is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  current_assessment := private.get_current_authoritative_skill_assessment(
    target_organisation_id,
    target_membership_id,
    target_skill_id
  );

  select level_row.order_value
  into target_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = target_organisation_id
    and level_row.id = requirement_row.target_proficiency_level_id;

  if org_wide_target_order is null and org_wide_row.id is not null then
    select level_row.order_value
    into org_wide_target_order
    from public.skill_proficiency_levels level_row
    where level_row.organisation_id = target_organisation_id
      and level_row.id = org_wide_row.target_proficiency_level_id;
  end if;

  if current_assessment.id is null then
    return jsonb_build_object(
      'status', 'not_assessed',
      'target_order', target_order,
      'target_scale_version_id', requirement_row.proficiency_scale_version_id,
      'effective_requirement_id', requirement_row.id,
      'org_wide_requirement_id', org_wide_row.id,
      'org_wide_target_order', org_wide_target_order,
      'effective_below_org', effective_below_org
    );
  end if;

  if current_assessment.proficiency_scale_version_id
    <> requirement_row.proficiency_scale_version_id then
    return jsonb_build_object(
      'status', 'incompatible_scale',
      'target_scale_version_id', requirement_row.proficiency_scale_version_id,
      'assessment_scale_version_id', current_assessment.proficiency_scale_version_id,
      'effective_requirement_id', requirement_row.id,
      'org_wide_requirement_id', org_wide_row.id,
      'org_wide_target_order', org_wide_target_order,
      'effective_below_org', effective_below_org
    );
  end if;

  select level_row.order_value
  into current_order
  from public.skill_proficiency_levels level_row
  where level_row.organisation_id = target_organisation_id
    and level_row.id = current_assessment.proficiency_level_id;

  return jsonb_build_object(
    'status',
      case
        when current_order < target_order then 'below_requirement'
        when current_order = target_order then 'meets_requirement'
        else 'above_requirement'
      end,
    'current_order', current_order,
    'target_order', target_order,
    'gap', greatest(target_order - current_order, 0),
    'scale_version_id', requirement_row.proficiency_scale_version_id,
    'current_assessment_id', current_assessment.id,
    'effective_requirement_id', requirement_row.id,
    'org_wide_requirement_id', org_wide_row.id,
    'org_wide_target_order', org_wide_target_order,
    'effective_below_org', effective_below_org
  );
end;
$$;

create or replace function private.derive_skill_gap(
  target_membership_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  capability_version_id uuid;
  assignment_job_function_id uuid;
  assignment_person_unit_id uuid;
  resolution jsonb;
begin
  if org_id is null
    or not exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.organisation_id = org_id
        and membership_row.id = target_membership_id
        and membership_row.status = 'active'
    ) then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if not coalesce(
    private.can_read_membership_capability_profile(org_id, target_membership_id)
    or (
      private.is_current_active_membership(org_id, target_membership_id)
      and target_capability_set_version_id is null
    ),
    false
  ) then
    raise exception 'skill gap derivation is not authorised'
      using errcode = '42501';
  end if;

  if target_capability_set_version_id is not null then
    capability_version_id := target_capability_set_version_id;
  else
    select version_row.id
    into capability_version_id
    from public.skill_capability_set_versions version_row
    join public.skill_capability_sets set_row
      on set_row.organisation_id = version_row.organisation_id
     and set_row.id = version_row.capability_set_id
    where version_row.organisation_id = org_id
      and version_row.status = 'published'
      and set_row.status = 'active'
    order by version_row.published_at desc nulls last
    limit 1;
  end if;

  if capability_version_id is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  select
    assignment_row.job_function_id,
    assignment_row.organisational_unit_id
  into
    assignment_job_function_id,
    assignment_person_unit_id
  from public.membership_job_function_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.membership_id = target_membership_id
    and assignment_row.is_primary = true
    and assignment_row.valid_from <= statement_timestamp()
    and (
      assignment_row.valid_to is null
      or assignment_row.valid_to > statement_timestamp()
    );

  if assignment_job_function_id is null then
    return jsonb_build_object('status', 'not_required');
  end if;

  resolution := private.resolve_effective_skill_requirement(
    org_id,
    capability_version_id,
    target_skill_id,
    assignment_job_function_id,
    assignment_person_unit_id
  );

  return private.build_skill_gap_from_resolution(
    org_id,
    target_membership_id,
    target_skill_id,
    resolution
  );
end;
$$;

create or replace function public.derive_skill_gap(
  target_membership_id uuid,
  target_skill_id uuid,
  target_capability_set_version_id uuid default null
)
returns jsonb
language sql stable security definer set search_path = ''
as $$ select private.derive_skill_gap(
  target_membership_id, target_skill_id, target_capability_set_version_id
) $$;

grant execute on function public.derive_skill_gap(uuid, uuid, uuid) to authenticated;
revoke all on function public.derive_skill_gap(uuid, uuid, uuid) from public, anon;

create or replace function public.get_training_compliance_summary(
  target_unit_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  resolved_curriculum_version_id uuid;
  total_required integer := 0;
  satisfied integer := 0;
  expiring_count integer := 0;
begin
  if org_id is null
    or not private.can_read_training_catalog(org_id) then
    raise exception 'training compliance summary is not authorised'
      using errcode = '42501';
  end if;

  if target_unit_id is not null
    and not private.has_scoped_permission(org_id, 'training.read', null, null)
    and not private.has_scoped_permission(org_id, 'training.read', null, target_unit_id) then
    raise exception 'training compliance summary is not authorised for this unit'
      using errcode = '42501';
  end if;

  resolved_curriculum_version_id :=
    private.get_published_training_curriculum_version_id(org_id);

  if resolved_curriculum_version_id is null then
    return jsonb_build_object(
      'compliance_percent', null,
      'outstanding_required', 0,
      'expiring_in_30_days', 0
    );
  end if;

  with active_memberships as (
    select
      membership_row.id as membership_id,
      assignment_row.job_function_id,
      assignment_row.organisational_unit_id as person_unit_id
    from public.organisation_memberships membership_row
    left join public.membership_job_function_assignments assignment_row
      on assignment_row.organisation_id = org_id
     and assignment_row.membership_id = membership_row.id
     and assignment_row.is_primary = true
     and assignment_row.valid_from <= statement_timestamp()
     and (
       assignment_row.valid_to is null
       or assignment_row.valid_to > statement_timestamp()
     )
    where membership_row.organisation_id = org_id
      and membership_row.status = 'active'
      and (
        target_unit_id is null
        or exists (
          select 1
          from public.organisation_unit_closure closure_row
          where closure_row.organisation_id = org_id
            and closure_row.ancestor_unit_id = target_unit_id
            and closure_row.descendant_unit_id = assignment_row.organisational_unit_id
        )
      )
  ),
  applicable_requirements as (
    select distinct
      membership_row.membership_id,
      (resolved.resolved_requirement).id as requirement_id,
      (resolved.resolved_requirement).course_id,
      (resolved.resolved_requirement).mandatory
    from active_memberships membership_row
    cross join (
      select distinct requirement_row.course_id
      from public.training_requirements requirement_row
      where requirement_row.organisation_id = org_id
        and requirement_row.curriculum_version_id = resolved_curriculum_version_id
        and requirement_row.mandatory = true
    ) mandatory_courses
    cross join lateral (
      select private.resolve_effective_training_requirement(
        org_id,
        resolved_curriculum_version_id,
        mandatory_courses.course_id,
        membership_row.job_function_id,
        membership_row.person_unit_id
      ) as resolved_requirement
    ) resolved
    where (resolved.resolved_requirement).id is not null
      and (resolved.resolved_requirement).mandatory
  ),
  requirement_status as (
    select
      applicable_row.membership_id,
      applicable_row.requirement_id,
      private.membership_has_valid_training_completion(
        org_id,
        applicable_row.membership_id,
        applicable_row.course_id
      ) as is_satisfied,
      exists (
        select 1
        from public.training_completions completion_row
        where completion_row.organisation_id = org_id
          and completion_row.membership_id = applicable_row.membership_id
          and completion_row.course_id = applicable_row.course_id
          and completion_row.status = 'completed'
          and completion_row.expires_at is not null
          and completion_row.expires_at > statement_timestamp()
          and completion_row.expires_at <= statement_timestamp() + interval '30 days'
      ) as is_expiring
    from applicable_requirements applicable_row
  )
  select
    count(*)::integer,
    count(*) filter (where is_satisfied)::integer,
    count(*) filter (where is_expiring)::integer
  into total_required, satisfied, expiring_count
  from requirement_status;

  return jsonb_build_object(
    'compliance_percent',
    case
      when total_required = 0 then null
      else round((satisfied::numeric / total_required::numeric) * 100, 1)
    end,
    'outstanding_required', total_required - satisfied,
    'expiring_in_30_days', expiring_count
  );
end;
$$;

create or replace function private.get_skills_matrix(
  target_page integer default 1,
  target_page_size integer default 50,
  target_unit_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  effective_page_size integer;
  effective_page integer;
  offset_value integer;
  capability_version_id uuid;
begin
  if org_id is null or not private.can_read_skills_catalog(org_id) then
    raise exception 'skills matrix is not authorised'
      using errcode = '42501';
  end if;

  if target_unit_id is not null
    and not private.has_scoped_permission(org_id, 'skills.read', null, null)
    and not private.has_scoped_permission(org_id, 'skills.read', null, target_unit_id) then
    raise exception 'skills matrix is not authorised for this unit'
      using errcode = '42501';
  end if;

  effective_page_size := least(greatest(coalesce(target_page_size, 50), 1), 100);
  effective_page :=
    greatest(least(greatest(coalesce(target_page, 1), 1), 1000000), 1);
  offset_value := (effective_page - 1) * effective_page_size;

  select version_row.id
  into capability_version_id
  from public.skill_capability_set_versions version_row
  join public.skill_capability_sets set_row
    on set_row.organisation_id = version_row.organisation_id
   and set_row.id = version_row.capability_set_id
  where version_row.organisation_id = org_id
    and version_row.status = 'published'
    and set_row.status = 'active'
  order by version_row.published_at desc nulls last
  limit 1;

  return (
    with eligible_people as (
      select
        membership_row.id as membership_id,
        coalesce(membership_row.display_name, profile_row.display_name) as display_name,
        assignment_row.job_function_id,
        assignment_row.organisational_unit_id as person_unit_id
      from public.organisation_memberships membership_row
      left join public.profiles profile_row
        on profile_row.user_id = membership_row.user_id
      left join public.membership_job_function_assignments assignment_row
        on assignment_row.organisation_id = org_id
       and assignment_row.membership_id = membership_row.id
       and assignment_row.is_primary = true
       and assignment_row.valid_from <= statement_timestamp()
       and (
         assignment_row.valid_to is null
         or assignment_row.valid_to > statement_timestamp()
       )
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and private.can_read_membership_capability_profile(org_id, membership_row.id)
        and (
          target_unit_id is null
          or exists (
            select 1
            from public.organisation_unit_closure closure_row
            where closure_row.organisation_id = org_id
              and closure_row.ancestor_unit_id = target_unit_id
              and closure_row.descendant_unit_id = assignment_row.organisational_unit_id
          )
        )
    ),
    paged_people as (
      select *
      from eligible_people
      order by display_name nulls last, membership_id
      offset offset_value
      limit effective_page_size
    ),
    required_skills as (
      select distinct skill_row.id, skill_row.name
      from paged_people people_row
      join public.skill_requirements requirement_row
        on requirement_row.organisation_id = org_id
       and requirement_row.capability_set_version_id = capability_version_id
      join public.skills skill_row
        on skill_row.organisation_id = org_id
       and skill_row.id = requirement_row.skill_id
      where people_row.job_function_id = requirement_row.job_function_id
        and private.requirement_unit_applies(
          org_id,
          requirement_row.organisational_unit_id,
          people_row.person_unit_id
        )
    )
    select jsonb_build_object(
      'people', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', people_row.membership_id,
              'display_name', people_row.display_name
            )
            order by people_row.display_name nulls last, people_row.membership_id
          )
          from paged_people people_row
        ),
        '[]'::jsonb
      ),
      'skills', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('id', skill_row.id, 'name', skill_row.name)
            order by skill_row.name
          )
          from required_skills skill_row
        ),
        '[]'::jsonb
      ),
      'gaps', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', cell_row.membership_id,
              'skill_id', cell_row.skill_id,
              'gap', cell_row.gap
            )
          )
          from (
            select
              people_row.membership_id,
              skill_row.id as skill_id,
              private.build_skill_gap_from_resolution(
                org_id,
                people_row.membership_id,
                skill_row.id,
                private.resolve_effective_skill_requirement(
                  org_id,
                  capability_version_id,
                  skill_row.id,
                  people_row.job_function_id,
                  people_row.person_unit_id
                )
              ) as gap
            from paged_people people_row
            join required_skills skill_row on true
          ) cell_row
        ),
        '[]'::jsonb
      ),
      'total_people', (select count(*)::integer from eligible_people),
      'page', effective_page,
      'page_size', effective_page_size
    )
  );
end;
$$;

create or replace function public.get_skills_matrix(
  target_page integer default 1,
  target_page_size integer default 50,
  target_unit_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_skills_matrix(target_page, target_page_size, target_unit_id)
$$;

create or replace function private.get_training_matrix(
  target_page integer default 1,
  target_page_size integer default 50,
  target_unit_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  effective_page_size integer;
  effective_page integer;
  offset_value integer;
  curriculum_version_id uuid;
begin
  if org_id is null or not private.can_read_training_catalog(org_id) then
    raise exception 'training matrix is not authorised'
      using errcode = '42501';
  end if;

  if target_unit_id is not null
    and not private.has_scoped_permission(org_id, 'people.capability.read', null, null)
    and not private.has_scoped_permission(
      org_id,
      'people.capability.read',
      null,
      target_unit_id
    ) then
    raise exception 'training matrix is not authorised for this unit'
      using errcode = '42501';
  end if;

  curriculum_version_id := private.get_published_training_curriculum_version_id(org_id);
  effective_page_size := least(greatest(coalesce(target_page_size, 50), 1), 100);
  effective_page :=
    greatest(least(greatest(coalesce(target_page, 1), 1), 1000000), 1);
  offset_value := (effective_page - 1) * effective_page_size;

  return (
    with eligible_people as (
      select
        membership_row.id as membership_id,
        coalesce(membership_row.display_name, profile_row.display_name) as display_name,
        assignment_row.job_function_id,
        assignment_row.organisational_unit_id as person_unit_id
      from public.organisation_memberships membership_row
      left join public.profiles profile_row
        on profile_row.user_id = membership_row.user_id
      left join public.membership_job_function_assignments assignment_row
        on assignment_row.organisation_id = org_id
       and assignment_row.membership_id = membership_row.id
       and assignment_row.is_primary = true
       and assignment_row.valid_from <= statement_timestamp()
       and (
         assignment_row.valid_to is null
         or assignment_row.valid_to > statement_timestamp()
       )
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and private.can_read_membership_capability_profile(org_id, membership_row.id)
        and (
          target_unit_id is null
          or exists (
            select 1
            from public.organisation_unit_closure closure_row
            where closure_row.organisation_id = org_id
              and closure_row.ancestor_unit_id = target_unit_id
              and closure_row.descendant_unit_id = assignment_row.organisational_unit_id
          )
        )
    ),
    paged_people as (
      select *
      from eligible_people
      order by display_name nulls last, membership_id
      offset offset_value
      limit effective_page_size
    ),
    resolved_training_cells as (
      select
        people_row.membership_id,
        course_row.id as course_id,
        course_row.name as course_name,
        resolved.resolved_requirement
      from paged_people people_row
      cross join public.training_courses course_row
      cross join lateral (
        select private.resolve_effective_training_requirement(
          org_id,
          curriculum_version_id,
          course_row.id,
          people_row.job_function_id,
          people_row.person_unit_id
        ) as resolved_requirement
      ) resolved
      where course_row.organisation_id = org_id
        and course_row.status = 'active'
        and (resolved.resolved_requirement).id is not null
    ),
    required_courses as (
      select distinct
        cell_row.course_id as id,
        cell_row.course_name as name
      from resolved_training_cells cell_row
    ),
    applicable_cells as (
      select
        cell_row.membership_id,
        cell_row.course_id,
        (cell_row.resolved_requirement).mandatory as mandatory
      from resolved_training_cells cell_row
    )
    select jsonb_build_object(
      'people', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', people_row.membership_id,
              'display_name', people_row.display_name
            )
            order by people_row.display_name nulls last, people_row.membership_id
          )
          from paged_people people_row
        ),
        '[]'::jsonb
      ),
      'courses', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('id', course_row.id, 'name', course_row.name)
            order by course_row.name
          )
          from required_courses course_row
        ),
        '[]'::jsonb
      ),
      'requirements', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', cell_row.membership_id,
              'course_id', cell_row.course_id,
              'mandatory', cell_row.mandatory
            )
          )
          from applicable_cells cell_row
        ),
        '[]'::jsonb
      ),
      'completions', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'membership_id', completion_row.membership_id,
              'course_id', completion_row.course_id,
              'status', completion_row.status,
              'expires_at', completion_row.expires_at
            )
          )
          from public.training_completions completion_row
          where completion_row.organisation_id = org_id
            and completion_row.status = 'completed'
            and exists (
              select 1
              from paged_people people_row
              where people_row.membership_id = completion_row.membership_id
            )
            and exists (
              select 1
              from required_courses course_row
              where course_row.id = completion_row.course_id
            )
        ),
        '[]'::jsonb
      ),
      'total_people', (select count(*)::integer from eligible_people),
      'page', effective_page,
      'page_size', effective_page_size,
      'curriculum_version_id', curriculum_version_id
    )
  );
end;
$$;

create or replace function public.get_training_matrix(
  target_page integer default 1,
  target_page_size integer default 50,
  target_unit_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_training_matrix(target_page, target_page_size, target_unit_id)
$$;

grant execute on function public.get_skills_matrix(integer, integer, uuid) to authenticated;
grant execute on function public.get_training_matrix(integer, integer, uuid) to authenticated;
revoke all on function public.get_skills_matrix(integer, integer, uuid) from public, anon;
revoke all on function public.get_training_matrix(integer, integer, uuid) from public, anon;

revoke execute on function private.requirement_unit_applies(uuid, uuid, uuid) from public;
revoke execute on function private.resolve_effective_skill_requirement(uuid, uuid, uuid, uuid, uuid)
  from public;
revoke execute on function private.resolve_effective_training_requirement(uuid, uuid, uuid, uuid, uuid)
  from public;
revoke execute on function private.build_skill_gap_from_resolution(uuid, uuid, uuid, jsonb)
  from public;
revoke execute on function private.get_skills_matrix(integer, integer, uuid) from public;
revoke execute on function private.get_training_matrix(integer, integer, uuid) from public;
grant execute on function private.get_skills_matrix(integer, integer, uuid) to authenticated;
grant execute on function private.get_training_matrix(integer, integer, uuid) to authenticated;

alter function private.requirement_unit_applies(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.resolve_effective_skill_requirement(uuid, uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.resolve_effective_training_requirement(uuid, uuid, uuid, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.build_skill_gap_from_resolution(uuid, uuid, uuid, jsonb)
  owner to lean_hub_private_owner;
alter function private.get_skills_matrix(integer, integer, uuid) owner to lean_hub_private_owner;
alter function private.get_training_matrix(integer, integer, uuid) owner to lean_hub_private_owner;
