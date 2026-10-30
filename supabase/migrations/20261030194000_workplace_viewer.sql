-- Workplace Viewer is a new protected role with only workplace.view.
-- Published role definitions are not rewritten, and no member grants are inserted.

insert into public.permission_definitions (permission_key, description, is_protected)
values (
  'workplace.view',
  'View published and shared operational records within the granted scope.',
  true
)
on conflict (permission_key) do nothing;

create or replace function private.workplace_view_covers_unit(
  target_organisation_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
      target_organisation_id,
      'workplace.view',
      null,
      null
    )
    or (
      target_unit_id is not null
      and private.has_scoped_permission(
        target_organisation_id,
        'workplace.view',
        null,
        target_unit_id
      )
    )
$$;

create or replace function private.member_has_any_workplace_view(
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
      'workplace.view',
      null,
      null
    )
    or exists (
      select 1
      from public.organisation_units unit
      where unit.organisation_id = target_organisation_id
        and unit.status = 'active'
        and private.workplace_view_covers_unit(
          target_organisation_id,
          unit.id
        )
    )
$$;

create or replace function private.workplace_feed_item(
  target_id uuid,
  target_title text,
  target_status text,
  target_scope_name text,
  target_summary text,
  target_occurred_at timestamptz
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', target_id,
    'title', target_title,
    'status', target_status,
    'scope_name', target_scope_name,
    'summary', target_summary,
    'occurred_at', target_occurred_at
  )
$$;

create or replace function private.workplace_module_records(
  target_organisation_id uuid,
  target_module text
)
returns setof jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_module = 'maturity' then
    return query
      select private.workplace_feed_item(
        result_row.id,
        coalesce(result_row.model_name_snapshot, 'Published maturity result'),
        'published',
        result_row.unit_name_snapshot,
        'Score ' || result_row.overall_score::text,
        result_row.published_at
      )
      from public.maturity_official_results result_row
      where result_row.organisation_id = target_organisation_id
        and private.workplace_view_covers_unit(
          target_organisation_id,
          result_row.unit_id_snapshot
        )
      order by result_row.published_at desc
      limit 50;
    return query
      select distinct on (model_row.id) private.workplace_feed_item(
        model_row.id,
        model_row.display_name,
        'published',
        null,
        'Published framework',
        version_row.published_at
      )
      from public.maturity_models model_row
      join public.maturity_model_versions version_row
        on version_row.organisation_id = model_row.organisation_id
       and version_row.model_id = model_row.id
       and version_row.status = 'published'
      where model_row.organisation_id = target_organisation_id
      order by model_row.id, version_row.published_at desc nulls last
      limit 50;
    return;
  end if;

  if target_module = 'five_s' then
    return query
      select private.workplace_feed_item(
        audit_row.id,
        coalesce(unit_row.name, 'Completed 5S audit'),
        audit_row.status,
        unit_row.name,
        case
          when audit_row.overall_score_percent is null then 'Completed audit'
          else 'Score ' || audit_row.overall_score_percent::text || '%'
        end,
        audit_row.completed_at
      )
      from public.five_s_audits audit_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = audit_row.organisation_id
       and unit_row.id = audit_row.unit_id
      where audit_row.organisation_id = target_organisation_id
        and audit_row.status = 'completed'
        and private.workplace_view_covers_unit(
          target_organisation_id,
          audit_row.unit_id
        )
      order by audit_row.completed_at desc nulls last
      limit 50;
    return query
      select distinct on (standard_row.id) private.workplace_feed_item(
        standard_row.id,
        standard_row.display_name,
        'published',
        null,
        'Published standard',
        version_row.published_at
      )
      from public.five_s_standards standard_row
      join public.five_s_standard_versions version_row
        on version_row.organisation_id = standard_row.organisation_id
       and version_row.standard_id = standard_row.id
       and version_row.status = 'published'
      where standard_row.organisation_id = target_organisation_id
      order by standard_row.id, version_row.published_at desc nulls last
      limit 50;
    return;
  end if;

  if target_module = 'gemba' then
    return query
      select private.workplace_feed_item(
        walk_row.id,
        coalesce(walk_row.definition_name_snapshot, 'Completed Gemba walk'),
        walk_row.status,
        coalesce(walk_row.unit_name_snapshot, unit_row.name),
        'Completed walk',
        walk_row.completed_at
      )
      from public.gemba_walks walk_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = walk_row.organisation_id
       and unit_row.id = walk_row.unit_id
      where walk_row.organisation_id = target_organisation_id
        and walk_row.status = 'completed'
        and private.workplace_view_covers_unit(
          target_organisation_id,
          walk_row.unit_id
        )
      order by walk_row.completed_at desc nulls last
      limit 50;
    return query
      select distinct on (definition_row.id) private.workplace_feed_item(
        definition_row.id,
        definition_row.display_name,
        'published',
        null,
        'Published walk definition',
        version_row.published_at
      )
      from public.gemba_definitions definition_row
      join public.gemba_definition_versions version_row
        on version_row.organisation_id = definition_row.organisation_id
       and version_row.definition_id = definition_row.id
       and version_row.status = 'published'
      where definition_row.organisation_id = target_organisation_id
      order by definition_row.id, version_row.published_at desc nulls last
      limit 50;
    return;
  end if;

  if target_module = 'actions' then
    return query
      select private.workplace_feed_item(
        action_row.id,
        action_row.title,
        action_row.status,
        unit_row.name,
        action_row.priority,
        coalesce(action_row.completed_at, action_row.due_at, action_row.created_at)
      )
      from public.actions action_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = action_row.organisation_id
       and unit_row.id = action_row.unit_id
      where action_row.organisation_id = target_organisation_id
        and action_row.status in ('open', 'in_progress', 'completed', 'verified')
        and private.workplace_view_covers_unit(
          target_organisation_id,
          action_row.unit_id
        )
      order by coalesce(action_row.due_at, action_row.created_at) desc
      limit 50;
    return;
  end if;

  if target_module = 'projects' then
    return query
      select private.workplace_feed_item(
        project_row.id,
        project_row.title,
        project_row.status,
        unit_row.name,
        project_row.priority,
        project_row.created_at
      )
      from public.ci_projects project_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = project_row.organisation_id
       and unit_row.id = project_row.unit_id
      where project_row.organisation_id = target_organisation_id
        and project_row.status in (
          'submitted', 'approved', 'active', 'on_hold', 'completed'
        )
        and private.workplace_view_covers_unit(
          target_organisation_id,
          project_row.unit_id
        )
      order by project_row.created_at desc
      limit 50;
    return;
  end if;

  if target_module = 'benefits' then
    return query
      select private.workplace_feed_item(
        benefit_row.id,
        benefit_row.title,
        benefit_row.status,
        unit_row.name,
        case
          when benefit_row.benefit_class = 'financial'
            then 'Financial amounts are not included in viewing access'
          else coalesce(benefit_row.non_financial_type, 'Non-financial')
        end,
        benefit_row.created_at
      )
      from public.improvement_benefits benefit_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = benefit_row.organisation_id
       and unit_row.id = benefit_row.site_unit_id
      where benefit_row.organisation_id = target_organisation_id
        and benefit_row.status in ('approved', 'realising', 'realised')
        and private.workplace_view_covers_unit(
          target_organisation_id,
          coalesce(benefit_row.site_unit_id, benefit_row.organisational_unit_id)
        )
      order by benefit_row.created_at desc
      limit 50;
    return;
  end if;

  if target_module = 'problem_solving' then
    return query
      select private.workplace_feed_item(
        case_row.id,
        case_row.title,
        case_row.status,
        unit_row.name,
        'Shared case',
        coalesce(case_row.closed_at, case_row.activated_at, case_row.created_at)
      )
      from public.problem_solving_cases case_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = case_row.organisation_id
       and unit_row.id = case_row.organisation_unit_id
      where case_row.organisation_id = target_organisation_id
        and case_row.status in ('active', 'closed')
        and private.workplace_view_covers_unit(
          target_organisation_id,
          case_row.organisation_unit_id
        )
      order by case_row.updated_at desc
      limit 50;
    return;
  end if;

  if target_module = 'suggestions' then
    return query
      select private.workplace_feed_item(
        suggestion_row.id,
        suggestion_row.title,
        suggestion_row.status,
        unit_row.name,
        'Shared suggestion',
        suggestion_row.created_at
      )
      from public.improvement_suggestions suggestion_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = suggestion_row.organisation_id
       and unit_row.id = suggestion_row.origin_unit_id
      where suggestion_row.organisation_id = target_organisation_id
        and suggestion_row.status in (
          'submitted', 'under_review', 'accepted', 'implementing',
          'implemented', 'parked', 'rejected'
        )
        and private.workplace_view_covers_unit(
          target_organisation_id,
          suggestion_row.origin_unit_id
        )
      order by suggestion_row.created_at desc
      limit 50;
    return;
  end if;

  if target_module = 'recognition' then
    return query
      select private.workplace_feed_item(
        award_row.id,
        award_row.title,
        award_row.status,
        unit_row.name,
        left(award_row.message, 160),
        award_row.awarded_at
      )
      from public.recognition_awards award_row
      left join public.organisation_units unit_row
        on unit_row.organisation_id = award_row.organisation_id
       and unit_row.id = award_row.organisational_unit_id
      where award_row.organisation_id = target_organisation_id
        and award_row.status = 'active'
        and award_row.visibility in ('unit', 'organisation')
        and private.workplace_view_covers_unit(
          target_organisation_id,
          award_row.organisational_unit_id
        )
      order by award_row.awarded_at desc
      limit 50;
    return;
  end if;

  if target_module = 'skills' then
    return query
      select private.workplace_feed_item(
        skill_row.id,
        skill_row.name,
        skill_row.status,
        null,
        coalesce(skill_row.category, skill_row.code),
        skill_row.updated_at
      )
      from public.skills skill_row
      where skill_row.organisation_id = target_organisation_id
        and skill_row.status = 'active'
      order by skill_row.name
      limit 50;
    return;
  end if;

  if target_module = 'training' then
    return query
      select private.workplace_feed_item(
        course_row.id,
        course_row.name,
        course_row.status,
        null,
        course_row.code,
        course_row.created_at
      )
      from public.training_courses course_row
      where course_row.organisation_id = target_organisation_id
        and course_row.status = 'active'
      order by course_row.name
      limit 50;
    return query
      select private.workplace_feed_item(
        completion_row.id,
        coalesce(course_row.name, 'Completed course'),
        completion_row.status,
        null,
        'Your completed course',
        completion_row.completed_at
      )
      from public.training_completions completion_row
      join public.training_courses course_row
        on course_row.organisation_id = completion_row.organisation_id
       and course_row.id = completion_row.course_id
      where completion_row.organisation_id = target_organisation_id
        and completion_row.membership_id = private.current_membership_id(
          target_organisation_id
        )
        and completion_row.status = 'completed'
      order by completion_row.completed_at desc
      limit 50;
    return;
  end if;

  raise exception 'workplace module is not available'
    using errcode = '22023';
end;
$$;

create or replace function public.get_workplace_feed(target_module text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  records jsonb;
begin
  if org_id is null
    or not private.member_has_any_workplace_view(org_id) then
    raise exception 'workplace view is not authorised'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(record_row), '[]'::jsonb)
  into records
  from private.workplace_module_records(org_id, target_module) record_row;

  return jsonb_build_object(
    'module', target_module,
    'records', records
  );
end;
$$;

create or replace function public.get_workplace_record(
  target_module text,
  target_record_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  record_row jsonb;
begin
  if org_id is null
    or not private.member_has_any_workplace_view(org_id) then
    raise exception 'workplace view is not authorised'
      using errcode = '42501';
  end if;

  select feed_row
  into record_row
  from private.workplace_module_records(org_id, target_module) feed_row
  where feed_row ->> 'id' = target_record_id::text
  limit 1;

  return record_row;
end;
$$;

create or replace function private.role_version_is_delegatable_at_scope(
  target_organisation_id uuid,
  target_role_version_id uuid,
  target_scope_type text,
  target_scope_unit_id uuid default null,
  actor_membership_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_versions role_version
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
    where role_version.organisation_id = target_organisation_id
      and role_version.id = target_role_version_id
      and role_version.status = 'published'
      and role_row.status = 'active'
      and (
        not role_row.is_owner_role
        or private.membership_is_effective_owner(
          coalesce(
            actor_membership_id,
            private.current_membership_id(target_organisation_id)
          ),
          target_organisation_id
        )
      )
  )
  and not exists (
    select 1
    from public.role_permissions role_permission
    where role_permission.organisation_id = target_organisation_id
      and role_permission.role_version_id = target_role_version_id
      and role_permission.permission_key <> 'workplace.view'
      and not private.membership_has_scoped_permission(
        coalesce(
          actor_membership_id,
          private.current_membership_id(target_organisation_id)
        ),
        target_organisation_id,
        role_permission.permission_key,
        case when target_scope_type = 'self'
          then coalesce(
            actor_membership_id,
            private.current_membership_id(target_organisation_id)
          )
          else null
        end,
        case when target_scope_type = 'unit_subtree'
          then target_scope_unit_id
          else null
        end
      )
  )
$$;

create or replace function private.ensure_organisation_baseline_application_roles(
  target_organisation_id uuid,
  actor_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.ensure_organisation_baseline_application_roles$m1(
    target_organisation_id,
    actor_membership_id
  );

  perform private.ensure_baseline_role_permissions(
    target_organisation_id,
    'organisation-administrator',
    array[
      'workforce.provision',
      'workforce.credentials.reset',
      'workforce.import'
    ]::text[]
  );

  perform private.provision_baseline_application_role(
    target_organisation_id,
    actor_membership_id,
    'suggestions-contributor',
    'Suggestions Contributor',
    'Submit improvement suggestions within the granted scope. This role does not review or manage the suggestions portfolio.',
    true,
    array['suggestions.submit']::text[],
    array['organisation', 'unit_subtree']::text[]
  );

  perform private.provision_baseline_application_role(
    target_organisation_id,
    actor_membership_id,
    'workplace-viewer',
    'Workplace Viewer',
    'View published and shared operational records in the granted scope. This role does not grant editing, administration, financial evidence, or other people''s assessments.',
    true,
    array['workplace.view']::text[],
    array['organisation', 'unit_subtree']::text[]
  );
end;
$$;

do $$
declare
  organisation_row record;
  actor_membership_id uuid;
begin
  for organisation_row in
    select organisation.id
    from public.organisations organisation
  loop
    select membership.id
    into actor_membership_id
    from public.organisation_memberships membership
    join public.access_grants grant_row
      on grant_row.organisation_id = membership.organisation_id
     and grant_row.grantee_membership_id = membership.id
     and grant_row.status = 'active'
     and grant_row.scope_type = 'organisation'
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.is_owner_role
     and role_row.status = 'active'
    where membership.organisation_id = organisation_row.id
      and membership.status = 'active'
    order by membership.created_at
    limit 1;

    if actor_membership_id is not null then
      perform private.provision_baseline_application_role(
        organisation_row.id,
        actor_membership_id,
        'workplace-viewer',
        'Workplace Viewer',
        'View published and shared operational records in the granted scope. This role does not grant editing, administration, financial evidence, or other people''s assessments.',
        true,
        array['workplace.view']::text[],
        array['organisation', 'unit_subtree']::text[]
      );
    end if;
  end loop;
end;
$$;

create or replace function public.get_delegatable_access_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  actor_is_owner boolean := false;
  actor_has_org_delegate boolean := false;
  actor_can_delegate boolean := false;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'delegation offers are not authorised'
      using errcode = '42501';
  end if;

  actor_is_owner := private.membership_is_effective_owner(
    actor_membership_id,
    org_id
  );

  actor_has_org_delegate := private.membership_has_scoped_permission(
    actor_membership_id,
    org_id,
    'roles.delegate',
    null,
    null
  );

  if actor_has_org_delegate then
    actor_can_delegate := true;
  else
    select exists (
      select 1
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
      join public.role_permissions role_permission
        on role_permission.organisation_id = role_version.organisation_id
       and role_permission.role_version_id = role_version.id
       and role_permission.permission_key = 'roles.delegate'
      join public.organisation_units unit_row
        on unit_row.organisation_id = org_id
       and unit_row.status = 'active'
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = org_id
        and actor_membership.status = 'active'
        and grant_row.scope_type = 'unit_subtree'
        and grant_row.scope_unit_id is not null
        and exists (
          select 1
          from public.organisation_unit_closure closure
          where closure.organisation_id = grant_row.organisation_id
            and closure.ancestor_unit_id = grant_row.scope_unit_id
            and closure.descendant_unit_id = unit_row.id
        )
        and private.units_share_site_boundary(
          org_id,
          grant_row.scope_unit_id,
          unit_row.id
        )
    )
    into actor_can_delegate;
  end if;

  if not actor_can_delegate then
    return jsonb_build_object('offers', '[]'::jsonb);
  end if;

  return (
    with actor_grant_permissions as materialized (
      select distinct
        role_permission.permission_key,
        grant_row.scope_type,
        grant_row.scope_unit_id
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join public.access_grants grant_row
        on grant_row.organisation_id = actor_membership.organisation_id
       and grant_row.grantee_membership_id = actor_membership.id
       and grant_row.status = 'active'
       and (
         grant_row.expires_at is null
         or grant_row.expires_at > statement_timestamp()
       )
      join public.role_versions role_version
        on role_version.organisation_id = grant_row.organisation_id
       and role_version.id = grant_row.role_version_id
       and role_version.status = 'published'
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
       and role_row.status = 'active'
      join public.role_permissions role_permission
        on role_permission.organisation_id = role_version.organisation_id
       and role_permission.role_version_id = role_version.id
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = org_id
        and actor_membership.status = 'active'
    ),
    actor_org_grant_keys as (
      select grant_permission.permission_key
      from actor_grant_permissions grant_permission
      where grant_permission.scope_type = 'organisation'
    ),
    actor_org_baseline_keys as (
      select baseline_permission.permission_key
      from public.organisation_memberships actor_membership
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join private.baseline_participation_permissions baseline_permission
        on baseline_permission.include_in_scoped_permission
       and baseline_permission.scope_mode = 'organisation'
      where actor_membership.id = actor_membership_id
        and actor_membership.organisation_id = org_id
        and actor_membership.status = 'active'
        and not private.organisation_requires_site_boundary(org_id)
    ),
    actor_org_keys as materialized (
      select permission_key from actor_org_grant_keys
      union
      select permission_key from actor_org_baseline_keys
    ),
    active_units as materialized (
      select
        unit_row.id,
        unit_row.name,
        unit_row.code,
        private.format_organisation_unit_path_label(unit_row.id) as unit_path
      from public.organisation_units unit_row
      where unit_row.organisation_id = org_id
        and unit_row.status = 'active'
    ),
    actor_unit_subtree_keys as (
      select
        unit_row.id as unit_id,
        grant_permission.permission_key
      from actor_grant_permissions grant_permission
      join public.organisation_unit_closure closure
        on closure.organisation_id = org_id
       and closure.ancestor_unit_id = grant_permission.scope_unit_id
      join active_units unit_row
        on unit_row.id = closure.descendant_unit_id
      where grant_permission.scope_type = 'unit_subtree'
        and grant_permission.scope_unit_id is not null
        and private.units_share_site_boundary(
          org_id,
          grant_permission.scope_unit_id,
          unit_row.id
        )
    ),
    actor_unit_baseline_keys as (
      select
        unit_row.id as unit_id,
        baseline_permission.permission_key
      from active_units unit_row
      join public.organisation_memberships actor_membership
        on actor_membership.id = actor_membership_id
       and actor_membership.organisation_id = org_id
       and actor_membership.status = 'active'
      join public.organisations organisation
        on organisation.id = actor_membership.organisation_id
       and organisation.status = 'active'
      join private.identity_controls identity_control
        on identity_control.user_id = actor_membership.user_id
       and identity_control.status = 'active'
       and identity_control.enrolment_status = 'complete'
      join private.baseline_participation_permissions baseline_permission
        on baseline_permission.include_in_scoped_permission
       and baseline_permission.scope_mode = 'organisation'
      where
        not private.organisation_requires_site_boundary(org_id)
        or private.membership_can_access_unit_site(
          org_id,
          actor_membership_id,
          unit_row.id
        )
    ),
    actor_unit_keys as materialized (
      select unit_row.id as unit_id, org_key.permission_key
      from active_units unit_row
      cross join actor_org_grant_keys org_key
      union
      select unit_subtree.unit_id, unit_subtree.permission_key
      from actor_unit_subtree_keys unit_subtree
      union
      select unit_baseline.unit_id, unit_baseline.permission_key
      from actor_unit_baseline_keys unit_baseline
    ),
    published_roles as materialized (
      select distinct on (role_row.id)
        role_version.id as role_version_id,
        role_row.id as role_id,
        role_row.display_name as role_display_name,
        role_row.canonical_name as role_canonical_name,
        role_row.module_responsibility_key,
        private.role_responsibility_kind(
          role_row.canonical_name,
          role_row.module_responsibility_key,
          role_row.is_owner_role
        ) as responsibility_kind
      from public.role_versions role_version
      join public.roles role_row
        on role_row.organisation_id = role_version.organisation_id
       and role_row.id = role_version.role_id
      where role_version.organisation_id = org_id
        and role_version.status = 'published'
        and role_row.status = 'active'
        and (
          not role_row.is_owner_role
          or actor_is_owner
        )
      order by
        role_row.id,
        role_version.version_number desc
    ),
    organisation_scope_options as (
      select
        published_role.role_version_id,
        jsonb_build_object(
          'scope_type', 'organisation',
          'scope_unit_id', null,
          'label', 'Entire organisation'
        ) as scope_option
      from published_roles published_role
      where actor_has_org_delegate
        and private.role_grant_scope_allowed(
          org_id,
          published_role.role_id,
          'organisation'
        )
        and not exists (
          select 1
          from public.role_permissions role_permission
          where role_permission.organisation_id = org_id
            and role_permission.role_version_id = published_role.role_version_id
            and role_permission.permission_key <> 'workplace.view'
            and not exists (
              select 1
              from actor_org_keys org_key
              where org_key.permission_key = role_permission.permission_key
            )
        )
    ),
    unit_scope_options as (
      select
        published_role.role_version_id,
        jsonb_build_object(
          'scope_type', 'unit_subtree',
          'scope_unit_id', unit_row.id,
          'label', private.format_delegatable_scope_label(
            org_id,
            unit_row.id,
            unit_row.name
          ),
          'unit_code', unit_row.code,
          'unit_path', unit_row.unit_path
        ) as scope_option,
        unit_row.unit_path
      from published_roles published_role
      join active_units unit_row
        on true
      where private.role_grant_scope_allowed(
          org_id,
          published_role.role_id,
          'unit_subtree'
        )
        and exists (
          select 1
          from actor_unit_keys unit_key
          where unit_key.unit_id = unit_row.id
            and unit_key.permission_key = 'roles.delegate'
        )
        and not exists (
          select 1
          from public.role_permissions role_permission
          where role_permission.organisation_id = org_id
            and role_permission.role_version_id = published_role.role_version_id
            and role_permission.permission_key <> 'workplace.view'
            and not exists (
              select 1
              from actor_unit_keys unit_key
              where unit_key.unit_id = unit_row.id
                and unit_key.permission_key = role_permission.permission_key
            )
        )
    ),
    role_scope_options as (
      select
        published_role.role_version_id,
        published_role.role_display_name,
        published_role.role_canonical_name,
        published_role.module_responsibility_key,
        published_role.responsibility_kind,
        coalesce(
          (
            select jsonb_agg(organisation_scope.scope_option)
            from organisation_scope_options organisation_scope
            where organisation_scope.role_version_id = published_role.role_version_id
          ),
          '[]'::jsonb
        )
        || coalesce(
          (
            select jsonb_agg(
              unit_scope.scope_option
              order by unit_scope.unit_path
            )
            from unit_scope_options unit_scope
            where unit_scope.role_version_id = published_role.role_version_id
          ),
          '[]'::jsonb
        ) as scope_options
      from published_roles published_role
    ),
    offers as (
      select jsonb_build_object(
        'role_version_id', role_scope.role_version_id,
        'role_display_name', role_scope.role_display_name,
        'role_canonical_name', role_scope.role_canonical_name,
        'module_responsibility_key', role_scope.module_responsibility_key,
        'responsibility_kind', role_scope.responsibility_kind,
        'scope_options', role_scope.scope_options
      ) as offer_row
      from role_scope_options role_scope
      where jsonb_array_length(role_scope.scope_options) > 0
    )
    select jsonb_build_object(
      'offers',
      coalesce(
        (
          select jsonb_agg(
            offer_row
            order by
              offer_row ->> 'responsibility_kind',
              offer_row ->> 'role_display_name'
          )
          from offers
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;


alter function private.workplace_view_covers_unit(uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.member_has_any_workplace_view(uuid)
  owner to lean_hub_private_owner;
alter function private.workplace_feed_item(uuid, text, text, text, text, timestamptz)
  owner to lean_hub_private_owner;
alter function private.workplace_module_records(uuid, text)
  owner to postgres;
alter function public.get_workplace_feed(text)
  owner to postgres;
alter function public.get_workplace_record(text, uuid)
  owner to postgres;
alter function private.role_version_is_delegatable_at_scope(uuid, uuid, text, uuid, uuid)
  owner to lean_hub_private_owner;
alter function private.ensure_organisation_baseline_application_roles(uuid, uuid)
  owner to lean_hub_private_owner;
alter function public.get_delegatable_access_offers()
  owner to postgres;

revoke all on function private.workplace_view_covers_unit(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.member_has_any_workplace_view(uuid)
  from public, anon, authenticated;
revoke all on function private.workplace_feed_item(uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function private.workplace_module_records(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_workplace_feed(text) from public, anon;
revoke all on function public.get_workplace_record(text, uuid) from public, anon;
grant execute on function public.get_workplace_feed(text) to authenticated;
grant execute on function public.get_workplace_record(text, uuid) to authenticated;
revoke all on function public.get_delegatable_access_offers() from public, anon;
grant execute on function public.get_delegatable_access_offers() to authenticated;
