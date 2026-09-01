-- VIS1a: fail-closed linked Action visibility in get_problem_solving_detail.
-- Parent Problem Solving read does not imply child Action read; filter linked
-- actions through private.can_read_action (canonical Action read predicate).

-- get_problem_solving_detail

create or replace function public.get_problem_solving_detail(
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
    'facilitator_membership_id', case_row.facilitator_membership_id,
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
    'source_links', source_links
  );
end;
$$;
