-- S2a: authoritative suggestion reviewer assignment and review workflow.

-- ---------------------------------------------------------------------------
-- Schema: parked lifecycle + assignment metadata
-- ---------------------------------------------------------------------------

alter table public.improvement_suggestions
  drop constraint improvement_suggestions_status_check;

alter table public.improvement_suggestions
  add constraint improvement_suggestions_status_check
  check (
    status in (
      'draft',
      'submitted',
      'under_review',
      'accepted',
      'implementing',
      'implemented',
      'rejected',
      'withdrawn',
      'parked'
    )
  );

alter table public.improvement_suggestions
  add column if not exists parked_at timestamptz,
  add column if not exists parked_rationale text,
  add constraint improvement_suggestions_parked_rationale_check
    check (
      parked_rationale is null
      or (
        parked_rationale = btrim(parked_rationale)
        and char_length(parked_rationale) between 1 and 4000
      )
    );

alter table public.suggestion_review_assignments
  add column if not exists assignment_kind text not null default 'assigned',
  add constraint suggestion_review_assignments_assignment_kind_check
    check (assignment_kind in ('claimed', 'assigned', 'reassigned'));

create unique index if not exists suggestion_review_assignments_one_active_per_suggestion_idx
  on public.suggestion_review_assignments (organisation_id, suggestion_id)
  where status = 'active';

alter table public.suggestion_reviews
  drop constraint if exists suggestion_reviews_decision_check;

alter table public.suggestion_reviews
  add constraint suggestion_reviews_decision_check
  check (decision in ('accept', 'reject', 'needs_more_information', 'park'));

-- ---------------------------------------------------------------------------
-- Visibility: temporary active-reviewer read path
-- ---------------------------------------------------------------------------

create or replace function private.can_read_improvement_suggestion(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = target_suggestion_id
      and (
        private.has_scoped_permission(
          target_organisation_id,
          'suggestions.read',
          null,
          null
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'suggestions.read',
          null,
          suggestion_row.origin_unit_id
        )
        or private.has_scoped_permission(
          target_organisation_id,
          'suggestions.read',
          null,
          suggestion_row.review_jurisdiction_unit_id
        )
        or (
          private.has_scoped_permission(
            target_organisation_id,
            'suggestions.read',
            suggestion_row.author_membership_id,
            null
          )
          and (
            suggestion_row.author_membership_id = private.current_membership_id(target_organisation_id)
            or private.is_active_suggestion_contributor(
              target_organisation_id,
              target_suggestion_id,
              private.current_membership_id(target_organisation_id)
            )
            or private.is_active_suggestion_reviewer(
              target_organisation_id,
              target_suggestion_id,
              private.current_membership_id(target_organisation_id)
            )
          )
        )
        or (
          private.is_active_suggestion_reviewer(
            target_organisation_id,
            target_suggestion_id,
            private.current_membership_id(target_organisation_id)
          )
          and private.can_review_suggestion(
            target_organisation_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Workflow helpers
-- ---------------------------------------------------------------------------

create or replace function private.suggestion_has_active_reviewer(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.suggestion_id = target_suggestion_id
      and assignment_row.status = 'active'
  )
$$;

create or replace function private.can_claim_suggestion_for_review(
  target_organisation_id uuid,
  target_jurisdiction_unit_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_review_suggestion(target_organisation_id, target_jurisdiction_unit_id)
    or private.has_scoped_permission(
      target_organisation_id,
      'suggestions.manage',
      null,
      null
    )
    or private.has_scoped_permission(
      target_organisation_id,
      'suggestions.manage',
      null,
      target_jurisdiction_unit_id
    )
$$;

create or replace function private.can_assign_suggestion_reviewer(
  target_organisation_id uuid,
  target_jurisdiction_unit_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'suggestions.manage',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.manage',
    null,
    target_jurisdiction_unit_id
  )
$$;

create or replace function private.membership_can_review_suggestion_jurisdiction(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_jurisdiction_unit_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.review',
    null,
    null
  )
  or private.membership_has_scoped_permission(
    target_membership_id,
    target_organisation_id,
    'suggestions.review',
    null,
    target_jurisdiction_unit_id
  )
$$;

create or replace function private.assert_eligible_suggestion_reviewer_membership(
  target_organisation_id uuid,
  target_reviewer_membership_id uuid,
  target_jurisdiction_unit_id uuid
)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  membership_status text;
begin
  select membership_row.status
  into membership_status
  from public.organisation_memberships membership_row
  where membership_row.organisation_id = target_organisation_id
    and membership_row.id = target_reviewer_membership_id;

  if membership_status is distinct from 'active' then
    raise exception 'inactive membership cannot be assigned as reviewer'
      using errcode = '22023';
  end if;

  if not private.membership_can_review_suggestion_jurisdiction(
    target_organisation_id,
    target_reviewer_membership_id,
    target_jurisdiction_unit_id
  ) then
    raise exception 'target reviewer lacks review capability for jurisdiction'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.can_act_as_active_suggestion_reviewer(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_actor_membership_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = target_suggestion_id
      and (
        (
          private.is_active_suggestion_reviewer(
            target_organisation_id,
            target_suggestion_id,
            target_actor_membership_id
          )
          and private.can_review_suggestion(
            target_organisation_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
        or private.can_assign_suggestion_reviewer(
          target_organisation_id,
          suggestion_row.review_jurisdiction_unit_id
        )
      )
  )
$$;

create or replace function private.end_active_suggestion_review_assignment(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.suggestion_review_assignments assignment_row
  set status = 'completed',
      completed_at = statement_timestamp()
  where assignment_row.organisation_id = target_organisation_id
    and assignment_row.suggestion_id = target_suggestion_id
    and assignment_row.status = 'active';
end;
$$;

create or replace function private.insert_suggestion_review_assignment(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_reviewer_membership_id uuid,
  target_assigned_by_membership_id uuid,
  target_assignment_kind text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  new_assignment_id uuid;
begin
  insert into public.suggestion_review_assignments (
    organisation_id,
    suggestion_id,
    reviewer_membership_id,
    assigned_by_membership_id,
    assignment_kind
  ) values (
    target_organisation_id,
    target_suggestion_id,
    target_reviewer_membership_id,
    target_assigned_by_membership_id,
    target_assignment_kind
  )
  returning id into new_assignment_id;

  return new_assignment_id;
exception
  when unique_violation then
    raise exception 'suggestion already has an active reviewer'
      using errcode = '55000';
end;
$$;

-- ---------------------------------------------------------------------------
-- Claim / assign / review lifecycle RPCs
-- ---------------------------------------------------------------------------

create or replace function private.claim_suggestion_for_review(
  target_suggestion_id uuid
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  new_assignment_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion claim is not authorised' using errcode = '42501';
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

  if suggestion_row.status <> 'submitted' then
    raise exception 'suggestion is not claimable' using errcode = '55000';
  end if;

  if private.suggestion_has_active_reviewer(org_id, target_suggestion_id) then
    raise exception 'suggestion already has an active reviewer' using errcode = '55000';
  end if;

  if not private.can_claim_suggestion_for_review(
    org_id,
    suggestion_row.review_jurisdiction_unit_id
  ) then
    raise exception 'suggestion claim is not authorised' using errcode = '42501';
  end if;

  new_assignment_id := private.insert_suggestion_review_assignment(
    org_id,
    target_suggestion_id,
    actor_membership_id,
    actor_membership_id,
    'claimed'
  );

  perform private.append_business_audit(
    org_id,
    'suggestion.reviewer_claimed',
    target_suggestion_id,
    'succeeded',
    jsonb_build_object('assignment_id', new_assignment_id)
  );
  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionReviewerClaimed',
    new_assignment_id::text,
    jsonb_build_object('reviewer_membership_id', actor_membership_id)
  );

  return new_assignment_id;
end;
$$;

create or replace function private.assign_suggestion_reviewer(
  target_suggestion_id uuid,
  target_reviewer_membership_id uuid
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  had_active_reviewer boolean;
  assignment_kind text;
  new_assignment_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'reviewer assignment is not authorised' using errcode = '42501';
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
    raise exception 'suggestion is not assignable' using errcode = '55000';
  end if;

  if not private.can_assign_suggestion_reviewer(
    org_id,
    suggestion_row.review_jurisdiction_unit_id
  ) then
    raise exception 'reviewer assignment is not authorised' using errcode = '42501';
  end if;

  perform private.assert_eligible_suggestion_reviewer_membership(
    org_id,
    target_reviewer_membership_id,
    suggestion_row.review_jurisdiction_unit_id
  );

  had_active_reviewer := private.suggestion_has_active_reviewer(org_id, target_suggestion_id);
  assignment_kind := case
    when had_active_reviewer then 'reassigned'
    else 'assigned'
  end;

  if had_active_reviewer then
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);
  end if;

  new_assignment_id := private.insert_suggestion_review_assignment(
    org_id,
    target_suggestion_id,
    target_reviewer_membership_id,
    actor_membership_id,
    assignment_kind
  );

  perform private.append_business_audit(
    org_id,
    case assignment_kind
      when 'reassigned' then 'suggestion.reviewer_reassigned'
      else 'suggestion.reviewer_assigned'
    end,
    target_suggestion_id,
    'succeeded',
    jsonb_build_object(
      'assignment_id', new_assignment_id,
      'reviewer_membership_id', target_reviewer_membership_id
    )
  );
  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    case assignment_kind
      when 'reassigned' then 'SuggestionReviewerReassigned'
      else 'SuggestionReviewerAssigned'
    end,
    new_assignment_id::text,
    jsonb_build_object('reviewer_membership_id', target_reviewer_membership_id)
  );

  return new_assignment_id;
end;
$$;

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
    target_suggestion_id::text,
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function private.record_suggestion_review(
  target_suggestion_id uuid,
  target_decision text,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  new_review_id uuid;
  new_status text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'review recording is not authorised' using errcode = '42501';
  end if;

  if target_decision not in ('accept', 'reject', 'needs_more_information', 'park') then
    raise exception 'invalid review decision' using errcode = '22023';
  end if;

  if target_decision = 'park'
    and (target_rationale is null or btrim(target_rationale) = '') then
    raise exception 'parked suggestions require a rationale' using errcode = '22023';
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

  if target_decision = 'park' then
    if suggestion_row.status <> 'under_review' then
      raise exception 'suggestion cannot be parked' using errcode = '55000';
    end if;
  elsif suggestion_row.status <> 'under_review' then
    raise exception 'suggestion is not under review' using errcode = '55000';
  end if;

  if not private.can_act_as_active_suggestion_reviewer(
    org_id,
    target_suggestion_id,
    actor_membership_id
  ) then
    raise exception 'review recording is not authorised' using errcode = '42501';
  end if;

  insert into public.suggestion_reviews (
    organisation_id,
    suggestion_id,
    reviewer_membership_id,
    decision,
    impact_level,
    effort_level,
    rationale,
    implementation_recommendation
  ) values (
    org_id,
    target_suggestion_id,
    actor_membership_id,
    target_decision,
    target_impact_level,
    target_effort_level,
    btrim(target_rationale),
    target_implementation_recommendation
  ) returning id into new_review_id;

  if target_decision = 'needs_more_information' then
    null;
  elsif target_decision = 'park' then
    new_status := 'parked';
    update public.improvement_suggestions suggestion_table
    set status = new_status,
        parked_at = statement_timestamp(),
        parked_rationale = btrim(target_rationale),
        updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id
      and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id,
      target_suggestion_id,
      'under_review',
      new_status,
      actor_membership_id,
      btrim(target_rationale)
    );
  elsif target_decision = 'accept' then
    new_status := 'accepted';
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);

    update public.improvement_suggestions suggestion_table
    set status = new_status,
        accepted_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id
      and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id,
      target_suggestion_id,
      'under_review',
      new_status,
      actor_membership_id,
      target_rationale
    );
  elsif target_decision = 'reject' then
    new_status := 'rejected';
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);

    update public.improvement_suggestions suggestion_table
    set status = new_status,
        rejected_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where suggestion_table.organisation_id = org_id
      and suggestion_table.id = target_suggestion_id;

    perform private.append_suggestion_status_history(
      org_id,
      target_suggestion_id,
      'under_review',
      new_status,
      actor_membership_id,
      target_rationale
    );
  end if;

  perform private.append_business_audit(
    org_id,
    case target_decision
      when 'accept' then 'suggestion.approved'
      when 'reject' then 'suggestion.declined'
      when 'park' then 'suggestion.parked'
      else 'suggestion.review_recorded'
    end,
    target_suggestion_id,
    'succeeded',
    jsonb_build_object('decision', target_decision, 'review_id', new_review_id)
  );
  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    case target_decision
      when 'accept' then 'SuggestionAccepted'
      when 'reject' then 'SuggestionRejected'
      when 'park' then 'SuggestionParked'
      else 'SuggestionReviewRecorded'
    end,
    new_review_id::text,
    jsonb_build_object('decision', target_decision)
  );

  return new_review_id;
end;
$$;

create or replace function private.approve_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return private.record_suggestion_review(
    target_suggestion_id,
    'accept',
    target_impact_level,
    target_effort_level,
    target_rationale,
    target_implementation_recommendation
  );
end;
$$;

create or replace function private.decline_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return private.record_suggestion_review(
    target_suggestion_id,
    'reject',
    target_impact_level,
    target_effort_level,
    target_rationale,
    null
  );
end;
$$;

create or replace function private.park_suggestion(
  target_suggestion_id uuid,
  target_rationale text,
  target_impact_level text default 'medium',
  target_effort_level text default 'medium'
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if target_rationale is null or btrim(target_rationale) = '' then
    raise exception 'parked suggestions require a rationale' using errcode = '22023';
  end if;

  return private.record_suggestion_review(
    target_suggestion_id,
    'park',
    target_impact_level,
    target_effort_level,
    target_rationale,
    null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPC wrappers
-- ---------------------------------------------------------------------------

create or replace function public.claim_suggestion_for_review(target_suggestion_id uuid)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.claim_suggestion_for_review(target_suggestion_id) $$;

create or replace function public.assign_suggestion_reviewer(
  target_suggestion_id uuid,
  target_reviewer_membership_id uuid
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.assign_suggestion_reviewer(target_suggestion_id, target_reviewer_membership_id) $$;

create or replace function public.begin_suggestion_review(target_suggestion_id uuid)
returns boolean
language sql volatile security definer set search_path = ''
as $$ select private.begin_suggestion_review(target_suggestion_id) $$;

create or replace function public.record_suggestion_review(
  target_suggestion_id uuid,
  target_decision text,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.record_suggestion_review(
  target_suggestion_id,
  target_decision,
  target_impact_level,
  target_effort_level,
  target_rationale,
  target_implementation_recommendation
) $$;

create or replace function public.approve_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text,
  target_implementation_recommendation text default null
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.approve_suggestion(
  target_suggestion_id,
  target_impact_level,
  target_effort_level,
  target_rationale,
  target_implementation_recommendation
) $$;

create or replace function public.decline_suggestion(
  target_suggestion_id uuid,
  target_impact_level text,
  target_effort_level text,
  target_rationale text
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.decline_suggestion(
  target_suggestion_id,
  target_impact_level,
  target_effort_level,
  target_rationale
) $$;

create or replace function public.park_suggestion(
  target_suggestion_id uuid,
  target_rationale text,
  target_impact_level text default 'medium',
  target_effort_level text default 'medium'
)
returns uuid
language sql volatile security definer set search_path = ''
as $$ select private.park_suggestion(
  target_suggestion_id,
  target_rationale,
  target_impact_level,
  target_effort_level
) $$;

grant execute on function public.claim_suggestion_for_review(uuid) to authenticated;
grant execute on function public.approve_suggestion(uuid, text, text, text, text) to authenticated;
grant execute on function public.decline_suggestion(uuid, text, text, text) to authenticated;
grant execute on function public.park_suggestion(uuid, text, text, text) to authenticated;

revoke all on function public.claim_suggestion_for_review(uuid) from public, anon;
revoke all on function public.approve_suggestion(uuid, text, text, text, text) from public, anon;
revoke all on function public.decline_suggestion(uuid, text, text, text) from public, anon;
revoke all on function public.park_suggestion(uuid, text, text, text) from public, anon;

alter function private.suggestion_has_active_reviewer(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_claim_suggestion_for_review(uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_assign_suggestion_reviewer(uuid, uuid) owner to lean_hub_private_owner;
alter function private.membership_can_review_suggestion_jurisdiction(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.assert_eligible_suggestion_reviewer_membership(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_act_as_active_suggestion_reviewer(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.end_active_suggestion_review_assignment(uuid, uuid) owner to lean_hub_private_owner;
alter function private.insert_suggestion_review_assignment(uuid, uuid, uuid, uuid, text) owner to lean_hub_private_owner;
alter function private.claim_suggestion_for_review(uuid) owner to lean_hub_private_owner;
alter function private.approve_suggestion(uuid, text, text, text, text) owner to lean_hub_private_owner;
alter function private.decline_suggestion(uuid, text, text, text) owner to lean_hub_private_owner;
alter function private.park_suggestion(uuid, text, text, text) owner to lean_hub_private_owner;
