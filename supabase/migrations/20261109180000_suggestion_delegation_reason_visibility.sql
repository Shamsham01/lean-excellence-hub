-- Delegation reason visibility: review UI, detail timeline, in-app + email payloads.
-- Hosted apply: run this migration separately after merge.

create or replace function private.lookup_suggestion_delegation_reason_for_recipient(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_recipient_membership_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(delegation_row.reason, 500)
  from public.suggestion_approval_delegations delegation_row
  where delegation_row.organisation_id = target_organisation_id
    and delegation_row.suggestion_id = target_suggestion_id
    and delegation_row.to_membership_id = target_recipient_membership_id
    and delegation_row.reason is not null
    and btrim(delegation_row.reason) <> ''
  order by delegation_row.created_at desc
  limit 1;
$$;

revoke all on function private.lookup_suggestion_delegation_reason_for_recipient(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.lookup_suggestion_delegation_reason_for_recipient(uuid, uuid, uuid)
  to postgres, lean_hub_private_owner;
alter function private.lookup_suggestion_delegation_reason_for_recipient(uuid, uuid, uuid)
  owner to lean_hub_private_owner;

create or replace function private.delegate_suggestion_approval(
  target_suggestion_id uuid,
  target_delegate_membership_id uuid,
  target_reason text default null
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
  suggestion_row public.improvement_suggestions%rowtype;
  routing_row public.suggestion_approval_routing%rowtype;
  prior_reviewer uuid;
  prior_assignment_id uuid;
  new_assignment_id uuid;
  normalized_reason text;
  next_generation integer;
  delegate_key text;
  existing_delegation_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'approval delegation is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  if suggestion_row.status not in ('submitted', 'under_review', 'parked') then
    raise exception 'suggestion is not delegable' using errcode = '55000';
  end if;

  if target_delegate_membership_id = actor_membership_id then
    raise exception 'cannot delegate approval to yourself' using errcode = '22023';
  end if;

  if target_delegate_membership_id = suggestion_row.author_membership_id then
    raise exception 'cannot delegate approval to the suggestion author' using errcode = '22023';
  end if;

  perform private.assert_eligible_suggestion_reviewer_membership(
    org_id,
    target_delegate_membership_id,
    suggestion_row.review_jurisdiction_unit_id
  );

  normalized_reason := nullif(btrim(coalesce(target_reason, '')), '');

  select assignment_row.id
  into new_assignment_id
  from public.suggestion_review_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.suggestion_id = target_suggestion_id
    and assignment_row.reviewer_membership_id = target_delegate_membership_id
    and assignment_row.status = 'active';

  if new_assignment_id is not null
    and exists (
      select 1
      from public.suggestion_approval_delegations delegation_row
      where delegation_row.organisation_id = org_id
        and delegation_row.suggestion_id = target_suggestion_id
        and delegation_row.to_membership_id = target_delegate_membership_id
        and delegation_row.delegated_by_membership_id = actor_membership_id
    )
    and exists (
      select 1
      from public.organisation_memberships membership_row
      where membership_row.id = actor_membership_id
        and membership_row.organisation_id = org_id
        and membership_row.status = 'active'
    )
    and private.membership_can_act_on_suggestion_approval_jurisdiction(
      org_id,
      actor_membership_id,
      suggestion_row.review_jurisdiction_unit_id
    ) then
    return new_assignment_id;
  end if;

  if not private.can_delegate_suggestion_approval(org_id, target_suggestion_id, actor_membership_id) then
    raise exception 'approval delegation is not authorised' using errcode = '42501';
  end if;

  select routing_table.*
  into routing_row
  from public.suggestion_approval_routing routing_table
  where routing_table.organisation_id = org_id
    and routing_table.suggestion_id = target_suggestion_id
  for update;

  select assignment_row.id, assignment_row.reviewer_membership_id
  into prior_assignment_id, prior_reviewer
  from public.suggestion_review_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.suggestion_id = target_suggestion_id
    and assignment_row.status = 'active'
  for update;

  if prior_reviewer = target_delegate_membership_id then
    select assignment_row.id
    into new_assignment_id
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = org_id
      and assignment_row.suggestion_id = target_suggestion_id
      and assignment_row.reviewer_membership_id = target_delegate_membership_id
      and assignment_row.status = 'active'
    limit 1;
    return new_assignment_id;
  end if;

  next_generation := coalesce(routing_row.notification_generation, 1) + 1;
  delegate_key := target_suggestion_id::text || ':delegate:' || target_delegate_membership_id::text || ':g' || next_generation::text;

  select delegation_row.id
  into existing_delegation_id
  from public.suggestion_approval_delegations delegation_row
  where delegation_row.organisation_id = org_id
    and delegation_row.idempotency_key = delegate_key;

  if existing_delegation_id is not null then
    select assignment_row.id
    into new_assignment_id
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = org_id
      and assignment_row.suggestion_id = target_suggestion_id
      and assignment_row.reviewer_membership_id = target_delegate_membership_id
      and assignment_row.status = 'active'
    order by assignment_row.assigned_at desc
    limit 1;
    if new_assignment_id is null then
      raise exception 'delegation idempotency refers to a completed assignment' using errcode = '55000';
    end if;
    return new_assignment_id;
  end if;

  if prior_assignment_id is not null then
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);
  end if;

  new_assignment_id := private.insert_suggestion_review_assignment(
    org_id,
    target_suggestion_id,
    target_delegate_membership_id,
    actor_membership_id,
    'delegated'
  );

  update public.suggestion_approval_routing routing_table
  set task_owner_membership_id = target_delegate_membership_id,
      notification_generation = next_generation,
      updated_at = statement_timestamp()
  where routing_table.organisation_id = org_id
    and routing_table.suggestion_id = target_suggestion_id;

  insert into public.suggestion_approval_delegations (
    organisation_id,
    suggestion_id,
    from_membership_id,
    to_membership_id,
    delegated_by_membership_id,
    reason,
    idempotency_key,
    notification_generation
  ) values (
    org_id,
    target_suggestion_id,
    coalesce(prior_reviewer, routing_row.task_owner_membership_id, actor_membership_id),
    target_delegate_membership_id,
    actor_membership_id,
    normalized_reason,
    delegate_key,
    next_generation
  );

  perform private.revoke_all_suggestion_approval_in_app_notifications(
    org_id,
    target_suggestion_id,
    null
  );

  perform private.insert_membership_in_app_notification(
    org_id,
    target_delegate_membership_id,
    'suggestions.awaiting_review',
    'Approval delegated to you',
    coalesce(
      nullif(btrim(suggestion_row.suggestion_number), ''),
      suggestion_row.title
    ) || ' was delegated to you for approval.'
      || coalesce(
        case
          when normalized_reason is not null then
            E'\n\nReason: ' || left(normalized_reason, 400)
          else ''
        end,
        ''
      ),
    '/platform/suggestions/review?queue=mine&suggestionId=' || target_suggestion_id::text,
    private.suggestion_approval_in_app_dedupe_key(target_suggestion_id, next_generation)
  );

  perform private.append_business_audit(
    org_id,
    'suggestion.approval_delegated',
    target_suggestion_id,
    'succeeded',
    jsonb_build_object(
      'assignment_id', new_assignment_id,
      'delegate_membership_id', target_delegate_membership_id,
      'reason', normalized_reason,
      'notification_generation', next_generation
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionReviewerReassigned',
    new_assignment_id::text,
    jsonb_build_object(
      'reviewer_membership_id', target_delegate_membership_id,
      'idempotency_key', delegate_key
    )
  );

  return new_assignment_id;
end;
$$;


-- Review context + latest delegation metadata vs delegate eligible reviewer lists for review workspace UI.

-- Review context: pending primary + delegation authority flag
create or replace function public.get_suggestion_review_context(
  target_suggestion_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid;
  suggestion_row public.improvement_suggestions%rowtype;
  can_view_metadata boolean;
  has_active_reviewer boolean;
  active_reviewer_member_id uuid;
  active_reviewer_display_name text;
  active_reviewer_assignment_kind text;
  active_reviewer_assigned_at timestamptz;
  eligible_assign_reviewers jsonb := '[]'::jsonb;
  eligible_delegate_reviewers jsonb := '[]'::jsonb;
  eligible_reviewers jsonb := '[]'::jsonb;
  primary_approver_member_id uuid;
  primary_approver_display_name text;
  task_owner_member_id uuid;
  task_owner_display_name text;
  delegate_authority text;
  latest_delegation jsonb := null;
begin
  if org_id is null then
    raise exception 'review context is not authorised' using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(org_id);

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found' using errcode = 'P0002';
  end if;

  can_view_metadata := private.can_view_suggestion_reviewer_metadata(
    org_id,
    suggestion_row.id,
    suggestion_row.review_jurisdiction_unit_id,
    actor_membership_id
  );

  has_active_reviewer := private.suggestion_has_active_reviewer(org_id, suggestion_row.id);

  select
    routing_row.primary_approver_membership_id,
    routing_row.task_owner_membership_id
  into primary_approver_member_id, task_owner_member_id
  from public.suggestion_approval_routing routing_row
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = suggestion_row.id;

  if primary_approver_member_id is not null then
    select nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '')
    into primary_approver_display_name
    from public.organisation_memberships membership_row
    left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
    where membership_row.organisation_id = org_id
      and membership_row.id = primary_approver_member_id;
  end if;

  if task_owner_member_id is not null then
    select nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '')
    into task_owner_display_name
    from public.organisation_memberships membership_row
    left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
    where membership_row.organisation_id = org_id
      and membership_row.id = task_owner_member_id;
  end if;

  if can_view_metadata then
    select
      assignment_row.reviewer_membership_id,
      nullif(btrim(coalesce(reviewer_membership.display_name, reviewer_profile.display_name)), ''),
      assignment_row.assignment_kind,
      assignment_row.assigned_at
    into
      active_reviewer_member_id,
      active_reviewer_display_name,
      active_reviewer_assignment_kind,
      active_reviewer_assigned_at
    from public.suggestion_review_assignments assignment_row
    left join public.organisation_memberships reviewer_membership
      on reviewer_membership.organisation_id = assignment_row.organisation_id
      and reviewer_membership.id = assignment_row.reviewer_membership_id
    left join public.profiles reviewer_profile
      on reviewer_profile.user_id = reviewer_membership.user_id
    where assignment_row.organisation_id = org_id
      and assignment_row.suggestion_id = suggestion_row.id
      and assignment_row.status = 'active'
    limit 1;
  end if;

  if private.can_delegate_suggestion_approval(org_id, suggestion_row.id, actor_membership_id) then
    if private.actor_has_suggestion_manager_override(org_id, suggestion_row.id, actor_membership_id) then
      delegate_authority := 'manager_override';
    elsif private.is_active_suggestion_reviewer(org_id, suggestion_row.id, actor_membership_id) then
      delegate_authority := 'active_reviewer';
    else
      delegate_authority := 'primary_approver';
    end if;
  else
    delegate_authority := null;
  end if;

  if private.can_assign_suggestion_reviewer(
    org_id,
    suggestion_row.review_jurisdiction_unit_id
  )
  and suggestion_row.status in ('submitted', 'under_review', 'parked') then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', eligible_row.member_id,
          'display_name', eligible_row.display_name
        )
        order by eligible_row.display_name nulls last, eligible_row.member_id
      ),
      '[]'::jsonb
    )
    into eligible_assign_reviewers
    from (
      select
        membership_row.id as member_id,
        nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '') as display_name
      from public.organisation_memberships membership_row
      left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and private.membership_can_review_suggestion_jurisdiction(
          org_id,
          membership_row.id,
          suggestion_row.review_jurisdiction_unit_id
        )
    ) eligible_row;
  end if;

  if delegate_authority is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', eligible_row.member_id,
          'display_name', eligible_row.display_name
        )
        order by eligible_row.display_name nulls last, eligible_row.member_id
      ),
      '[]'::jsonb
    )
    into eligible_delegate_reviewers
    from (
      select
        membership_row.id as member_id,
        nullif(btrim(coalesce(membership_row.display_name, profile_row.display_name)), '') as display_name
      from public.organisation_memberships membership_row
      left join public.profiles profile_row on profile_row.user_id = membership_row.user_id
      where membership_row.organisation_id = org_id
        and membership_row.status = 'active'
        and membership_row.id is distinct from suggestion_row.author_membership_id
        and membership_row.id is distinct from actor_membership_id
        and private.membership_can_review_suggestion_jurisdiction(
          org_id,
          membership_row.id,
          suggestion_row.review_jurisdiction_unit_id
        )
    ) eligible_row;
  end if;

  if private.can_read_improvement_suggestion(org_id, suggestion_row.id) then
    select jsonb_build_object(
      'delegated_by_display_name', nullif(
        btrim(coalesce(by_membership.display_name, by_profile.display_name)),
        ''
      ),
      'delegated_at', delegation_row.created_at,
      'reason', delegation_row.reason,
      'to_member_id', delegation_row.to_membership_id,
      'delegated_by_member_id', delegation_row.delegated_by_membership_id
    )
    into latest_delegation
    from public.suggestion_approval_delegations delegation_row
    join public.organisation_memberships by_membership
      on by_membership.organisation_id = delegation_row.organisation_id
     and by_membership.id = delegation_row.delegated_by_membership_id
    left join public.profiles by_profile
      on by_profile.user_id = by_membership.user_id
    where delegation_row.organisation_id = org_id
      and delegation_row.suggestion_id = suggestion_row.id
    order by delegation_row.created_at desc
    limit 1;
  end if;

  eligible_reviewers := eligible_assign_reviewers;

  return jsonb_build_object(
    'suggestion', jsonb_build_object(
      'id', suggestion_row.id,
      'suggestion_number', suggestion_row.suggestion_number,
      'title', suggestion_row.title,
      'status', suggestion_row.status,
      'problem_or_opportunity', suggestion_row.problem_or_opportunity,
      'proposed_idea', suggestion_row.proposed_idea,
      'category_name', suggestion_row.category_name_snapshot,
      'programme_name', suggestion_row.programme_name_snapshot,
      'origin_unit_name', suggestion_row.origin_unit_name_snapshot,
      'submitted_at', suggestion_row.submitted_at,
      'created_at', suggestion_row.created_at,
      'updated_at', suggestion_row.updated_at,
      'parked_at', suggestion_row.parked_at,
      'parked_rationale', suggestion_row.parked_rationale
    ),
    'reviewer', case
      when can_view_metadata and active_reviewer_member_id is not null then
        jsonb_build_object(
          'member_id', active_reviewer_member_id,
          'display_name', active_reviewer_display_name,
          'assignment_kind', active_reviewer_assignment_kind,
          'assigned_at', active_reviewer_assigned_at
        )
      else null
    end,
    'pending_approver', case
      when can_view_metadata and primary_approver_member_id is not null then
        jsonb_build_object(
          'member_id', primary_approver_member_id,
          'display_name', primary_approver_display_name
        )
      else null
    end,
    'task_owner', case
      when can_view_metadata and task_owner_member_id is not null then
        jsonb_build_object(
          'member_id', task_owner_member_id,
          'display_name', task_owner_display_name
        )
      else null
    end,
    'permissions', jsonb_build_object(
      'is_active_reviewer', private.is_active_suggestion_reviewer(
        org_id,
        suggestion_row.id,
        actor_membership_id
      ),
      'can_claim',
        suggestion_row.status = 'submitted'
        and not has_active_reviewer
        and private.can_claim_suggestion_for_review(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        ),
      'can_assign',
        suggestion_row.status in ('submitted', 'under_review', 'parked')
        and private.can_assign_suggestion_reviewer(
          org_id,
          suggestion_row.review_jurisdiction_unit_id
        ),
      'can_delegate', delegate_authority is not null,
      'delegation_authority', delegate_authority,
      'can_begin_review',
        suggestion_row.status in ('submitted', 'parked')
        and private.can_act_as_active_suggestion_reviewer(
          org_id,
          suggestion_row.id,
          actor_membership_id
        ),
      'can_record_review',
        suggestion_row.status = 'under_review'
        and private.can_act_as_active_suggestion_reviewer(
          org_id,
          suggestion_row.id,
          actor_membership_id
        )
    ),
    'eligible_reviewers', eligible_reviewers,
    'eligible_assign_reviewers', eligible_assign_reviewers,
    'eligible_delegate_reviewers', eligible_delegate_reviewers,
    'latest_delegation', latest_delegation
  );
end;
$$;

create or replace function public.get_suggestion_detail(target_suggestion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  suggestion_row public.improvement_suggestions%rowtype;
  linked_actions jsonb;
  linked_projects jsonb;
  approval_delegations jsonb := '[]'::jsonb;
begin
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion detail is not authorised'
      using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  if not found then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', action_row.id,
        'action_number', action_row.action_number,
        'title', action_row.title,
        'status', action_row.status,
        'href', '/platform/actions/' || action_row.id::text,
        'can_open', private.can_read_action(org_id, action_row.id)
      )
      order by action_row.created_at, action_row.id
    ),
    '[]'::jsonb
  )
  into linked_actions
  from public.suggestion_action_context context_row
  join public.actions action_row
    on action_row.organisation_id = context_row.organisation_id
   and action_row.id = context_row.action_id
  where context_row.organisation_id = org_id
    and context_row.suggestion_id = target_suggestion_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', project_row.id,
        'project_number', project_row.project_number,
        'title', project_row.title,
        'status', project_row.status,
        'href', '/platform/projects/' || project_row.id::text,
        'can_open', private.can_read_ci_project(org_id, project_row.id)
      )
      order by project_row.created_at, project_row.id
    ),
    '[]'::jsonb
  )
  into linked_projects
  from public.suggestion_implementation_links link_row
  join public.ci_projects project_row
    on project_row.organisation_id = link_row.organisation_id
   and project_row.id = link_row.implementation_resource_id
  where link_row.organisation_id = org_id
    and link_row.suggestion_id = target_suggestion_id
    and link_row.implementation_role = 'ci_project';


  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', delegation_row.id,
        'delegated_at', delegation_row.created_at,
        'reason', delegation_row.reason,
        'delegated_by_display_name', nullif(
          btrim(coalesce(by_membership.display_name, by_profile.display_name)),
          ''
        ),
        'to_display_name', nullif(
          btrim(coalesce(to_membership.display_name, to_profile.display_name)),
          ''
        )
      )
      order by delegation_row.created_at desc
    ),
    '[]'::jsonb
  )
  into approval_delegations
  from public.suggestion_approval_delegations delegation_row
  join public.organisation_memberships by_membership
    on by_membership.organisation_id = delegation_row.organisation_id
   and by_membership.id = delegation_row.delegated_by_membership_id
  join public.organisation_memberships to_membership
    on to_membership.organisation_id = delegation_row.organisation_id
   and to_membership.id = delegation_row.to_membership_id
  left join public.profiles by_profile
    on by_profile.user_id = by_membership.user_id
  left join public.profiles to_profile
    on to_profile.user_id = to_membership.user_id
  where delegation_row.organisation_id = org_id
    and delegation_row.suggestion_id = target_suggestion_id;

  return jsonb_build_object(
    'id', suggestion_row.id,
    'suggestion_number', suggestion_row.suggestion_number,
    'title', suggestion_row.title,
    'problem_or_opportunity', suggestion_row.problem_or_opportunity,
    'proposed_idea', suggestion_row.proposed_idea,
    'expected_benefit_summary', suggestion_row.expected_benefit_summary,
    'status', suggestion_row.status,
    'programme_name_snapshot', suggestion_row.programme_name_snapshot,
    'category_name_snapshot', suggestion_row.category_name_snapshot,
    'origin_unit_name_snapshot', suggestion_row.origin_unit_name_snapshot,
    'target_unit_name_snapshot', suggestion_row.target_unit_name_snapshot,
    'author_membership_id', suggestion_row.author_membership_id,
    'submitted_at', suggestion_row.submitted_at,
    'implementation_summary', suggestion_row.implementation_summary,
    'implementation_outcome', suggestion_row.implementation_outcome,
    'employee_outcome', suggestion_row.employee_outcome,
    'implemented_at', suggestion_row.implemented_at,
    'linked_actions', linked_actions,
    'linked_projects', linked_projects,
    'approval_delegations', approval_delegations
  );
end;
$$;
-- Delivery context includes delegation reason on reassigned emails context for suggestions.awaiting_review (snapshotted recipient).

create or replace function private.get_notification_delivery_context(
  target_organisation_id uuid,
  target_delivery_id uuid,
  target_source_domain_event_id uuid
)
returns table (
  organisation_id uuid,
  organisation_name text,
  delivery_id uuid,
  source_domain_event_id uuid,
  notification_kind text,
  recipient_membership_id uuid,
  recipient_display_name text,
  recipient_resolution_status text,
  deliverable_email text,
  event_type text,
  resource_record_id uuid,
  event_payload jsonb,
  context_title text,
  context_detail text,
  context_link_path text,
  context_employee_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  delivery_row private.notification_delivery_ledger%rowtype;
  event_row private.domain_event_outbox%rowtype;
  membership_row public.organisation_memberships%rowtype;
  organisation_row public.organisations%rowtype;
  notification_contact text;
  auth_email text;
  workforce_status text;
  resolved_email text;
  resolution_status text;
  resolved_title text;
  resolved_detail text;
  resolved_link_path text;
  resolved_employee_message text;
  suggestion_author_membership_id uuid;
  review_id uuid;
  profile_display_name text;
  payload_suggestion_id uuid;
begin
  select ledger_row.*
  into delivery_row
  from private.notification_delivery_ledger ledger_row
  where ledger_row.organisation_id = target_organisation_id
    and ledger_row.id = target_delivery_id
    and ledger_row.source_domain_event_id = target_source_domain_event_id;

  if delivery_row.id is null then
    return;
  end if;

  select outbox_row.*
  into event_row
  from private.domain_event_outbox outbox_row
  where outbox_row.organisation_id = target_organisation_id
    and outbox_row.id = target_source_domain_event_id;

  if event_row.id is null then
    return;
  end if;

  select membership.*
  into membership_row
  from public.organisation_memberships membership
  where membership.organisation_id = target_organisation_id
    and membership.id = delivery_row.recipient_membership_id;

  if membership_row.id is null then
    return;
  end if;

  select profile_row.display_name
  into profile_display_name
  from public.profiles profile_row
  where profile_row.user_id = membership_row.user_id;

  select organisation.*
  into organisation_row
  from public.organisations organisation
  where organisation.id = target_organisation_id;

  if organisation_row.id is null then
    return;
  end if;

  select contact_row.contact_address
  into notification_contact
  from public.membership_notification_contacts contact_row
  where contact_row.organisation_id = target_organisation_id
    and contact_row.membership_id = delivery_row.recipient_membership_id
    and contact_row.channel_type = 'email'
    and contact_row.status = 'active'
  limit 1;

  select lower(btrim(auth_user.email))
  into auth_email
  from auth.users auth_user
  where auth_user.id = membership_row.user_id;

  select workforce_account.status
  into workforce_status
  from private.workforce_accounts workforce_account
  where workforce_account.user_id = membership_row.user_id
  limit 1;

  if membership_row.status <> 'active' then
    resolution_status := 'inactive_membership';
    resolved_email := null;
  elsif workforce_status = 'disabled' then
    resolution_status := 'disabled_workforce_account';
    resolved_email := null;
  elsif notification_contact is not null
    and private.is_deliverable_email_address(notification_contact) then
    resolution_status := 'deliverable';
    resolved_email := notification_contact;
  elsif notification_contact is not null then
    resolution_status := 'invalid_email';
    resolved_email := null;
  elsif auth_email is not null
    and private.is_deliverable_email_address(auth_email) then
    resolution_status := 'deliverable';
    resolved_email := auth_email;
  elsif auth_email is not null
    and (
      auth_email like '%@workforce.invalid'
      or right(auth_email, 8) = '.invalid'
    ) then
    resolution_status := 'synthetic_auth_email';
    resolved_email := null;
  elsif auth_email is not null then
    resolution_status := 'invalid_email';
    resolved_email := null;
  else
    resolution_status := 'no_contact';
    resolved_email := null;
  end if;

  resolved_title := null;
  resolved_detail := null;
  resolved_link_path := null;
  resolved_employee_message := null;

  if delivery_row.notification_kind = 'workforce.job_function_assigned' then
    select
      coalesce(assignment_row.job_function_name_snapshot, 'Job function'),
      case
        when assignment_row.is_primary then 'Primary assignment'
        else 'Assignment update'
      end,
      '/platform/people'
    into resolved_title, resolved_detail, resolved_link_path
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/people');
  elsif delivery_row.notification_kind = 'workforce.training_completed' then
    select
      coalesce(course_row.name, 'Training course'),
      'Training completion recorded',
      case
        when course_row.id is not null
          then '/platform/training/courses/' || course_row.id::text
        else '/platform/training/matrix'
      end
    into resolved_title, resolved_detail, resolved_link_path
    from public.training_completions completion_row
    left join public.training_courses course_row
      on course_row.organisation_id = completion_row.organisation_id
     and course_row.id = completion_row.course_id
    where completion_row.organisation_id = target_organisation_id
      and completion_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/training/matrix');
  elsif delivery_row.notification_kind = 'workforce.skill_proficiency_validated' then
    select
      coalesce(skill_row.name, 'Skill'),
      'Skill proficiency validated',
      case
        when skill_row.id is not null
          then '/platform/skills/' || skill_row.id::text
        else '/platform/skills/matrix'
      end
    into resolved_title, resolved_detail, resolved_link_path
    from public.membership_skill_assessments assessment_row
    left join public.skills skill_row
      on skill_row.organisation_id = assessment_row.organisation_id
     and skill_row.id = assessment_row.skill_id
    where assessment_row.organisation_id = target_organisation_id
      and assessment_row.id = event_row.resource_record_id
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/skills/matrix');
  elsif delivery_row.notification_kind = 'recognition.awarded' then
    select
      coalesce(award_row.title, 'Recognition award'),
      left(award_row.message, 500),
      '/platform/recognition'
    into resolved_title, resolved_detail, resolved_link_path
    from public.recognition_awards award_row
    where award_row.organisation_id = target_organisation_id
      and award_row.id = event_row.resource_record_id
      and award_row.status = 'active'
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/recognition');
  elsif delivery_row.notification_kind = 'suggestions.awaiting_review' then
    select
      coalesce(
        nullif(btrim(suggestion_row.suggestion_number), ''),
        suggestion_row.title
      ),
      'An improvement idea needs your approval',
      '/platform/suggestions/review?queue=all&suggestionId=' || suggestion_row.id::text
    into resolved_title, resolved_detail, resolved_link_path
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = event_row.resource_record_id
    limit 1;

    if resolution_status = 'deliverable'
      and (
        event_row.resource_record_id is null
        or not exists (
          select 1
          from public.suggestion_approval_routing routing_row
          where routing_row.organisation_id = target_organisation_id
            and routing_row.suggestion_id = event_row.resource_record_id
            and routing_row.email_recipient_membership_id = delivery_row.recipient_membership_id
        )
        or not private.membership_can_read_improvement_suggestion(
          target_organisation_id,
          event_row.resource_record_id,
          delivery_row.recipient_membership_id
        )
      ) then
      resolution_status := 'not_authorized';
      resolved_email := null;
    end if;
  elsif delivery_row.notification_kind in (
    'suggestions.reviewer_assigned',
    'suggestions.reviewer_reassigned',
    'suggestions.more_information_required',
    'suggestions.approved',
    'suggestions.declined',
    'suggestions.parked',
    'suggestions.implemented'
  ) then
    select
      coalesce(
        nullif(btrim(suggestion_row.suggestion_number), ''),
        suggestion_row.title
      ),
      case delivery_row.notification_kind
        when 'suggestions.reviewer_assigned' then 'Assigned to you for review'
        when 'suggestions.reviewer_reassigned' then 'Reassigned to you for review'
        when 'suggestions.more_information_required' then 'More information is needed'
        when 'suggestions.approved' then 'Your suggestion was approved'
        when 'suggestions.declined' then 'Your suggestion was declined'
        when 'suggestions.parked' then 'Your suggestion was parked for further consideration'
        when 'suggestions.implemented' then 'Your suggestion has been implemented'
      end,
      case
        when delivery_row.notification_kind in (
          'suggestions.reviewer_assigned',
          'suggestions.reviewer_reassigned'
        ) then
          '/platform/suggestions/review?queue=mine&suggestionId='
            || suggestion_row.id::text
        else '/platform/suggestions/' || suggestion_row.id::text
      end,
      suggestion_row.author_membership_id
    into
      resolved_title,
      resolved_detail,
      resolved_link_path,
      suggestion_author_membership_id
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = event_row.resource_record_id
    limit 1;

    if delivery_row.notification_kind = 'suggestions.implemented' then
      resolved_employee_message := private.lookup_suggestion_employee_outcome(
        target_organisation_id,
        event_row.resource_record_id
      );

      if resolved_employee_message is null then
        resolution_status := 'not_authorized';
        resolved_email := null;
      end if;
    elsif delivery_row.notification_kind in (
      'suggestions.more_information_required',
      'suggestions.approved',
      'suggestions.declined',
      'suggestions.parked'
    ) then
      review_id := nullif(event_row.payload ->> 'review_id', '')::uuid;
      payload_suggestion_id := nullif(event_row.payload ->> 'suggestion_id', '')::uuid;

      if review_id is null
        or payload_suggestion_id is distinct from event_row.resource_record_id then
        resolution_status := 'not_authorized';
        resolved_email := null;
      else
        resolved_employee_message := private.lookup_suggestion_review_employee_feedback(
          target_organisation_id,
          event_row.resource_record_id,
          review_id,
          case delivery_row.notification_kind
            when 'suggestions.more_information_required' then 'needs_more_information'
            when 'suggestions.approved' then 'accept'
            when 'suggestions.declined' then 'reject'
            when 'suggestions.parked' then 'park'
          end
        );

        if resolved_employee_message is null then
          resolution_status := 'not_authorized';
          resolved_email := null;
        end if;
      end if;
    end if;

    if delivery_row.notification_kind in (
      'suggestions.reviewer_assigned',
      'suggestions.reviewer_reassigned'
    ) then
      if resolution_status = 'deliverable'
        and (
          event_row.resource_record_id is null
          or not private.is_active_suggestion_reviewer(
            target_organisation_id,
            event_row.resource_record_id,
            delivery_row.recipient_membership_id
          )
          or not private.membership_can_read_improvement_suggestion(
            target_organisation_id,
            event_row.resource_record_id,
            delivery_row.recipient_membership_id
          )
        ) then
        resolution_status := 'not_authorized';
        resolved_email := null;
      end if;
    elsif delivery_row.notification_kind in (
      'suggestions.more_information_required',
      'suggestions.approved',
      'suggestions.declined',
      'suggestions.parked',
      'suggestions.implemented'
    ) then
      if resolution_status = 'deliverable'
        and (
          event_row.resource_record_id is null
          or suggestion_author_membership_id is distinct from delivery_row.recipient_membership_id
          or not private.membership_can_read_improvement_suggestion(
            target_organisation_id,
            event_row.resource_record_id,
            delivery_row.recipient_membership_id
          )
        ) then
        resolution_status := 'not_authorized';
        resolved_email := null;
      end if;
    end if;
  end if;


  if delivery_row.notification_kind = 'schedule.occurrence_reminder' then
    select
      coalesce(nullif(btrim(schedule_row.title), ''), 'Scheduled activity'),
      concat(
        'Due ',
        to_char(occurrence_row.planned_local_date, 'YYYY-MM-DD'),
        case
          when occurrence_row.is_all_day then ' (all day)'
          else coalesce(' at ' || to_char(occurrence_row.local_time, 'HH24:MI'), '')
        end
      ),
      '/platform/schedule/' || occurrence_row.schedule_definition_id::text
    into resolved_title, resolved_detail, resolved_link_path
    from public.schedule_occurrences occurrence_row
    join public.schedule_definitions schedule_row
      on schedule_row.organisation_id = occurrence_row.organisation_id
     and schedule_row.id = occurrence_row.schedule_definition_id
    where occurrence_row.organisation_id = target_organisation_id
      and occurrence_row.id = nullif(event_row.payload ->> 'occurrence_id', '')::uuid
    limit 1;

    resolved_link_path := coalesce(resolved_link_path, '/platform/schedule');
  end if;

  if delivery_row.notification_kind = 'suggestions.reviewer_reassigned'
    and resolution_status = 'deliverable'
    and event_row.resource_record_id is not null then
    resolved_employee_message := private.lookup_suggestion_delegation_reason_for_recipient(
      target_organisation_id,
      event_row.resource_record_id,
      delivery_row.recipient_membership_id
    );
  end if;

  return query
  select
    target_organisation_id,
    organisation_row.name,
    delivery_row.id,
    delivery_row.source_domain_event_id,
    delivery_row.notification_kind,
    delivery_row.recipient_membership_id,
    coalesce(
      nullif(btrim(membership_row.display_name), ''),
      nullif(btrim(profile_display_name), '')
    ),
    resolution_status,
    resolved_email,
    event_row.event_type,
    event_row.resource_record_id,
    event_row.payload,
    resolved_title,
    resolved_detail,
    resolved_link_path,
    resolved_employee_message;
end;
$$;

