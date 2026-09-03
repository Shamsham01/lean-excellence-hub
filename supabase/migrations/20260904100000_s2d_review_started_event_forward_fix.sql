-- S2d forward fix: restore SuggestionReviewStarted domain event emission on begin review.
--
-- Root cause: private.begin_suggestion_review (S2a) enqueues SuggestionReviewStarted with
-- idempotency_key = target_suggestion_id::text, which collides with SuggestionSubmitted on
-- the (organisation_id, idempotency_key) unique constraint. private.enqueue_domain_event
-- uses ON CONFLICT DO NOTHING, so the review-started event is silently suppressed.
--
-- Fix: qualify the idempotency key with the event type, matching the SuggestionImplemented
-- precedent in S2d. No other review workflow behaviour changes.

create or replace function private.begin_suggestion_review(target_suggestion_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  from_status text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'review start is not authorised' using errcode = '42501';
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

  if suggestion_row.status not in ('submitted', 'parked') then
    raise exception 'suggestion is not reviewable' using errcode = '55000';
  end if;

  if not private.can_act_as_active_suggestion_reviewer(
    org_id,
    target_suggestion_id,
    actor_membership_id
  ) then
    raise exception 'review start is not authorised' using errcode = '42501';
  end if;

  from_status := suggestion_row.status;

  update public.improvement_suggestions suggestion_table
  set status = 'under_review',
      updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id,
    target_suggestion_id,
    from_status,
    'under_review',
    actor_membership_id,
    'review started'
  );

  perform private.append_business_audit(
    org_id,
    'suggestion.review_started',
    target_suggestion_id,
    'succeeded',
    '{}'::jsonb
  );
  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionReviewStarted',
    'SuggestionReviewStarted:' || target_suggestion_id::text,
    '{}'::jsonb
  );

  return true;
end;
$$;

alter function private.begin_suggestion_review(uuid) owner to lean_hub_private_owner;
