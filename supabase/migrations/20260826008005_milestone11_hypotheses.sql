-- Milestone 11: hypotheses, status history, verification / rejection RPCs.

-- ──────────────────────────────────────────────────────────────
-- Permission: verify_cause
-- ──────────────────────────────────────────────────────────────

insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('problem_solving.verify_cause', 'Verify root-cause hypotheses within authorised scope.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array['problem_solving.verify_cause']::text[]
);

-- ──────────────────────────────────────────────────────────────
-- problem_solving_hypotheses
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_hypotheses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  statement text not null,
  parent_hypothesis_id uuid,
  category text,
  rationale text,
  status text not null default 'proposed',
  verified_by_membership_id uuid,
  verified_at timestamptz,
  verification_rationale text,
  rejected_by_membership_id uuid,
  rejected_at timestamptz,
  rejection_rationale text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_hypotheses_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_hypotheses_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypotheses_parent_fkey
    foreign key (organisation_id, parent_hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypotheses_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypotheses_verified_by_fkey
    foreign key (organisation_id, verified_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypotheses_rejected_by_fkey
    foreign key (organisation_id, rejected_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypotheses_statement_check
    check (statement = btrim(statement) and char_length(statement) between 1 and 2000),
  constraint problem_solving_hypotheses_rationale_check
    check (rationale is null or char_length(rationale) <= 4000),
  constraint problem_solving_hypotheses_category_check
    check (category is null or char_length(category) <= 200),
  constraint problem_solving_hypotheses_verification_rationale_check
    check (verification_rationale is null or char_length(verification_rationale) <= 4000),
  constraint problem_solving_hypotheses_rejection_rationale_check
    check (rejection_rationale is null or char_length(rejection_rationale) <= 4000),
  constraint problem_solving_hypotheses_status_check
    check (status in ('proposed', 'testing', 'supported', 'verified', 'rejected', 'superseded')),
  constraint problem_solving_hypotheses_verified_semantics_check
    check (
      status <> 'verified'
      or (verified_by_membership_id is not null and verified_at is not null and verification_rationale is not null)
    ),
  constraint problem_solving_hypotheses_rejected_semantics_check
    check (
      status <> 'rejected'
      or (rejected_by_membership_id is not null and rejected_at is not null)
    )
);

-- ──────────────────────────────────────────────────────────────
-- problem_solving_hypothesis_status_history
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_hypothesis_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  hypothesis_id uuid not null,
  from_status text not null,
  to_status text not null,
  changed_by_membership_id uuid not null,
  reason text,
  changed_at timestamptz not null default statement_timestamp(),
  constraint ps_hypothesis_status_history_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_hypothesis_status_history_hypothesis_fkey
    foreign key (organisation_id, hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint ps_hypothesis_status_history_actor_fkey
    foreign key (organisation_id, changed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

-- ──────────────────────────────────────────────────────────────
-- Triggers
-- ──────────────────────────────────────────────────────────────

create trigger problem_solving_hypotheses_touch_updated_at
before update on public.problem_solving_hypotheses
for each row execute function private.touch_updated_at();

create trigger problem_solving_hypotheses_prevent_org_change
before update on public.problem_solving_hypotheses
for each row execute function private.prevent_organisation_id_change();

create trigger ps_hypothesis_status_history_prevent_update
before update on public.problem_solving_hypothesis_status_history
for each row execute function private.prevent_update_or_delete();

create trigger ps_hypothesis_status_history_prevent_delete
before delete on public.problem_solving_hypothesis_status_history
for each row execute function private.prevent_update_or_delete();

-- ──────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────

create index problem_solving_hypotheses_case_idx
  on public.problem_solving_hypotheses (organisation_id, problem_solving_case_id);
create index problem_solving_hypotheses_status_idx
  on public.problem_solving_hypotheses (organisation_id, status);
create index problem_solving_hypotheses_parent_idx
  on public.problem_solving_hypotheses (organisation_id, parent_hypothesis_id)
  where parent_hypothesis_id is not null;
create index ps_hypothesis_status_history_hypothesis_idx
  on public.problem_solving_hypothesis_status_history (organisation_id, hypothesis_id, changed_at);

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

alter table public.problem_solving_hypotheses enable row level security;
alter table public.problem_solving_hypotheses force row level security;
alter table public.problem_solving_hypothesis_status_history enable row level security;
alter table public.problem_solving_hypothesis_status_history force row level security;

revoke all on public.problem_solving_hypotheses from public, anon, authenticated, service_role;
revoke all on public.problem_solving_hypothesis_status_history from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_hypotheses to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_hypothesis_status_history to lean_hub_private_owner;

create policy private_owner_all_problem_solving_hypotheses
on public.problem_solving_hypotheses for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_hypothesis_status_history
on public.problem_solving_hypothesis_status_history for all to lean_hub_private_owner
using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- Private helpers
-- ──────────────────────────────────────────────────────────────

create or replace function private.append_hypothesis_status_history(
  target_organisation_id uuid,
  target_hypothesis_id uuid,
  target_from_status text,
  target_to_status text,
  target_actor_membership_id uuid,
  target_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.problem_solving_hypothesis_status_history (
    organisation_id,
    hypothesis_id,
    from_status,
    to_status,
    changed_by_membership_id,
    reason
  ) values (
    target_organisation_id,
    target_hypothesis_id,
    target_from_status,
    target_to_status,
    target_actor_membership_id,
    target_reason
  );
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – create_hypothesis
-- ──────────────────────────────────────────────────────────────

create or replace function private.create_hypothesis(
  target_problem_solving_case_id uuid,
  target_statement text,
  target_parent_hypothesis_id uuid default null,
  target_category text default null,
  target_rationale text default null
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
  new_id uuid;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'hypothesis creation is not authorised'
      using errcode = '42501';
  end if;

  if target_parent_hypothesis_id is not null then
    if not exists (
      select 1
      from public.problem_solving_hypotheses h
      where h.organisation_id = org_id
        and h.id = target_parent_hypothesis_id
        and h.problem_solving_case_id = target_problem_solving_case_id
    ) then
      raise exception 'parent hypothesis not found in the same case'
        using errcode = 'P0002';
    end if;
  end if;

  insert into public.problem_solving_hypotheses (
    organisation_id,
    problem_solving_case_id,
    statement,
    parent_hypothesis_id,
    category,
    rationale,
    status,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    btrim(target_statement),
    target_parent_hypothesis_id,
    target_category,
    target_rationale,
    'proposed',
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_hypothesis_status_history(
    org_id, new_id, 'proposed', 'proposed', actor_membership_id, 'created'
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.created',
    target_problem_solving_case_id,
    'succeeded',
    jsonb_build_object('hypothesis_id', new_id, 'case_id', target_problem_solving_case_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_problem_solving_case_id,
    'HypothesisCreated',
    new_id::text,
    jsonb_build_object(
      'hypothesis_id', new_id,
      'case_id', target_problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – update_hypothesis_status (testing / supported only)
-- ──────────────────────────────────────────────────────────────

create or replace function private.update_hypothesis_status(
  target_hypothesis_id uuid,
  target_status text,
  target_reason text default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis status update is not authorised'
      using errcode = '42501';
  end if;

  if target_status not in ('testing', 'supported') then
    raise exception 'only testing and supported transitions are allowed via this RPC'
      using errcode = '22023';
  end if;

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis status update is not authorised'
      using errcode = '42501';
  end if;

  if target_status = 'testing' and hypothesis_row.status not in ('proposed') then
    raise exception 'only proposed hypotheses can move to testing'
      using errcode = '55000';
  end if;

  if target_status = 'supported' and hypothesis_row.status not in ('proposed', 'testing') then
    raise exception 'only proposed or testing hypotheses can move to supported'
      using errcode = '55000';
  end if;

  update public.problem_solving_hypotheses h
  set status     = target_status,
      updated_at = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, target_status,
    actor_membership_id, target_reason
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.status_updated',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from', hypothesis_row.status,
      'to', target_status
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisStatusUpdated',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'to_status', target_status
    )
  );

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – verify_cause_hypothesis
-- ──────────────────────────────────────────────────────────────

create or replace function private.verify_cause_hypothesis(
  target_hypothesis_id uuid,
  target_verification_rationale text
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis verification is not authorised'
      using errcode = '42501';
  end if;

  if not private.has_scoped_permission(
    org_id, 'problem_solving.verify_cause', null, null
  ) then
    raise exception 'verify_cause permission is required'
      using errcode = '42501';
  end if;

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if hypothesis_row.status = 'proposed' then
    raise exception 'proposed hypotheses cannot be directly verified; advance to testing or supported first'
      using errcode = '55000';
  end if;

  if hypothesis_row.status not in ('testing', 'supported') then
    raise exception 'hypothesis is not in a verifiable state'
      using errcode = '55000';
  end if;

  if target_verification_rationale is null
    or btrim(target_verification_rationale) = '' then
    raise exception 'verification_rationale is required'
      using errcode = '22023';
  end if;

  if not private.hypothesis_has_verification_basis(
    org_id,
    target_hypothesis_id,
    target_verification_rationale
  ) then
    raise exception 'verification requires a completed test with supports conclusion or hypothesis evidence with verification rationale'
      using errcode = '55000';
  end if;

  update public.problem_solving_hypotheses h
  set status                  = 'verified',
      verified_by_membership_id = actor_membership_id,
      verified_at             = statement_timestamp(),
      verification_rationale  = btrim(target_verification_rationale),
      updated_at              = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, 'verified',
    actor_membership_id, target_verification_rationale
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.verified',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'rationale', target_verification_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisVerified',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – reject_cause_hypothesis
-- ──────────────────────────────────────────────────────────────

create or replace function private.reject_cause_hypothesis(
  target_hypothesis_id uuid,
  target_rejection_rationale text default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis rejection is not authorised'
      using errcode = '42501';
  end if;

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id
  for update;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'hypothesis is not in a rejectable state'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_hypotheses h
  set status                  = 'rejected',
      rejected_by_membership_id = actor_membership_id,
      rejected_at             = statement_timestamp(),
      rejection_rationale     = target_rejection_rationale,
      updated_at              = statement_timestamp()
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  perform private.append_hypothesis_status_history(
    org_id, target_hypothesis_id,
    hypothesis_row.status, 'rejected',
    actor_membership_id, target_rejection_rationale
  );

  perform private.append_business_audit(
    org_id,
    'hypothesis.rejected',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'from_status', hypothesis_row.status,
      'rationale', target_rejection_rationale
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisRejected',
    target_hypothesis_id::text,
    jsonb_build_object(
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- Authenticated RLS policies
-- ──────────────────────────────────────────────────────────────

grant select on public.problem_solving_hypotheses to authenticated;
grant select on public.problem_solving_hypothesis_status_history to authenticated;

create policy problem_solving_hypotheses_select
on public.problem_solving_hypotheses for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

create policy ps_hypothesis_status_history_select
on public.problem_solving_hypothesis_status_history for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_hypotheses h
    where h.organisation_id = problem_solving_hypothesis_status_history.organisation_id
      and h.id = problem_solving_hypothesis_status_history.hypothesis_id
      and private.can_read_problem_solving_case(h.organisation_id, h.problem_solving_case_id)
  )
);

-- ──────────────────────────────────────────────────────────────
-- Public wrappers
-- ──────────────────────────────────────────────────────────────

create or replace function public.create_hypothesis(
  target_problem_solving_case_id uuid,
  target_statement text,
  target_parent_hypothesis_id uuid default null,
  target_category text default null,
  target_rationale text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_hypothesis(
  target_problem_solving_case_id,
  target_statement,
  target_parent_hypothesis_id,
  target_category,
  target_rationale
) $$;

create or replace function public.update_hypothesis_status(
  target_hypothesis_id uuid,
  target_status text,
  target_reason text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.update_hypothesis_status(
  target_hypothesis_id,
  target_status,
  target_reason
) $$;

create or replace function public.verify_cause_hypothesis(
  target_hypothesis_id uuid,
  target_verification_rationale text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.verify_cause_hypothesis(
  target_hypothesis_id,
  target_verification_rationale
) $$;

create or replace function public.reject_cause_hypothesis(
  target_hypothesis_id uuid,
  target_rejection_rationale text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.reject_cause_hypothesis(
  target_hypothesis_id,
  target_rejection_rationale
) $$;

-- ──────────────────────────────────────────────────────────────
-- Grants
-- ──────────────────────────────────────────────────────────────

grant execute on function public.create_hypothesis(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.update_hypothesis_status(uuid, text, text) to authenticated;
grant execute on function public.verify_cause_hypothesis(uuid, text) to authenticated;
grant execute on function public.reject_cause_hypothesis(uuid, text) to authenticated;

revoke all on function public.create_hypothesis(uuid, text, uuid, text, text) from public, anon;
revoke all on function public.update_hypothesis_status(uuid, text, text) from public, anon;
revoke all on function public.verify_cause_hypothesis(uuid, text) from public, anon;
revoke all on function public.reject_cause_hypothesis(uuid, text) from public, anon;

revoke all on function private.create_hypothesis(uuid, text, uuid, text, text) from public;
revoke all on function private.update_hypothesis_status(uuid, text, text) from public;
revoke all on function private.verify_cause_hypothesis(uuid, text) from public;
revoke all on function private.reject_cause_hypothesis(uuid, text) from public;
revoke all on function private.append_hypothesis_status_history(uuid, uuid, text, text, uuid, text) from public;

grant execute on function private.create_hypothesis(uuid, text, uuid, text, text) to lean_hub_private_owner;
grant execute on function private.update_hypothesis_status(uuid, text, text) to lean_hub_private_owner;
grant execute on function private.verify_cause_hypothesis(uuid, text) to lean_hub_private_owner;
grant execute on function private.reject_cause_hypothesis(uuid, text) to lean_hub_private_owner;
grant execute on function private.append_hypothesis_status_history(uuid, uuid, text, text, uuid, text) to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- Function ownership
-- ──────────────────────────────────────────────────────────────

alter function private.append_hypothesis_status_history(uuid, uuid, text, text, uuid, text)
  owner to lean_hub_private_owner;
alter function private.create_hypothesis(uuid, text, uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.update_hypothesis_status(uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.verify_cause_hypothesis(uuid, text)
  owner to lean_hub_private_owner;
alter function private.reject_cause_hypothesis(uuid, text)
  owner to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- ALTER evidence_links – add hypothesis_id FK
-- ──────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_solving_evidence_links'
      and column_name = 'hypothesis_id'
  ) then
    alter table public.problem_solving_evidence_links
      add column hypothesis_id uuid;

    alter table public.problem_solving_evidence_links
      add constraint problem_solving_evidence_links_hypothesis_fkey
        foreign key (organisation_id, hypothesis_id)
        references public.problem_solving_hypotheses(organisation_id, id)
        on delete restrict;

    create index problem_solving_evidence_links_hypothesis_idx
      on public.problem_solving_evidence_links (organisation_id, hypothesis_id)
      where hypothesis_id is not null;
  end if;
end;
$$;
