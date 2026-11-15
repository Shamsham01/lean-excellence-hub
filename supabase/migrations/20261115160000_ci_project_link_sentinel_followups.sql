-- SENTINEL follow-ups: portfolio pagination, gemba action RPC, PPS detail, relink guards, 5S link RPC revoke.

-- ── Portfolio pagination + linkable filter ───────────────────────────────────

drop function if exists public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid
);

create or replace function public.get_ci_projects_portfolio(
  target_search text default null,
  target_status text default null,
  target_unit_id uuid default null,
  target_priority text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_site_unit_id uuid default null,
  target_linkable_only boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  page_size integer;
  offset_val integer;
  items jsonb;
  total_count integer;
begin
  if org_id is null then
    raise exception 'project portfolio is not authorised'
      using errcode = '42501';
  end if;

  page_size := least(greatest(coalesce(target_page_size, 25), 1), 100);
  offset_val := greatest((greatest(coalesce(target_page, 1), 1) - 1) * page_size, 0);

  with filtered as (
    select project_row.*
    from public.ci_projects project_row
    where project_row.organisation_id = org_id
      and private.can_read_ci_project(org_id, project_row.id)
      and (target_status is null or project_row.status = target_status)
      and (
        not coalesce(target_linkable_only, false)
        or project_row.status in (
          'draft', 'submitted', 'approved', 'active', 'on_hold'
        )
      )
      and (
        target_unit_id is null
        or exists (
          select 1
          from public.organisation_unit_closure closure
          where closure.organisation_id = org_id
            and closure.ancestor_unit_id = target_unit_id
            and closure.descendant_unit_id = project_row.unit_id
        )
      )
      and (
        target_site_unit_id is null
        or project_row.site_unit_id = target_site_unit_id
      )
      and (target_priority is null or project_row.priority = target_priority)
      and (
        target_search is null
        or btrim(target_search) = ''
        or project_row.title ilike '%' || btrim(target_search) || '%'
        or project_row.project_number ilike '%' || btrim(target_search) || '%'
        or project_row.status ilike '%' || btrim(target_search) || '%'
      )
  ),
  counted as (
    select count(*)::integer as total_count
    from filtered
  ),
  paged as (
    select filtered.*
    from filtered
    order by filtered.updated_at desc
    limit page_size
    offset offset_val
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', project_row.id,
            'project_number', project_row.project_number,
            'title', project_row.title,
            'status', project_row.status,
            'priority', project_row.priority,
            'unit_id', project_row.unit_id,
            'site_unit_id', project_row.site_unit_id,
            'methodology_version_id', project_row.methodology_version_id,
            'planned_start_date', project_row.planned_start_date,
            'planned_end_date', project_row.planned_end_date,
            'actual_start_at', project_row.actual_start_at,
            'actual_end_at', project_row.actual_end_at,
            'created_by_membership_id', project_row.created_by_membership_id,
            'created_at', project_row.created_at,
            'updated_at', project_row.updated_at
          )
        )
        from paged project_row
      ),
      '[]'::jsonb
    ),
    (select counted.total_count from counted)
  into items, total_count;

  return jsonb_build_object(
    'items', items,
    'total_count', total_count,
    'page', greatest(coalesce(target_page, 1), 1),
    'page_size', page_size
  );
end;
$$;

grant execute on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid, boolean
) to authenticated;

revoke all on function public.get_ci_projects_portfolio(
  text, text, uuid, text, integer, integer, uuid, boolean
) from public, anon;

-- ── Status-guard errcode + relink guards ─────────────────────────────────────

create or replace function private.assert_ci_project_work_item_link_mutable(
  target_organisation_id uuid,
  target_project_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  project_status text;
begin
  if target_project_id is null then
    return;
  end if;

  select project_row.status
  into project_status
  from public.ci_projects project_row
  where project_row.organisation_id = target_organisation_id
    and project_row.id = target_project_id
  for share;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if not private.ci_project_accepts_work_item_links(
    target_organisation_id,
    target_project_id
  ) then
    raise exception
      'This project link is read-only because the project is completed or cancelled.'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function private.link_action_to_ci_project(
  target_action_id uuid,
  target_project_id uuid
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
  action_row public.actions%rowtype;
  existing_project_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_update_action(org_id, target_action_id) then
    raise exception 'action project link is not authorised'
      using errcode = '42501';
  end if;

  select action_table.*
  into action_row
  from public.actions action_table
  where action_table.organisation_id = org_id
    and action_table.id = target_action_id;

  if not found then
    raise exception 'action not found'
      using errcode = 'P0002';
  end if;

  if action_row.status in ('completed', 'verified', 'cancelled') then
    raise exception
      'This action is completed, verified, or cancelled and cannot change project links.'
      using errcode = '55000';
  end if;

  select context_row.project_id
  into existing_project_id
  from public.ci_project_action_context context_row
  where context_row.organisation_id = org_id
    and context_row.action_id = target_action_id
  for update;

  if existing_project_id is not null
    and action_row.source_resource_id = existing_project_id then
    raise exception
      'This action belongs to its project and cannot be moved to another project.'
      using errcode = '55000';
  end if;

  perform private.assert_current_organisation_module_entitled('projects');

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  if not private.can_edit_ci_project(org_id, target_project_id) then
    raise exception 'action project link is not authorised'
      using errcode = '42501';
  end if;

  if existing_project_id is not null
    and existing_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, existing_project_id) then
      raise exception 'action project link is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_accepts_work_item_links(
      org_id,
      existing_project_id
    );
  end if;

  insert into public.ci_project_action_context (
    organisation_id,
    action_id,
    project_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_action_id,
    target_project_id,
    actor_membership_id
  )
  on conflict (organisation_id, action_id)
  do update set
    project_id = excluded.project_id,
    project_phase_id = null;

  return true;
end;
$$;

create or replace function private.set_gemba_observation_linked_project(
  target_observation_id uuid,
  target_project_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  walk_id uuid;
  walk_status text;
  current_linked_project_id uuid;
begin
  if org_id is null then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_ci_project_accepts_work_item_links(
    org_id,
    target_project_id
  );

  select observation_row.walk_id, observation_row.linked_project_id
  into walk_id, current_linked_project_id
  from public.gemba_walk_observations observation_row
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id
  for update;

  if not found then
    raise exception 'gemba observation not found'
      using errcode = 'P0002';
  end if;

  select walk_row.status
  into walk_status
  from public.gemba_walks walk_row
  where walk_row.organisation_id = org_id
    and walk_row.id = walk_id
  for share;

  if walk_status not in ('draft', 'in_progress') then
    raise exception
      'This walk is completed or cancelled and cannot accept project links.'
      using errcode = '55000';
  end if;

  if not private.can_edit_gemba_walk(org_id, walk_id) then
    raise exception 'gemba observation project link is not authorised'
      using errcode = '42501';
  end if;

  if current_linked_project_id is not null
    and current_linked_project_id <> target_project_id then
    if not private.can_read_ci_project(org_id, current_linked_project_id) then
      raise exception 'gemba observation project link is not authorised'
        using errcode = '42501';
    end if;

    perform private.assert_ci_project_accepts_work_item_links(
      org_id,
      current_linked_project_id
    );
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('projects');

  update public.gemba_walk_observations observation_row
  set linked_project_id = target_project_id
  where observation_row.organisation_id = org_id
    and observation_row.id = target_observation_id;

  return true;
end;
$$;

-- ── Gemba action: atomic owner, due date, idempotency ────────────────────────

drop function if exists public.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

drop function if exists private.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
);

create or replace function private.create_gemba_action(
  target_title text,
  target_walk_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
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
  unit_id uuid;
  template_version_id uuid;
  observation_row public.gemba_walk_observations%rowtype;
  new_action_id uuid;
  resolved_assignee uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_edit_gemba_walk(org_id, target_walk_id) then
    raise exception 'gemba action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('gemba');
  perform private.assert_current_organisation_module_entitled('actions');

  if target_due_at is null then
    raise exception 'gemba actions require a due date'
      using errcode = '22023';
  end if;

  if target_idempotency_key is null
    or btrim(target_idempotency_key) = '' then
    raise exception 'gemba actions require an idempotency key'
      using errcode = '22023';
  end if;

  resolved_assignee := coalesce(
    target_assignee_membership_id,
    actor_membership_id
  );

  if not exists (
    select 1
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = org_id
      and membership_row.id = resolved_assignee
  ) then
    raise exception 'assignee is not authorised'
      using errcode = '42501';
  end if;

  select walk_row.unit_id, definition_version.template_version_id
  into unit_id, template_version_id
  from public.gemba_walks walk_row
  join public.gemba_definition_versions definition_version
    on definition_version.organisation_id = walk_row.organisation_id
   and definition_version.id = walk_row.definition_version_id
  where walk_row.organisation_id = org_id
    and walk_row.id = target_walk_id;

  if not found then
    raise exception 'gemba walk not found'
      using errcode = 'P0002';
  end if;

  if target_observation_id is not null then
    select observation_item.*
    into observation_row
    from public.gemba_walk_observations observation_item
    where observation_item.organisation_id = org_id
      and observation_item.id = target_observation_id
      and observation_item.walk_id = target_walk_id;

    if not found then
      raise exception 'gemba observation was not found on this walk'
        using errcode = 'P0002';
    end if;

    if target_section_id is not null
      and observation_row.section_id is distinct from target_section_id then
      raise exception 'observation section does not match walk context'
        using errcode = '22023';
    end if;

    if target_question_id is not null
      and observation_row.question_id is distinct from target_question_id then
      raise exception 'observation question does not match walk context'
        using errcode = '22023';
    end if;

    target_section_id := coalesce(target_section_id, observation_row.section_id);
    target_question_id := coalesce(
      target_question_id,
      observation_row.question_id
    );
  end if;

  if target_section_id is not null
    and not exists (
      select 1
      from public.template_sections section_row
      where section_row.organisation_id = org_id
        and section_row.id = target_section_id
        and section_row.template_version_id = template_version_id
    ) then
    raise exception 'section does not belong to this walk'
      using errcode = '22023';
  end if;

  if target_question_id is not null
    and not exists (
      select 1
      from public.template_questions question_row
      where question_row.organisation_id = org_id
        and question_row.id = target_question_id
        and question_row.template_version_id = template_version_id
        and (
          target_section_id is null
          or question_row.section_id = target_section_id
        )
    ) then
    raise exception 'question does not belong to this walk'
      using errcode = '22023';
  end if;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    unit_id,
    target_walk_id,
    target_due_at,
    target_idempotency_key
  );

  perform private.set_action_assignee(new_action_id, resolved_assignee);

  insert into public.gemba_action_context (
    organisation_id,
    action_id,
    walk_id,
    section_id,
    question_id,
    observation_id,
    created_by_membership_id
  )
  values (
    org_id,
    new_action_id,
    target_walk_id,
    target_section_id,
    target_question_id,
    target_observation_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

alter function private.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) owner to lean_hub_private_owner;

revoke all on function private.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to lean_hub_private_owner;

create or replace function public.create_gemba_action(
  target_title text,
  target_walk_id uuid,
  target_assignee_membership_id uuid,
  target_due_at timestamptz,
  target_idempotency_key text,
  target_section_id uuid default null,
  target_question_id uuid default null,
  target_observation_id uuid default null,
  target_description text default null,
  target_priority text default 'normal'
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_gemba_action(
    target_title,
    target_walk_id,
    target_assignee_membership_id,
    target_due_at,
    target_idempotency_key,
    target_section_id,
    target_question_id,
    target_observation_id,
    target_description,
    target_priority
  )
$$;

grant execute on function public.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) to authenticated;

revoke all on function public.create_gemba_action(
  text, uuid, uuid, timestamptz, text, uuid, uuid, uuid, text, text
) from public, anon;

revoke execute on function public.set_five_s_audit_finding_linked_project(uuid, uuid)
  from authenticated;
revoke execute on function public.clear_five_s_audit_finding_linked_project(uuid)
  from authenticated;create or replace function public.get_problem_solving_detail(
  target_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  case_row public.problem_solving_cases%rowtype;
  unit_row public.organisation_units%rowtype;
  status_history jsonb;
  stage_history jsonb;
  hypotheses jsonb;
  countermeasures jsonb;
  effectiveness_checks jsonb;
  sustainment_items jsonb;
  lessons_learned jsonb;
  sessions jsonb;
  actions jsonb;
  evidence_links jsonb;
  source_links jsonb;
  current_stage jsonb;
  membership_display_names jsonb;
  linked_project_id uuid;
  linked_project jsonb;
begin
  if org_id is null then
    raise exception 'problem solving detail is not authorised'
      using errcode = '42501';
  end if;

  if not private.can_read_problem_solving_case(org_id, target_case_id) then
    raise exception 'problem solving detail is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  select unit_table.*
  into unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = case_row.organisation_unit_id;

  -- Status history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sh.id,
        'from_status', sh.from_status,
        'to_status', sh.to_status,
        'changed_by_membership_id', sh.changed_by_membership_id,
        'rationale', sh.rationale,
        'changed_at', sh.changed_at
      )
      order by sh.changed_at
    ),
    '[]'::jsonb
  )
  into status_history
  from public.problem_solving_status_history sh
  where sh.organisation_id = org_id
    and sh.case_id = target_case_id;

  -- Stage history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sth.id,
        'from_stage_id', sth.from_stage_id,
        'to_stage_id', sth.to_stage_id,
        'from_stage', (
          select jsonb_build_object('title', fs.title, 'display_order', fs.display_order)
          from public.problem_solving_method_stages fs
          where fs.organisation_id = org_id and fs.id = sth.from_stage_id
        ),
        'to_stage', (
          select jsonb_build_object('title', ts.title, 'display_order', ts.display_order)
          from public.problem_solving_method_stages ts
          where ts.organisation_id = org_id and ts.id = sth.to_stage_id
        ),
        'changed_by_membership_id', sth.changed_by_membership_id,
        'changed_at', sth.changed_at,
        'notes', sth.notes
      )
      order by sth.changed_at
    ),
    '[]'::jsonb
  )
  into stage_history
  from public.problem_solving_stage_history sth
  where sth.organisation_id = org_id
    and sth.case_id = target_case_id;

  -- Current stage
  if case_row.current_method_stage_id is not null then
    select jsonb_build_object(
      'id', ms.id,
      'title', ms.title,
      'display_order', ms.display_order,
      'description', ms.description,
      'semantic_stage_key', ms.semantic_stage_key
    )
    into current_stage
    from public.problem_solving_method_stages ms
    where ms.organisation_id = org_id
      and ms.id = case_row.current_method_stage_id;
  end if;

  -- Hypotheses with cause links
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'statement', h.statement,
        'category', h.category,
        'status', h.status,
        'rationale', h.rationale,
        'verification_rationale', h.verification_rationale,
        'verified_by_membership_id', h.verified_by_membership_id,
        'verified_at', h.verified_at,
        'rejection_rationale', h.rejection_rationale,
        'rejected_by_membership_id', h.rejected_by_membership_id,
        'rejected_at', h.rejected_at,
        'parent_hypothesis_id', h.parent_hypothesis_id,
        'created_by_membership_id', h.created_by_membership_id,
        'created_at', h.created_at,
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id,
                'link_rationale', el.link_rationale
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.hypothesis_id = h.id
          ),
          '[]'::jsonb
        )
      )
      order by h.created_at
    ),
    '[]'::jsonb
  )
  into hypotheses
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.problem_solving_case_id = target_case_id;

  -- Countermeasures with cause links
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cm.id,
        'title', cm.title,
        'description', cm.description,
        'rationale', cm.rationale,
        'status', cm.status,
        'proposed_by_membership_id', cm.proposed_by_membership_id,
        'selected_by_membership_id', cm.selected_by_membership_id,
        'selected_at', cm.selected_at,
        'selected_rationale', cm.selected_rationale,
        'rejected_by_membership_id', cm.rejected_by_membership_id,
        'rejected_at', cm.rejected_at,
        'rejected_rationale', cm.rejected_rationale,
        'created_at', cm.created_at,
        'cause_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', cl.id,
                'hypothesis_id', cl.hypothesis_id,
                'hypothesis_statement', (
                  select hh.statement
                  from public.problem_solving_hypotheses hh
                  where hh.organisation_id = org_id and hh.id = cl.hypothesis_id
                )
              )
            )
            from public.problem_solving_countermeasure_cause_links cl
            where cl.organisation_id = org_id
              and cl.countermeasure_id = cm.id
          ),
          '[]'::jsonb
        ),
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.countermeasure_id = cm.id
          ),
          '[]'::jsonb
        )
      )
      order by cm.created_at
    ),
    '[]'::jsonb
  )
  into countermeasures
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.problem_solving_case_id = target_case_id;

  -- Effectiveness checks
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', eff.id,
        'criterion', eff.criterion,
        'baseline_description', eff.baseline_description,
        'target_description', eff.target_description,
        'baseline_numeric', eff.baseline_numeric,
        'target_numeric', eff.target_numeric,
        'actual_numeric', eff.actual_numeric,
        'unit', eff.unit,
        'observation_window_start', eff.observation_window_start,
        'observation_window_end', eff.observation_window_end,
        'due_date', eff.due_date,
        'result', eff.result,
        'result_rationale', eff.result_rationale,
        'verified_by_membership_id', eff.verified_by_membership_id,
        'verified_at', eff.verified_at,
        'created_by_membership_id', eff.created_by_membership_id,
        'created_at', eff.created_at,
        'evidence_links', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', el.id,
                'attachment_id', el.attachment_id,
                'link_rationale', el.link_rationale
              )
            )
            from public.problem_solving_evidence_links el
            where el.organisation_id = org_id
              and el.problem_solving_case_id = target_case_id
              and el.effectiveness_check_id = eff.id
          ),
          '[]'::jsonb
        )
      )
      order by eff.created_at
    ),
    '[]'::jsonb
  )
  into effectiveness_checks
  from public.problem_solving_effectiveness_checks eff
  where eff.organisation_id = org_id
    and eff.case_id = target_case_id;

  -- Sustainment items
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'what', si.what,
        'owner_membership_id', si.owner_membership_id,
        'check_method', si.check_method,
        'follow_up_date', si.follow_up_date,
        'result', si.result,
        'training_session_id', si.training_session_id,
        'schedule_definition_id', si.schedule_definition_id,
        'evidence', si.evidence,
        'created_by_membership_id', si.created_by_membership_id,
        'created_at', si.created_at
      )
      order by si.created_at
    ),
    '[]'::jsonb
  )
  into sustainment_items
  from public.problem_solving_sustainment_items si
  where si.organisation_id = org_id
    and si.case_id = target_case_id;

  -- Lessons learned
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ll.id,
        'what_happened', ll.what_happened,
        'what_learned', ll.what_learned,
        'standardise', ll.standardise,
        'apply_elsewhere', ll.apply_elsewhere,
        'notes', ll.notes,
        'created_by_membership_id', ll.created_by_membership_id,
        'created_at', ll.created_at
      )
      order by ll.created_at
    ),
    '[]'::jsonb
  )
  into lessons_learned
  from public.problem_solving_lessons_learned ll
  where ll.organisation_id = org_id
    and ll.case_id = target_case_id;

  -- Sessions with participants and entry counts
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ps_session.id,
        'title', ps_session.title,
        'facilitator_membership_id', ps_session.facilitator_membership_id,
        'scheduled_at', ps_session.scheduled_at,
        'started_at', ps_session.started_at,
        'completed_at', ps_session.completed_at,
        'summary', ps_session.summary,
        'status', ps_session.status,
        'created_at', ps_session.created_at,
        'participants', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', sp.id,
                'membership_id', sp.membership_id,
                'added_at', sp.added_at
              )
            )
            from public.problem_solving_session_participants sp
            where sp.organisation_id = org_id
              and sp.session_id = ps_session.id
          ),
          '[]'::jsonb
        ),
        'entry_count', (
          select count(*)
          from public.problem_solving_session_entries se
          where se.organisation_id = org_id
            and se.session_id = ps_session.id
        )
      )
      order by ps_session.started_at desc nulls last, ps_session.created_at desc
    ),
    '[]'::jsonb
  )
  into sessions
  from public.problem_solving_sessions ps_session
  where ps_session.organisation_id = org_id
    and ps_session.case_id = target_case_id;

  -- Actions
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'description', a.description,
        'status', a.status,
        'priority', a.priority,
        'due_at', a.due_at,
        'completed_at', a.completed_at,
        'created_by_membership_id', a.created_by_membership_id,
        'context_role', ac.context_role,
        'countermeasure_id', ac.countermeasure_id,
        'containment_id', ac.containment_id,
        'sustainment_item_id', ac.sustainment_item_id,
        'created_at', a.created_at,
        'assignees', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'membership_id', aa.membership_id
              )
            )
            from public.action_assignees aa
            where aa.organisation_id = org_id
              and aa.action_id = a.id
          ),
          '[]'::jsonb
        )
      )
      order by a.created_at
    ),
    '[]'::jsonb
  )
  into actions
  from public.problem_solving_action_context ac
  join public.actions a
    on a.organisation_id = ac.organisation_id
   and a.id = ac.action_id
  where ac.organisation_id = org_id
    and ac.problem_solving_case_id = target_case_id
    and private.can_read_action(org_id, a.id);

  -- Evidence links (case-level)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', el.id,
        'attachment_id', el.attachment_id,
        'current_condition_item_id', el.current_condition_item_id,
        'containment_id', el.containment_id,
        'hypothesis_id', el.hypothesis_id,
        'hypothesis_test_id', el.hypothesis_test_id,
        'countermeasure_id', el.countermeasure_id,
        'effectiveness_check_id', el.effectiveness_check_id,
        'sustainment_item_id', el.sustainment_item_id,
        'session_id', el.session_id,
        'session_entry_id', el.session_entry_id,
        'is_case_level', el.is_case_level,
        'link_rationale', el.link_rationale,
        'created_by_membership_id', el.created_by_membership_id,
        'created_at', el.created_at
      )
      order by el.created_at
    ),
    '[]'::jsonb
  )
  into evidence_links
  from public.problem_solving_evidence_links el
  where el.organisation_id = org_id
    and el.problem_solving_case_id = target_case_id;

  -- Source links
  source_links := private.build_problem_solving_source_links_summary(org_id, target_case_id);
  membership_display_names := private.membership_public_display_names(
    org_id,
    (
      select coalesce(array_agg(distinct referenced.membership_id), '{}'::uuid[])
      from (
        select case_row.owner_membership_id as membership_id
        union
        select case_row.facilitator_membership_id
        union
        select case_row.created_by_membership_id
        union
        select case_row.closed_by_membership_id
        union
        select case_row.cancelled_by_membership_id
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(status_history, '[]'::jsonb)) history_entry
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(stage_history, '[]'::jsonb)) history_entry
        union
        select (hypothesis_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (countermeasure_entry->>'proposed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'selected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (effectiveness_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (effectiveness_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (sustainment_entry->>'owner_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (sustainment_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (lesson_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(lessons_learned, '[]'::jsonb)) lesson_entry
        union
        select (session_entry->>'facilitator_membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        union
        select (participant_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        cross join lateral jsonb_array_elements(
          coalesce(session_entry->'participants', '[]'::jsonb)
        ) participant_entry
        union
        select (evidence_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(evidence_links, '[]'::jsonb)) evidence_entry
        union
        select (action_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        union
        select (assignee_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        cross join lateral jsonb_array_elements(
          coalesce(action_entry->'assignees', '[]'::jsonb)
        ) assignee_entry
      ) referenced
      where referenced.membership_id is not null
    )
  );

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  limit 1;

  select private.ci_project_link_summary(org_id, linked_project_id)
  into linked_project;

  return jsonb_build_object(
    'id', case_row.id,
    'case_number', case_row.case_number,
    'title', case_row.title,
    'problem_statement', case_row.problem_statement,
    'background', case_row.background,
    'business_impact', case_row.business_impact,
    'scope_in', case_row.scope_in,
    'scope_out', case_row.scope_out,
    'target_condition', case_row.target_condition,
    'detected_at', case_row.detected_at,
    'status', case_row.status,
    'severity', case_row.severity,
    'priority', case_row.priority,
    'organisation_unit_id', case_row.organisation_unit_id,
    'unit_name', unit_row.name,
    'owner_membership_id', case_row.owner_membership_id,
    'owner_display_name', private.membership_public_display_name(
      org_id,
      case_row.owner_membership_id
    ),
    'facilitator_membership_id', case_row.facilitator_membership_id,
    'facilitator_display_name', private.membership_public_display_name(
      org_id,
      case_row.facilitator_membership_id
    ),
    'method_version_id', case_row.method_version_id,
    'current_method_stage_id', case_row.current_method_stage_id,
    'current_stage', current_stage,
    'closure_outcome', case_row.closure_outcome,
    'closure_rationale', case_row.closure_rationale,
    'transferred_to_reference', case_row.transferred_to_reference,
    'closed_at', case_row.closed_at,
    'closed_by_membership_id', case_row.closed_by_membership_id,
    'cancellation_rationale', case_row.cancellation_rationale,
    'cancelled_at', case_row.cancelled_at,
    'cancelled_by_membership_id', case_row.cancelled_by_membership_id,
    'target_due_at', case_row.target_due_at,
    'activated_at', case_row.activated_at,
    'created_by_membership_id', case_row.created_by_membership_id,
    'created_at', case_row.created_at,
    'updated_at', case_row.updated_at,
    'status_history', status_history,
    'stage_history', stage_history,
    'hypotheses', hypotheses,
    'countermeasures', countermeasures,
    'effectiveness_checks', effectiveness_checks,
    'sustainment_items', sustainment_items,
    'lessons_learned', lessons_learned,
    'sessions', sessions,
    'actions', actions,
    'evidence_links', evidence_links,
    'source_links', source_links,
    'membership_display_names', membership_display_names,
    'linked_project', linked_project
  );
end;
$$;