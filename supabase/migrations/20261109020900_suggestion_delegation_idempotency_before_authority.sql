-- Same-actor delegate idempotency returns before can_delegate; competing delegations still require authority.

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
    ) || ' was delegated to you for approval.',
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

alter function private.delegate_suggestion_approval(uuid, uuid, text) owner to lean_hub_private_owner;
