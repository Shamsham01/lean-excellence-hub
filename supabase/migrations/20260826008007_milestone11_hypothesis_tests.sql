-- Milestone 11: hypothesis tests, completion workflow, evidence link extensions.

-- ──────────────────────────────────────────────────────────────
-- problem_solving_hypothesis_tests
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_hypothesis_tests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  hypothesis_id uuid not null,
  test_question text not null,
  expected_result text not null,
  method text,
  owner_membership_id uuid not null,
  planned_date date,
  completed_date date,
  actual_result text,
  conclusion text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_hypothesis_tests_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_hypothesis_tests_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypothesis_tests_hypothesis_fkey
    foreign key (organisation_id, hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypothesis_tests_owner_fkey
    foreign key (organisation_id, owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypothesis_tests_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_hypothesis_tests_question_check
    check (test_question = btrim(test_question) and char_length(test_question) between 1 and 2000),
  constraint problem_solving_hypothesis_tests_expected_result_check
    check (expected_result = btrim(expected_result) and char_length(expected_result) between 1 and 2000),
  constraint problem_solving_hypothesis_tests_method_check
    check (method is null or char_length(method) <= 4000),
  constraint problem_solving_hypothesis_tests_actual_result_check
    check (actual_result is null or char_length(actual_result) <= 4000),
  constraint problem_solving_hypothesis_tests_conclusion_check
    check (conclusion is null or conclusion in ('supports', 'refutes', 'inconclusive')),
  constraint problem_solving_hypothesis_tests_completion_semantics_check
    check (
      (completed_date is null and actual_result is null and conclusion is null)
      or (completed_date is not null and actual_result is not null and conclusion is not null)
    )
);

-- ──────────────────────────────────────────────────────────────
-- Triggers
-- ──────────────────────────────────────────────────────────────

create trigger problem_solving_hypothesis_tests_touch_updated_at
before update on public.problem_solving_hypothesis_tests
for each row execute function private.touch_updated_at();

create trigger problem_solving_hypothesis_tests_prevent_org_change
before update on public.problem_solving_hypothesis_tests
for each row execute function private.prevent_organisation_id_change();

-- ──────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────

create index problem_solving_hypothesis_tests_case_idx
  on public.problem_solving_hypothesis_tests (organisation_id, problem_solving_case_id);
create index problem_solving_hypothesis_tests_hypothesis_idx
  on public.problem_solving_hypothesis_tests (organisation_id, hypothesis_id);
create index problem_solving_hypothesis_tests_owner_idx
  on public.problem_solving_hypothesis_tests (organisation_id, owner_membership_id);

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

alter table public.problem_solving_hypothesis_tests enable row level security;
alter table public.problem_solving_hypothesis_tests force row level security;

revoke all on public.problem_solving_hypothesis_tests from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_hypothesis_tests to lean_hub_private_owner;

create policy private_owner_all_problem_solving_hypothesis_tests
on public.problem_solving_hypothesis_tests for all to lean_hub_private_owner
using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- RPCs – create_hypothesis_test
-- ──────────────────────────────────────────────────────────────

create or replace function private.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
  resolved_owner_membership_id uuid;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  select h.*
  into hypothesis_row
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  if not found then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    hypothesis_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'cannot create tests for a hypothesis in terminal state'
      using errcode = '55000';
  end if;

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  insert into public.problem_solving_hypothesis_tests (
    organisation_id,
    problem_solving_case_id,
    hypothesis_id,
    test_question,
    expected_result,
    method,
    owner_membership_id,
    planned_date,
    created_by_membership_id
  )
  values (
    org_id,
    hypothesis_row.problem_solving_case_id,
    target_hypothesis_id,
    btrim(target_test_question),
    btrim(target_expected_result),
    target_method,
    resolved_owner_membership_id,
    target_planned_date,
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'hypothesis_test.created',
    hypothesis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'test_id', new_id,
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'HypothesisTestCreated',
    new_id::text,
    jsonb_build_object(
      'test_id', new_id,
      'hypothesis_id', target_hypothesis_id,
      'case_id', hypothesis_row.problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – complete_hypothesis_test (does NOT auto-verify hypothesis)
-- ──────────────────────────────────────────────────────────────

create or replace function private.complete_hypothesis_test(
  target_hypothesis_test_id uuid,
  target_actual_result text,
  target_conclusion text
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
  test_row public.problem_solving_hypothesis_tests%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test completion is not authorised'
      using errcode = '42501';
  end if;

  if target_conclusion not in ('supports', 'refutes', 'inconclusive') then
    raise exception 'invalid conclusion; must be supports, refutes, or inconclusive'
      using errcode = '22023';
  end if;

  if target_actual_result is null or btrim(target_actual_result) = '' then
    raise exception 'actual_result is required to complete a test'
      using errcode = '22023';
  end if;

  select t.*
  into test_row
  from public.problem_solving_hypothesis_tests t
  where t.organisation_id = org_id
    and t.id = target_hypothesis_test_id
  for update;

  if not found then
    raise exception 'hypothesis test not found'
      using errcode = 'P0002';
  end if;

  if test_row.completed_date is not null then
    raise exception 'hypothesis test is already completed'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    test_row.problem_solving_case_id
  ) then
    raise exception 'hypothesis test completion is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_hypothesis_tests t
  set actual_result  = btrim(target_actual_result),
      conclusion     = target_conclusion,
      completed_date = current_date,
      updated_at     = statement_timestamp()
  where t.organisation_id = org_id
    and t.id = target_hypothesis_test_id;

  perform private.append_business_audit(
    org_id,
    'hypothesis_test.completed',
    test_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'test_id', target_hypothesis_test_id,
      'hypothesis_id', test_row.hypothesis_id,
      'conclusion', target_conclusion
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    test_row.problem_solving_case_id,
    'HypothesisTestCompleted',
    target_hypothesis_test_id::text,
    jsonb_build_object(
      'test_id', target_hypothesis_test_id,
      'hypothesis_id', test_row.hypothesis_id,
      'conclusion', target_conclusion,
      'case_id', test_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- Authenticated RLS policies
-- ──────────────────────────────────────────────────────────────

grant select on public.problem_solving_hypothesis_tests to authenticated;

create policy problem_solving_hypothesis_tests_select
on public.problem_solving_hypothesis_tests for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

-- ──────────────────────────────────────────────────────────────
-- Public wrappers
-- ──────────────────────────────────────────────────────────────

create or replace function public.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_hypothesis_test(
  target_hypothesis_id,
  target_test_question,
  target_expected_result,
  target_method,
  target_owner_membership_id,
  target_planned_date
) $$;

create or replace function public.complete_hypothesis_test(
  target_hypothesis_test_id uuid,
  target_actual_result text,
  target_conclusion text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.complete_hypothesis_test(
  target_hypothesis_test_id,
  target_actual_result,
  target_conclusion
) $$;

-- ──────────────────────────────────────────────────────────────
-- Grants
-- ──────────────────────────────────────────────────────────────

grant execute on function public.create_hypothesis_test(uuid, text, text, text, uuid, date) to authenticated;
grant execute on function public.complete_hypothesis_test(uuid, text, text) to authenticated;

revoke all on function public.create_hypothesis_test(uuid, text, text, text, uuid, date) from public, anon;
revoke all on function public.complete_hypothesis_test(uuid, text, text) from public, anon;

revoke all on function private.create_hypothesis_test(uuid, text, text, text, uuid, date) from public;
revoke all on function private.complete_hypothesis_test(uuid, text, text) from public;

grant execute on function private.create_hypothesis_test(uuid, text, text, text, uuid, date) to lean_hub_private_owner;
grant execute on function private.complete_hypothesis_test(uuid, text, text) to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- Function ownership
-- ──────────────────────────────────────────────────────────────

alter function private.create_hypothesis_test(uuid, text, text, text, uuid, date)
  owner to lean_hub_private_owner;
alter function private.complete_hypothesis_test(uuid, text, text)
  owner to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- ALTER evidence_links – add hypothesis_test_id FK
-- ──────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'problem_solving_evidence_links'
      and column_name = 'hypothesis_test_id'
  ) then
    alter table public.problem_solving_evidence_links
      add column hypothesis_test_id uuid;

    alter table public.problem_solving_evidence_links
      add constraint problem_solving_evidence_links_hypothesis_test_fkey
        foreign key (organisation_id, hypothesis_test_id)
        references public.problem_solving_hypothesis_tests(organisation_id, id)
        on delete restrict;

    create index problem_solving_evidence_links_hypothesis_test_idx
      on public.problem_solving_evidence_links (organisation_id, hypothesis_test_id)
      where hypothesis_test_id is not null;
  end if;
end;
$$;
