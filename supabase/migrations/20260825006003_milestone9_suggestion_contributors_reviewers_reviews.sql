-- Milestone 9: suggestion contributors, reviewers, reviews domain.

create table public.suggestion_contributor_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  suggestion_id uuid not null,
  membership_id uuid not null,
  contribution_role text not null,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  assigned_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint suggestion_contributor_assignments_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_contributor_assignments_suggestion_member_role_key
    unique (organisation_id, suggestion_id, membership_id, contribution_role, valid_from),
  constraint suggestion_contributor_assignments_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id)
    on delete restrict,
  constraint suggestion_contributor_assignments_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_contributor_assignments_assigner_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_contributor_assignments_role_check
    check (
      contribution_role in (
        'co_contributor',
        'implementer',
        'subject_matter_expert'
      )
    )
);

create table public.suggestion_review_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  suggestion_id uuid not null,
  reviewer_membership_id uuid not null,
  assigned_at timestamptz not null default statement_timestamp(),
  assigned_by_membership_id uuid not null,
  completed_at timestamptz,
  status text not null default 'active',
  constraint suggestion_review_assignments_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_review_assignments_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id)
    on delete restrict,
  constraint suggestion_review_assignments_reviewer_fkey
    foreign key (organisation_id, reviewer_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_review_assignments_assigner_fkey
    foreign key (organisation_id, assigned_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_review_assignments_status_check
    check (status in ('active', 'completed'))
);

create table public.suggestion_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  suggestion_id uuid not null,
  reviewer_membership_id uuid not null,
  review_date timestamptz not null default statement_timestamp(),
  decision text not null,
  impact_level text not null,
  effort_level text not null,
  rationale text not null,
  implementation_recommendation text,
  created_at timestamptz not null default statement_timestamp(),
  constraint suggestion_reviews_organisation_id_id_key unique (organisation_id, id),
  constraint suggestion_reviews_suggestion_fkey
    foreign key (organisation_id, suggestion_id)
    references public.improvement_suggestions(organisation_id, id)
    on delete restrict,
  constraint suggestion_reviews_reviewer_fkey
    foreign key (organisation_id, reviewer_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint suggestion_reviews_decision_check
    check (decision in ('accept', 'reject', 'needs_more_information')),
  constraint suggestion_reviews_impact_check
    check (impact_level in ('low', 'medium', 'high')),
  constraint suggestion_reviews_effort_check
    check (effort_level in ('low', 'medium', 'high')),
  constraint suggestion_reviews_rationale_check
    check (rationale = btrim(rationale) and char_length(rationale) between 1 and 4000)
);

create trigger suggestion_contributor_assignments_prevent_org_change
before update on public.suggestion_contributor_assignments
for each row execute function private.prevent_organisation_id_change();

create trigger suggestion_review_assignments_prevent_org_change
before update on public.suggestion_review_assignments
for each row execute function private.prevent_organisation_id_change();

create trigger suggestion_reviews_prevent_update
before update on public.suggestion_reviews
for each row execute function private.prevent_update_or_delete();

create trigger suggestion_reviews_prevent_delete
before delete on public.suggestion_reviews
for each row execute function private.prevent_update_or_delete();

create index suggestion_contributor_assignments_suggestion_idx
  on public.suggestion_contributor_assignments (organisation_id, suggestion_id);
create index suggestion_review_assignments_suggestion_idx
  on public.suggestion_review_assignments (organisation_id, suggestion_id, status);
create index suggestion_reviews_suggestion_idx
  on public.suggestion_reviews (organisation_id, suggestion_id);

alter table public.suggestion_contributor_assignments enable row level security;
alter table public.suggestion_contributor_assignments force row level security;
alter table public.suggestion_review_assignments enable row level security;
alter table public.suggestion_review_assignments force row level security;
alter table public.suggestion_reviews enable row level security;
alter table public.suggestion_reviews force row level security;

revoke all on public.suggestion_contributor_assignments from public, anon, authenticated, service_role;
revoke all on public.suggestion_review_assignments from public, anon, authenticated, service_role;
revoke all on public.suggestion_reviews from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.suggestion_contributor_assignments to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_review_assignments to lean_hub_private_owner;
grant select, insert, update, delete on public.suggestion_reviews to lean_hub_private_owner;

create policy private_owner_all_suggestion_contributor_assignments
on public.suggestion_contributor_assignments for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_suggestion_review_assignments
on public.suggestion_review_assignments for all to lean_hub_private_owner using (true) with check (true);
create policy private_owner_all_suggestion_reviews
on public.suggestion_reviews for all to lean_hub_private_owner using (true) with check (true);

grant select on public.improvement_suggestions to authenticated;
grant select on public.suggestion_status_history to authenticated;
grant select on public.suggestion_contributor_assignments to authenticated;
grant select on public.suggestion_review_assignments to authenticated;
grant select on public.suggestion_reviews to authenticated;
grant update on public.improvement_suggestions to authenticated;

create policy improvement_suggestions_update
on public.improvement_suggestions for update to authenticated
using (
  organisation_id = private.current_organisation_id()
  and (
    (
      status = 'draft'
      and author_membership_id = private.current_membership_id(organisation_id)
    )
    or private.has_scoped_permission(organisation_id, 'suggestions.manage', null, null)
    or private.has_scoped_permission(organisation_id, 'suggestions.manage', null, origin_unit_id)
    or private.has_scoped_permission(
      organisation_id,
      'suggestions.manage',
      null,
      review_jurisdiction_unit_id
    )
  )
)
with check (organisation_id = private.current_organisation_id());

create or replace function private.is_active_suggestion_contributor(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_membership_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.suggestion_contributor_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.suggestion_id = target_suggestion_id
      and assignment_row.membership_id = target_membership_id
      and assignment_row.valid_to is null
  )
$$;

create or replace function private.is_active_suggestion_reviewer(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_membership_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.suggestion_id = target_suggestion_id
      and assignment_row.reviewer_membership_id = target_membership_id
      and assignment_row.status = 'active'
  )
$$;

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
      )
  )
$$;

create policy improvement_suggestions_select
on public.improvement_suggestions for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, id)
);

create policy suggestion_status_history_select
on public.suggestion_status_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, suggestion_id)
);

create policy suggestion_contributor_assignments_select
on public.suggestion_contributor_assignments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, suggestion_id)
);

create policy suggestion_review_assignments_select
on public.suggestion_review_assignments for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, suggestion_id)
);

create policy suggestion_reviews_select
on public.suggestion_reviews for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_improvement_suggestion(organisation_id, suggestion_id)
);

alter function private.is_active_suggestion_contributor(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.is_active_suggestion_reviewer(uuid, uuid, uuid) owner to lean_hub_private_owner;
alter function private.can_read_improvement_suggestion(uuid, uuid) owner to lean_hub_private_owner;
