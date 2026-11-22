-- Suggestion approval routing: jurisdiction-scoped notification recipients,
-- email projection for SuggestionSubmitted, auditable approval delegation.

-- ---------------------------------------------------------------------------
-- Routing + delegation audit (tenant-scoped)
-- ---------------------------------------------------------------------------

create table public.suggestion_approval_routing (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  suggestion_id uuid not null,
  pending_approver_membership_id uuid,
  recipient_count integer not null default 0,
  routing_basis text not null default 'none',
  updated_at timestamptz not null default statement_timestamp(),
  constraint suggestion_approval_routing_pkey
    primary key (organisation_id, suggestion_id),
  constraint suggestion_approval_routing_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id)
    on delete cascade,
  constraint suggestion_approval_routing_pending_approver_fkey
    foreign key (organisation_id, pending_approver_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete set null,
  constraint suggestion_approval_routing_basis_check
    check (routing_basis in ('review_jurisdiction', 'none'))
);

comment on table public.suggestion_approval_routing is
  'Per-suggestion approval queue routing. pending_approver_membership_id is the deterministic primary approver when multiple members are eligible; see private.resolve_suggestion_approval_notification_recipients.';

create table public.suggestion_approval_delegations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  suggestion_id uuid not null,
  from_membership_id uuid not null,
  to_membership_id uuid not null,
  delegated_by_membership_id uuid not null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  constraint suggestion_approval_delegations_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id)
    on delete cascade,
  constraint suggestion_approval_delegations_from_fkey
    foreign key (organisation_id, from_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_approval_delegations_to_fkey
    foreign key (organisation_id, to_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_approval_delegations_by_fkey
    foreign key (organisation_id, delegated_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_approval_delegations_no_self
    check (from_membership_id is distinct from to_membership_id)
);

create index suggestion_approval_delegations_suggestion_idx
  on public.suggestion_approval_delegations (organisation_id, suggestion_id, created_at desc);

alter table public.suggestion_approval_routing enable row level security;
alter table public.suggestion_approval_routing force row level security;
alter table public.suggestion_approval_delegations enable row level security;
alter table public.suggestion_approval_delegations force row level security;

revoke all on public.suggestion_approval_routing from public, anon, authenticated, service_role;
revoke all on public.suggestion_approval_delegations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.suggestion_approval_routing to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_approval_delegations to lean_hub_private_owner;

create policy private_owner_all_suggestion_approval_routing
on public.suggestion_approval_routing for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_suggestion_approval_delegations
on public.suggestion_approval_delegations for all to lean_hub_private_owner
using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Recipient resolution (review jurisdiction only; no role title heuristics)
-- ---------------------------------------------------------------------------

create or replace function private.resolve_suggestion_approval_notification_recipients(
  target_organisation_id uuid,
  target_jurisdiction_unit_id uuid,
  exclude_membership_id uuid default null
)
returns table (
  membership_id uuid,
  sort_rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Eligible approvers: active members with suggestions.review or scoped
  -- suggestions.manage for the review jurisdiction (unit_subtree / organisation).
  -- Sorted deterministically by sort_rank then membership_id.
  -- Multiple eligible managers each receive workflow notifications; the first row
  -- is stored as pending_approver_membership_id for delegation ownership.
  -- Zero rows: no approval notifications (routing_basis = none).
  select
    candidate.membership_id,
    row_number() over (
      order by candidate.priority, candidate.membership_id
    ) as sort_rank
  from (
    select distinct
      membership_row.id as membership_id,
      case
        when private.membership_has_scoped_permission(
          membership_row.id,
          target_organisation_id,
          'suggestions.review',
          null,
          target_jurisdiction_unit_id
        ) then 0
        when private.membership_has_scoped_permission(
          membership_row.id,
          target_organisation_id,
          'suggestions.manage',
          null,
          target_jurisdiction_unit_id
        ) then 1
        else 9
      end as priority
    from public.organisation_memberships membership_row
    where membership_row.organisation_id = target_organisation_id
      and membership_row.status = 'active'
      and membership_row.id is distinct from exclude_membership_id
      and target_jurisdiction_unit_id is not null
      and (
        private.membership_can_review_suggestion_jurisdiction(
          target_organisation_id,
          membership_row.id,
          target_jurisdiction_unit_id
        )
        or private.membership_has_scoped_permission(
          membership_row.id,
          target_organisation_id,
          'suggestions.manage',
          null,
          target_jurisdiction_unit_id
        )
      )
  ) candidate
  where candidate.priority < 9
$$;

create or replace function private.refresh_suggestion_approval_routing(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_jurisdiction_unit_id uuid,
  exclude_author_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  primary_approver uuid;
  recipient_total integer;
begin
  select
    count(*)::integer,
    (array_agg(resolved.membership_id order by resolved.sort_rank))[1]
  into recipient_total, primary_approver
  from private.resolve_suggestion_approval_notification_recipients(
    target_organisation_id,
    target_jurisdiction_unit_id,
    exclude_author_membership_id
  ) resolved;

  recipient_total := coalesce(recipient_total, 0);

  insert into public.suggestion_approval_routing (
    organisation_id,
    suggestion_id,
    pending_approver_membership_id,
    recipient_count,
    routing_basis,
    updated_at
  ) values (
    target_organisation_id,
    target_suggestion_id,
    primary_approver,
    coalesce(recipient_total, 0),
    case when primary_approver is null then 'none' else 'review_jurisdiction' end,
    statement_timestamp()
  )
  on conflict (organisation_id, suggestion_id) do update set
    pending_approver_membership_id = excluded.pending_approver_membership_id,
    recipient_count = excluded.recipient_count,
    routing_basis = excluded.routing_basis,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.lookup_suggestion_approval_notification_recipients_for_worker(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(resolved.membership_id order by resolved.sort_rank), '{}'::uuid[])
  from public.improvement_suggestions suggestion_row
  cross join lateral private.resolve_suggestion_approval_notification_recipients(
    suggestion_row.organisation_id,
    suggestion_row.review_jurisdiction_unit_id,
    suggestion_row.author_membership_id
  ) resolved
  where suggestion_row.organisation_id = target_organisation_id
    and suggestion_row.id = target_suggestion_id
    and suggestion_row.status in ('submitted', 'under_review', 'parked')
$$;

revoke all on function public.lookup_suggestion_approval_notification_recipients_for_worker(uuid, uuid)
  from public, anon;
grant execute on function public.lookup_suggestion_approval_notification_recipients_for_worker(uuid, uuid)
  to service_role, postgres;

-- ---------------------------------------------------------------------------
-- In-app notifications: jurisdiction-scoped recipients on submit only
-- ---------------------------------------------------------------------------

create or replace function private.revoke_suggestion_approval_in_app_notifications(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_membership_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.membership_id = target_membership_id
    and notification_row.notification_type = 'suggestions.awaiting_review'
    and notification_row.dedupe_key = (
      'suggestion:' || target_suggestion_id::text || ':submitted'
    );
$$;

create or replace function private.notify_in_app_for_suggestion_status_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  suggestion_title text;
  suggestion_number text;
  author_id uuid;
  jurisdiction_unit uuid;
  resource_href text;
  display_label text;
  body_text text;
  dedupe text;
  type_key text;
  approver record;
begin
  select
    coalesce(nullif(btrim(suggestion_row.suggestion_number), ''), suggestion_row.title),
    suggestion_row.title,
    suggestion_row.author_membership_id,
    suggestion_row.review_jurisdiction_unit_id
  into suggestion_number, suggestion_title, author_id, jurisdiction_unit
  from public.improvement_suggestions suggestion_row
  where suggestion_row.organisation_id = new.organisation_id
    and suggestion_row.id = new.suggestion_id;

  if suggestion_title is null then
    return new;
  end if;

  display_label := coalesce(nullif(suggestion_number, suggestion_title), suggestion_title);
  resource_href := '/platform/suggestions/' || new.suggestion_id::text;

  if new.to_status = 'submitted' and new.from_status = 'draft' then
    for approver in
      select resolved.membership_id as id
      from private.resolve_suggestion_approval_notification_recipients(
        new.organisation_id,
        jurisdiction_unit,
        author_id
      ) resolved
      where resolved.membership_id is distinct from new.changed_by_membership_id
    loop
      perform private.insert_membership_in_app_notification(
        new.organisation_id,
        approver.id,
        'suggestions.awaiting_review',
        'Idea submitted for review',
        display_label || ' was submitted and is waiting for review.',
        '/platform/suggestions/review?queue=all&suggestionId=' || new.suggestion_id::text,
        'suggestion:' || new.suggestion_id::text || ':submitted'
      );
    end loop;

    if author_id is not null then
      perform private.insert_membership_in_app_notification(
        new.organisation_id,
        author_id,
        'suggestions.status_submitted',
        'Idea submitted',
        display_label || ' was submitted successfully.',
        resource_href,
        'suggestion:' || new.suggestion_id::text || ':status:submitted'
      );
    end if;
  end if;

  if author_id is null then
    return new;
  end if;

  if new.to_status = 'under_review' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_under_review';
    body_text := display_label || ' is now under review.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:under_review';
  elsif new.to_status = 'accepted' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_accepted';
    body_text := display_label || ' was accepted.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:accepted';
  elsif new.to_status = 'rejected' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_rejected';
    body_text := display_label || ' was declined.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:rejected';
  elsif new.to_status = 'parked' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_parked';
    body_text := display_label || ' was parked for further consideration.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:parked';
  elsif new.to_status = 'implemented' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_implemented';
    body_text := display_label || ' was marked implemented.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:implemented';
  elsif new.to_status = 'withdrawn' and new.changed_by_membership_id is distinct from author_id then
    type_key := 'suggestions.status_withdrawn';
    body_text := display_label || ' was withdrawn.';
    dedupe := 'suggestion:' || new.suggestion_id::text || ':status:withdrawn';
  else
    return new;
  end if;

  perform private.insert_membership_in_app_notification(
    new.organisation_id,
    author_id,
    type_key,
    case new.to_status
      when 'under_review' then 'Idea under review'
      when 'accepted' then 'Idea accepted'
      when 'rejected' then 'Idea declined'
      when 'parked' then 'Idea parked'
      when 'implemented' then 'Idea implemented'
      when 'withdrawn' then 'Idea withdrawn'
      else 'Idea updated'
    end,
    body_text,
    resource_href,
    dedupe
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit: persist routing snapshot at approval-ready transition
-- ---------------------------------------------------------------------------

create or replace function private.submit_suggestion(target_suggestion_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  programme_row public.suggestion_programmes%rowtype;
  category_row public.suggestion_categories%rowtype;
  origin_unit_row public.organisation_units%rowtype;
  target_unit_row public.organisation_units%rowtype;
  programme_version_row public.suggestion_programme_versions%rowtype;
  submission_version_id uuid;
  allocated_suggestion_number text;
  review_jurisdiction uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'draft' then
    raise exception 'suggestion is not submittable' using errcode = '55000';
  end if;

  if suggestion_row.author_membership_id <> actor_membership_id then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  if not private.can_submit_suggestion_to_unit(org_id, suggestion_row.origin_unit_id) then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select version_table.*
  into programme_version_row
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = suggestion_row.programme_version_id
    and version_table.lifecycle = 'published';

  if not found then
    raise exception 'programme version is not published' using errcode = '22023';
  end if;

  select programme_table.* into programme_row
  from public.suggestion_programmes programme_table
  where programme_table.organisation_id = org_id
    and programme_table.id = programme_version_row.programme_id;

  if programme_row.status <> 'active' then
    raise exception 'programme is not active for submission' using errcode = '22023';
  end if;

  select category_table.* into category_row
  from public.suggestion_categories category_table
  where category_table.organisation_id = org_id
    and category_table.id = suggestion_row.category_id;

  if category_row.status <> 'active' then
    raise exception 'category is not active for submission' using errcode = '22023';
  end if;

  select unit_table.* into origin_unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = suggestion_row.origin_unit_id;

  if suggestion_row.target_unit_id is not null then
    select unit_table.* into target_unit_row
    from public.organisation_units unit_table
    where unit_table.organisation_id = org_id
      and unit_table.id = suggestion_row.target_unit_id;
  end if;

  if programme_version_row.template_version_id is not null then
    if suggestion_row.template_submission_id is null then
      raise exception 'template submission is required' using errcode = '22023';
    end if;

    select submission_table.template_version_id
    into submission_version_id
    from public.template_submissions submission_table
    where submission_table.organisation_id = org_id
      and submission_table.id = suggestion_row.template_submission_id;

    if submission_version_id is distinct from programme_version_row.template_version_id then
      raise exception 'template submission does not match programme template version' using errcode = '22023';
    end if;

    perform private.complete_template_submission(suggestion_row.template_submission_id);
  end if;

  allocated_suggestion_number := private.allocate_organisation_document_number(
    org_id, 'improvement_suggestion', 'IDEA'
  );

  review_jurisdiction := coalesce(suggestion_row.target_unit_id, suggestion_row.origin_unit_id);

  update public.improvement_suggestions suggestion_table
  set status = 'submitted',
      suggestion_number = allocated_suggestion_number,
      programme_name_snapshot = programme_row.name,
      programme_code_snapshot = programme_row.code,
      category_name_snapshot = category_row.name,
      category_code_snapshot = category_row.code,
      origin_unit_name_snapshot = origin_unit_row.name,
      origin_unit_code_snapshot = origin_unit_row.code,
      target_unit_name_snapshot = target_unit_row.name,
      target_unit_code_snapshot = target_unit_row.code,
      review_jurisdiction_unit_id = review_jurisdiction,
      submitted_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id, target_suggestion_id, 'draft', 'submitted', actor_membership_id, 'submitted'
  );

  perform private.refresh_suggestion_approval_routing(
    org_id,
    target_suggestion_id,
    review_jurisdiction,
    suggestion_row.author_membership_id
  );

  perform private.append_business_audit(org_id, 'suggestion.submitted', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionSubmitted', target_suggestion_id::text, '{}'::jsonb);

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delegation
-- ---------------------------------------------------------------------------

alter table public.suggestion_review_assignments
  drop constraint if exists suggestion_review_assignments_assignment_kind_check;

alter table public.suggestion_review_assignments
  add constraint suggestion_review_assignments_assignment_kind_check
    check (assignment_kind in ('claimed', 'assigned', 'reassigned', 'delegated'));

create or replace function private.is_suggestion_pending_approver(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.suggestion_approval_routing routing_row
  join public.improvement_suggestions suggestion_row
    on suggestion_row.organisation_id = routing_row.organisation_id
   and suggestion_row.id = routing_row.suggestion_id
  where routing_row.organisation_id = target_organisation_id
    and routing_row.suggestion_id = target_suggestion_id
    and routing_row.pending_approver_membership_id = target_membership_id
    and suggestion_row.status in ('submitted', 'under_review', 'parked')
  )
$$;

create or replace function private.can_delegate_suggestion_approval(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_actor_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = target_suggestion_id
      and suggestion_row.status in ('submitted', 'under_review', 'parked')
      and (
        private.is_suggestion_pending_approver(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
        or private.is_active_suggestion_reviewer(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
        or private.can_assign_suggestion_reviewer(
          target_organisation_id,
          suggestion_row.review_jurisdiction_unit_id
        )
      )
  )
$$;

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
  prior_pending uuid;
  prior_reviewer uuid;
  prior_assignment_id uuid;
  new_assignment_id uuid;
  normalized_reason text;
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

  if not private.can_delegate_suggestion_approval(org_id, target_suggestion_id, actor_membership_id) then
    raise exception 'approval delegation is not authorised' using errcode = '42501';
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

  select routing_row.pending_approver_membership_id
  into prior_pending
  from public.suggestion_approval_routing routing_row
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = target_suggestion_id
  for update;

  select assignment_row.id, assignment_row.reviewer_membership_id
  into prior_assignment_id, prior_reviewer
  from public.suggestion_review_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.suggestion_id = target_suggestion_id
    and assignment_row.status = 'active'
  for update;

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

  update public.suggestion_approval_routing routing_row
  set pending_approver_membership_id = target_delegate_membership_id,
      updated_at = statement_timestamp()
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = target_suggestion_id;

  insert into public.suggestion_approval_delegations (
    organisation_id,
    suggestion_id,
    from_membership_id,
    to_membership_id,
    delegated_by_membership_id,
    reason
  ) values (
    org_id,
    target_suggestion_id,
    coalesce(prior_pending, prior_reviewer, actor_membership_id),
    target_delegate_membership_id,
    actor_membership_id,
    normalized_reason
  );

  if prior_pending is not null then
    perform private.revoke_suggestion_approval_in_app_notifications(
      org_id, target_suggestion_id, prior_pending
    );
  end if;

  if prior_reviewer is not null and prior_reviewer is distinct from prior_pending then
    perform private.revoke_suggestion_approval_in_app_notifications(
      org_id, target_suggestion_id, prior_reviewer
    );
  end if;

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
    'suggestion:' || target_suggestion_id::text || ':submitted'
  );

  perform private.append_business_audit(
    org_id,
    'suggestion.approval_delegated',
    target_suggestion_id,
    'succeeded',
    jsonb_build_object(
      'assignment_id', new_assignment_id,
      'delegate_membership_id', target_delegate_membership_id,
      'reason', normalized_reason
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_suggestion_id,
    'SuggestionReviewerReassigned',
    new_assignment_id::text,
    jsonb_build_object('reviewer_membership_id', target_delegate_membership_id)
  );

  return new_assignment_id;
end;
$$;

create or replace function public.delegate_suggestion_approval(
  target_suggestion_id uuid,
  target_delegate_membership_id uuid,
  target_reason text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.delegate_suggestion_approval(
    target_suggestion_id,
    target_delegate_membership_id,
    target_reason
  )
$$;

revoke all on function public.delegate_suggestion_approval(uuid, uuid, text) from public, anon;
grant execute on function public.delegate_suggestion_approval(uuid, uuid, text) to authenticated;

-- Keep assign/reassign in sync with pending approver + revoke stale approval notifications
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
  prior_reviewer uuid;
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

  if target_reviewer_membership_id = suggestion_row.author_membership_id then
    raise exception 'cannot assign the suggestion author as reviewer' using errcode = '22023';
  end if;

  select assignment_row.reviewer_membership_id
  into prior_reviewer
  from public.suggestion_review_assignments assignment_row
  where assignment_row.organisation_id = org_id
    and assignment_row.suggestion_id = target_suggestion_id
    and assignment_row.status = 'active';

  had_active_reviewer := prior_reviewer is not null;
  assignment_kind := case
    when had_active_reviewer then 'reassigned'
    else 'assigned'
  end;

  if had_active_reviewer then
    perform private.end_active_suggestion_review_assignment(org_id, target_suggestion_id);
    perform private.revoke_suggestion_approval_in_app_notifications(
      org_id, target_suggestion_id, prior_reviewer
    );
  end if;

  new_assignment_id := private.insert_suggestion_review_assignment(
    org_id,
    target_suggestion_id,
    target_reviewer_membership_id,
    actor_membership_id,
    assignment_kind
  );

  update public.suggestion_approval_routing routing_row
  set pending_approver_membership_id = target_reviewer_membership_id,
      updated_at = statement_timestamp()
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = target_suggestion_id;

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

-- Review context: pending approver + delegate permission
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
  eligible_reviewers jsonb;
  pending_approver_member_id uuid;
  pending_approver_display_name text;
begin
  if org_id is null then
    raise exception 'review context is not authorised'
      using errcode = '42501';
  end if;

  actor_membership_id := private.current_membership_id(org_id);

  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'suggestion not found'
      using errcode = 'P0002';
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

  can_view_metadata := private.can_view_suggestion_reviewer_metadata(
    org_id,
    suggestion_row.id,
    suggestion_row.review_jurisdiction_unit_id,
    actor_membership_id
  );

  has_active_reviewer := private.suggestion_has_active_reviewer(org_id, suggestion_row.id);

  select routing_row.pending_approver_membership_id
  into pending_approver_member_id
  from public.suggestion_approval_routing routing_row
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = suggestion_row.id;

  if pending_approver_member_id is not null then
    select nullif(
      btrim(coalesce(membership_row.display_name, profile_row.display_name)),
      ''
    )
    into pending_approver_display_name
    from public.organisation_memberships membership_row
    left join public.profiles profile_row
      on profile_row.user_id = membership_row.user_id
    where membership_row.organisation_id = org_id
      and membership_row.id = pending_approver_member_id;
  end if;

  if can_view_metadata then
    select
      assignment_row.reviewer_membership_id,
      nullif(
        btrim(
          coalesce(reviewer_membership.display_name, reviewer_profile.display_name)
        ),
        ''
      ),
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

  if (
    private.can_assign_suggestion_reviewer(
      org_id,
      suggestion_row.review_jurisdiction_unit_id
    )
    or private.can_delegate_suggestion_approval(
      org_id,
      suggestion_row.id,
      actor_membership_id
    )
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
    into eligible_reviewers
    from (
      select
        membership_row.id as member_id,
        nullif(
          btrim(
            coalesce(membership_row.display_name, profile_row.display_name)
          ),
          ''
        ) as display_name
      from public.organisation_memberships membership_row
      left join public.profiles profile_row
        on profile_row.user_id = membership_row.user_id
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
  else
    eligible_reviewers := '[]'::jsonb;
  end if;

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
      when can_view_metadata and pending_approver_member_id is not null then
        jsonb_build_object(
          'member_id', pending_approver_member_id,
          'display_name', pending_approver_display_name
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
      'can_delegate',
        private.can_delegate_suggestion_approval(
          org_id,
          suggestion_row.id,
          actor_membership_id
        ),
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
    'eligible_reviewers', eligible_reviewers
  );
end;
$$;

