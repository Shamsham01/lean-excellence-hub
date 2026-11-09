-- Security + routing hardening: snapshot approver, privilege lock-down, delegation rules.

-- ---------------------------------------------------------------------------
-- Routing columns: immutable primary vs mutable task owner + notify generation
-- ---------------------------------------------------------------------------

alter table public.suggestion_approval_routing
  rename column pending_approver_membership_id to primary_approver_membership_id;

alter table public.suggestion_approval_routing
  add column if not exists task_owner_membership_id uuid,
  add column if not exists email_recipient_membership_id uuid,
  add column if not exists notification_generation integer not null default 1;

comment on column public.suggestion_approval_routing.primary_approver_membership_id is
  'Immutable primary approver chosen at submit (most specific jurisdiction scope).';

comment on column public.suggestion_approval_routing.task_owner_membership_id is
  'Current actionable approval task owner (delegate/assign/claim sync). Primary unchanged.';

update public.suggestion_approval_routing routing_row
set
  task_owner_membership_id = coalesce(
    routing_row.task_owner_membership_id,
    routing_row.primary_approver_membership_id
  ),
  email_recipient_membership_id = coalesce(
    routing_row.email_recipient_membership_id,
    routing_row.primary_approver_membership_id
  )
where routing_row.primary_approver_membership_id is not null;

alter table public.suggestion_approval_routing
  drop constraint if exists suggestion_approval_routing_pending_approver_fkey;

alter table public.suggestion_approval_routing
  add constraint suggestion_approval_routing_primary_approver_fkey
    foreign key (organisation_id, primary_approver_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete set null,
  add constraint suggestion_approval_routing_task_owner_fkey
    foreign key (organisation_id, task_owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete set null,
  add constraint suggestion_approval_routing_email_recipient_fkey
    foreign key (organisation_id, email_recipient_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete set null;

alter table public.suggestion_approval_delegations
  add column if not exists idempotency_key text,
  add column if not exists notification_generation integer;

create unique index if not exists suggestion_approval_delegations_idempotency_idx
  on public.suggestion_approval_delegations (organisation_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Scoped actionable approver (single recipient; prefer tightest unit_subtree)
-- ---------------------------------------------------------------------------

create or replace function private.membership_suggestion_approval_scope_depth(
  target_organisation_id uuid,
  target_membership_id uuid,
  target_jurisdiction_unit_id uuid,
  target_permission_key text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    max(
      case grant_row.scope_type
        when 'organisation' then 0
        when 'unit_subtree' then (
          select closure.depth
          from public.organisation_unit_closure closure
          where closure.organisation_id = target_organisation_id
            and closure.ancestor_unit_id = grant_row.scope_unit_id
            and closure.descendant_unit_id = target_jurisdiction_unit_id
        )
        else -1
      end
    ),
    -1
  )
  from public.access_grants grant_row
  join public.role_versions role_version
    on role_version.organisation_id = grant_row.organisation_id
   and role_version.id = grant_row.role_version_id
   and role_version.status = 'published'
  join public.role_permissions role_permission
    on role_permission.organisation_id = role_version.organisation_id
   and role_permission.role_version_id = role_version.id
   and role_permission.permission_key = target_permission_key
  where grant_row.organisation_id = target_organisation_id
    and grant_row.grantee_membership_id = target_membership_id
    and grant_row.status = 'active'
    and (
      grant_row.expires_at is null
      or grant_row.expires_at > statement_timestamp()
    )
$$;

create or replace function private.resolve_suggestion_actionable_approver(
  target_organisation_id uuid,
  target_jurisdiction_unit_id uuid,
  exclude_membership_id uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select
      membership_row.id as membership_id,
      case
        when private.membership_can_review_suggestion_jurisdiction(
          target_organisation_id,
          membership_row.id,
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
      end as permission_tier,
      greatest(
        private.membership_suggestion_approval_scope_depth(
          target_organisation_id,
          membership_row.id,
          target_jurisdiction_unit_id,
          'suggestions.review'
        ),
        private.membership_suggestion_approval_scope_depth(
          target_organisation_id,
          membership_row.id,
          target_jurisdiction_unit_id,
          'suggestions.manage'
        )
      ) as scope_depth
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
  ),
  max_depth as (
    select max(scope_depth) as best_depth
    from candidates
    where permission_tier < 9
  )
  select candidate_row.membership_id
  from candidates candidate_row
  cross join max_depth
  where candidate_row.permission_tier < 9
    and (
      max_depth.best_depth is null
      or candidate_row.scope_depth = max_depth.best_depth
    )
  order by candidate_row.permission_tier, candidate_row.scope_depth desc, candidate_row.membership_id
  limit 1
$$;

create or replace function private.suggestion_approval_in_app_dedupe_key(
  target_suggestion_id uuid,
  target_generation integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'suggestion:' || target_suggestion_id::text || ':approval:v' || target_generation::text
$$;

create or replace function private.revoke_all_suggestion_approval_in_app_notifications(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_except_membership_id uuid default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.in_app_notifications notification_row
  where notification_row.organisation_id = target_organisation_id
    and notification_row.notification_type = 'suggestions.awaiting_review'
    and notification_row.dedupe_key like (
      'suggestion:' || target_suggestion_id::text || ':approval:v%'
    )
    and (
      target_except_membership_id is null
      or notification_row.membership_id is distinct from target_except_membership_id
    );
$$;

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
    and notification_row.dedupe_key like (
      'suggestion:' || target_suggestion_id::text || ':approval:v%'
    );
$$;

create or replace function private.snapshot_suggestion_approval_routing(
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
  actionable_approver uuid;
begin
  if exists (
    select 1
    from public.suggestion_approval_routing routing_row
    where routing_row.organisation_id = target_organisation_id
      and routing_row.suggestion_id = target_suggestion_id
      and routing_row.primary_approver_membership_id is not null
  ) then
    return;
  end if;

  actionable_approver := private.resolve_suggestion_actionable_approver(
    target_organisation_id,
    target_jurisdiction_unit_id,
    exclude_author_membership_id
  );

  insert into public.suggestion_approval_routing (
    organisation_id,
    suggestion_id,
    primary_approver_membership_id,
    task_owner_membership_id,
    email_recipient_membership_id,
    recipient_count,
    routing_basis,
    notification_generation,
    updated_at
  ) values (
    target_organisation_id,
    target_suggestion_id,
    actionable_approver,
    actionable_approver,
    actionable_approver,
    case when actionable_approver is null then 0 else 1 end,
    case when actionable_approver is null then 'none' else 'review_jurisdiction' end,
    1,
    statement_timestamp()
  )
  on conflict (organisation_id, suggestion_id) do nothing;
end;
$$;

create or replace function private.is_suggestion_primary_approver(
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
      and routing_row.primary_approver_membership_id = target_membership_id
      and suggestion_row.status in ('submitted', 'under_review', 'parked')
  )
$$;

create or replace function private.actor_has_suggestion_manager_override(
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
      and private.can_assign_suggestion_reviewer(
        target_organisation_id,
        suggestion_row.review_jurisdiction_unit_id
      )
      and private.membership_has_scoped_permission(
        target_actor_membership_id,
        target_organisation_id,
        'suggestions.manage',
        null,
        suggestion_row.review_jurisdiction_unit_id
      )
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
        private.actor_has_suggestion_manager_override(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
        or private.is_active_suggestion_reviewer(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
        or (
          not private.suggestion_has_active_reviewer(
            target_organisation_id,
            target_suggestion_id
          )
          and private.is_suggestion_primary_approver(
            target_organisation_id,
            target_suggestion_id,
            target_actor_membership_id
          )
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Submit: snapshot before status history; notify from snapshot only
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

  perform private.snapshot_suggestion_approval_routing(
    org_id,
    target_suggestion_id,
    review_jurisdiction,
    suggestion_row.author_membership_id
  );

  perform private.append_suggestion_status_history(
    org_id, target_suggestion_id, 'draft', 'submitted', actor_membership_id, 'submitted'
  );

  perform private.append_business_audit(org_id, 'suggestion.submitted', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionSubmitted', target_suggestion_id::text, '{}'::jsonb);

  return true;
end;
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
  routing_row public.suggestion_approval_routing%rowtype;
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
    select routing_table.*
    into routing_row
    from public.suggestion_approval_routing routing_table
    where routing_table.organisation_id = new.organisation_id
      and routing_table.suggestion_id = new.suggestion_id;

    if routing_row.email_recipient_membership_id is not null
      and routing_row.email_recipient_membership_id is distinct from author_id
      and routing_row.email_recipient_membership_id is distinct from new.changed_by_membership_id then
      perform private.insert_membership_in_app_notification(
        new.organisation_id,
        routing_row.email_recipient_membership_id,
        'suggestions.awaiting_review',
        'Idea submitted for review',
        display_label || ' was submitted and is waiting for review.',
        '/platform/suggestions/review?queue=all&suggestionId=' || new.suggestion_id::text,
        private.suggestion_approval_in_app_dedupe_key(
          new.suggestion_id,
          routing_row.notification_generation
        )
      );
    end if;

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

create or replace function public.lookup_suggestion_approval_notification_recipients_for_worker(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when routing_row.email_recipient_membership_id is null then '{}'::uuid[]
    else array[routing_row.email_recipient_membership_id]
  end
  from public.suggestion_approval_routing routing_row
  join public.improvement_suggestions suggestion_row
    on suggestion_row.organisation_id = routing_row.organisation_id
   and suggestion_row.id = routing_row.suggestion_id
  where routing_row.organisation_id = target_organisation_id
    and routing_row.suggestion_id = target_suggestion_id
    and suggestion_row.status = 'submitted'
$$;

-- ---------------------------------------------------------------------------
-- Claim / assign / delegate: sync task owner; preserve primary
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

  update public.suggestion_approval_routing routing_row
  set task_owner_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where routing_row.organisation_id = org_id
    and routing_row.suggestion_id = target_suggestion_id;

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
    raise exception 'reviewer is already assigned for this suggestion' using errcode = '55000';
  end if;

  next_generation := coalesce(routing_row.notification_generation, 1) + 1;
  delegate_key := target_suggestion_id::text || ':delegate:' || target_delegate_membership_id::text || ':g' || next_generation::text;

  select delegation_row.id
  into existing_delegation_id
  from public.suggestion_approval_delegations delegation_row
  where delegation_row.organisation_id = org_id
    and delegation_row.idempotency_key = delegate_key;

  if existing_delegation_id is not null then
    return prior_assignment_id;
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
  routing_row public.suggestion_approval_routing%rowtype;
  had_active_reviewer boolean;
  prior_reviewer uuid;
  assignment_kind text;
  new_assignment_id uuid;
  next_generation integer;
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

  if prior_reviewer = target_reviewer_membership_id then
    raise exception 'reviewer is already assigned for this suggestion' using errcode = '55000';
  end if;

  had_active_reviewer := prior_reviewer is not null;
  assignment_kind := case when had_active_reviewer then 'reassigned' else 'assigned' end;

  select routing_table.*
  into routing_row
  from public.suggestion_approval_routing routing_table
  where routing_table.organisation_id = org_id
    and routing_table.suggestion_id = target_suggestion_id
  for update;

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

  next_generation := coalesce(routing_row.notification_generation, 1) + 1;

  update public.suggestion_approval_routing routing_table
  set task_owner_membership_id = target_reviewer_membership_id,
      notification_generation = next_generation,
      updated_at = statement_timestamp()
  where routing_table.organisation_id = org_id
    and routing_table.suggestion_id = target_suggestion_id;

  perform private.revoke_all_suggestion_approval_in_app_notifications(org_id, target_suggestion_id, null);

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
      'reviewer_membership_id', target_reviewer_membership_id,
      'manager_override', true
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

create or replace function private.end_active_suggestion_review_assignment(
  target_organisation_id uuid,
  target_suggestion_id uuid
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  primary_approver uuid;
begin
  update public.suggestion_review_assignments assignment_row
  set status = 'completed',
      completed_at = statement_timestamp()
  where assignment_row.organisation_id = target_organisation_id
    and assignment_row.suggestion_id = target_suggestion_id
    and assignment_row.status = 'active';

  select routing_row.primary_approver_membership_id
  into primary_approver
  from public.suggestion_approval_routing routing_row
  where routing_row.organisation_id = target_organisation_id
    and routing_row.suggestion_id = target_suggestion_id;

  update public.suggestion_approval_routing routing_row
  set task_owner_membership_id = coalesce(primary_approver, routing_row.task_owner_membership_id),
      updated_at = statement_timestamp()
  where routing_row.organisation_id = target_organisation_id
    and routing_row.suggestion_id = target_suggestion_id;
end;
$$;

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
  eligible_reviewers jsonb;
  primary_approver_member_id uuid;
  primary_approver_display_name text;
  task_owner_member_id uuid;
  task_owner_display_name text;
  delegate_authority text;
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
    into eligible_reviewers
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
    'eligible_reviewers', eligible_reviewers
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilege lock-down (private helpers)
-- ---------------------------------------------------------------------------

do $$
declare
  private_helpers regprocedure[] := array[
    'private.membership_suggestion_approval_scope_depth(uuid,uuid,uuid,text)'::regprocedure,
    'private.resolve_suggestion_actionable_approver(uuid,uuid,uuid)'::regprocedure,
    'private.suggestion_approval_in_app_dedupe_key(uuid,integer)'::regprocedure,
    'private.revoke_all_suggestion_approval_in_app_notifications(uuid,uuid,uuid)'::regprocedure,
    'private.revoke_suggestion_approval_in_app_notifications(uuid,uuid,uuid)'::regprocedure,
    'private.snapshot_suggestion_approval_routing(uuid,uuid,uuid,uuid)'::regprocedure,
    'private.is_suggestion_primary_approver(uuid,uuid,uuid)'::regprocedure,
    'private.actor_has_suggestion_manager_override(uuid,uuid,uuid)'::regprocedure,
    'private.can_delegate_suggestion_approval(uuid,uuid,uuid)'::regprocedure
  ];
  helper regprocedure;
begin
  foreach helper in array private_helpers loop
    execute format('alter function %s owner to lean_hub_private_owner', helper);
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      helper
    );
    execute format('grant execute on function %s to lean_hub_private_owner, postgres', helper);
  end loop;
end;
$$;

revoke all on function public.lookup_suggestion_approval_notification_recipients_for_worker(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.lookup_suggestion_approval_notification_recipients_for_worker(uuid, uuid)
  to service_role, postgres;

drop function if exists private.resolve_suggestion_approval_notification_recipients(uuid, uuid, uuid);
drop function if exists private.refresh_suggestion_approval_routing(uuid, uuid, uuid, uuid);
drop function if exists private.is_suggestion_pending_approver(uuid, uuid, uuid);
