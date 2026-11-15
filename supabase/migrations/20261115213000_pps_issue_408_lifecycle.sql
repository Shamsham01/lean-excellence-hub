-- PPS issue 408 lifecycle: sustain plan on case, action expected result, delete pending tests,
-- client mutation idempotency for analysis nodes and hypothesis tests, detail read model.
-- FLAGGED: apply via repo migration only; do not apply manually to hosted Supabase from this agent run.

-- ── Schema ─────────────────────────────────────────────────────────────────

alter table public.problem_solving_cases
  add column if not exists sustain_plan_standardised text,
  add column if not exists sustain_plan_owner_membership_id uuid,
  add column if not exists sustain_plan_monitoring text,
  add column if not exists sustain_plan_review_date date;

alter table public.problem_solving_cases
  drop constraint if exists problem_solving_cases_sustain_plan_standardised_check;

alter table public.problem_solving_cases
  add constraint problem_solving_cases_sustain_plan_standardised_check
    check (
      sustain_plan_standardised is null
      or (
        sustain_plan_standardised = btrim(sustain_plan_standardised)
        and char_length(sustain_plan_standardised) between 1 and 4000
      )
    );

alter table public.problem_solving_cases
  drop constraint if exists problem_solving_cases_sustain_plan_monitoring_check;

alter table public.problem_solving_cases
  add constraint problem_solving_cases_sustain_plan_monitoring_check
    check (
      sustain_plan_monitoring is null
      or (
        sustain_plan_monitoring = btrim(sustain_plan_monitoring)
        and char_length(sustain_plan_monitoring) between 1 and 4000
      )
    );

alter table public.problem_solving_cases
  drop constraint if exists problem_solving_cases_sustain_plan_owner_fkey;

alter table public.problem_solving_cases
  add constraint problem_solving_cases_sustain_plan_owner_fkey
    foreign key (organisation_id, sustain_plan_owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict;

alter table public.actions
  add column if not exists expected_result text;

alter table public.actions
  drop constraint if exists actions_expected_result_check;

alter table public.actions
  add constraint actions_expected_result_check
    check (
      expected_result is null
      or (
        expected_result = btrim(expected_result)
        and char_length(expected_result) between 1 and 2000
      )
    );

grant update (expected_result, updated_at) on public.actions to lean_hub_private_owner;

drop table if exists public.problem_solving_client_mutations cascade;

create table public.problem_solving_client_mutations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  membership_id uuid not null,
  case_id uuid not null,
  parent_id uuid not null,
  mutation_key text not null,
  resource_type text not null,
  resource_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_client_mutations_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_client_mutations_org_member_mutation_key
    unique (organisation_id, membership_id, mutation_key),
  constraint problem_solving_client_mutations_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_client_mutations_membership_fkey
    foreign key (organisation_id, membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_client_mutations_mutation_key_check
    check (
      mutation_key = btrim(mutation_key)
      and char_length(mutation_key) between 1 and 200
    ),
  constraint problem_solving_client_mutations_resource_type_check
    check (resource_type in ('analysis_node', 'hypothesis_test'))
);

create index if not exists problem_solving_client_mutations_case_idx
  on public.problem_solving_client_mutations (organisation_id, case_id, created_at desc);

alter table public.problem_solving_client_mutations enable row level security;
alter table public.problem_solving_client_mutations force row level security;

revoke all on public.problem_solving_client_mutations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_client_mutations to lean_hub_private_owner;

drop policy if exists private_owner_all_problem_solving_client_mutations
  on public.problem_solving_client_mutations;

create policy private_owner_all_problem_solving_client_mutations
on public.problem_solving_client_mutations for all to lean_hub_private_owner
using (true) with check (true);

-- ── Sustain plan upsert ─────────────────────────────────────────────────────

create or replace function private.upsert_problem_solving_sustain_plan(
  target_case_id uuid,
  target_sustain_plan_standardised text default null,
  target_sustain_plan_owner_membership_id uuid default null,
  target_sustain_plan_monitoring text default null,
  target_sustain_plan_review_date date default null
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
  normalized_standardised text;
  normalized_monitoring text;
  case_status text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'sustain plan update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'sustain plan update is not authorised'
      using errcode = '42501';
  end if;

  select case_row.status
  into case_status
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_case_id
  for update;

  if not found then
    raise exception 'sustain plan update is not authorised'
      using errcode = '42501';
  end if;

  if case_status in ('closed', 'cancelled') then
    raise exception 'case is closed; sustain plan cannot be changed'
      using errcode = '55000';
  end if;

  normalized_standardised := nullif(btrim(coalesce(target_sustain_plan_standardised, '')), '');
  normalized_monitoring := nullif(btrim(coalesce(target_sustain_plan_monitoring, '')), '');

  if normalized_standardised is null then
    raise exception 'sustain plan standardised text is required'
      using errcode = '22023';
  end if;

  if normalized_monitoring is null then
    raise exception 'sustain plan monitoring text is required'
      using errcode = '22023';
  end if;

  if target_sustain_plan_owner_membership_id is null then
    raise exception 'sustain plan owner is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_memberships member_row
    where member_row.organisation_id = org_id
      and member_row.id = target_sustain_plan_owner_membership_id
      and member_row.status = 'active'
  ) then
    raise exception 'sustain plan owner must be an active organisation member'
      using errcode = '22023';
  end if;

  if target_sustain_plan_review_date is null then
    raise exception 'sustain plan review date is required'
      using errcode = '22023';
  end if;

  if target_sustain_plan_review_date < current_date then
    raise exception 'sustain plan review date cannot be in the past'
      using errcode = '22023';
  end if;

  update public.problem_solving_cases case_row
  set sustain_plan_standardised = normalized_standardised,
      sustain_plan_owner_membership_id = target_sustain_plan_owner_membership_id,
      sustain_plan_monitoring = normalized_monitoring,
      sustain_plan_review_date = target_sustain_plan_review_date,
      updated_at = statement_timestamp()
  where case_row.organisation_id = org_id
    and case_row.id = target_case_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.sustain_plan_updated',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'case_id', target_case_id,
      'has_standardised', normalized_standardised is not null,
      'has_monitoring', normalized_monitoring is not null,
      'review_date', target_sustain_plan_review_date
    )
  );

  return true;
end;
$$;

alter function private.upsert_problem_solving_sustain_plan(
  uuid, text, uuid, text, date
) owner to lean_hub_private_owner;

revoke all on function private.upsert_problem_solving_sustain_plan(
  uuid, text, uuid, text, date
) from public, anon, authenticated, service_role;

grant execute on function private.upsert_problem_solving_sustain_plan(
  uuid, text, uuid, text, date
) to lean_hub_private_owner;

create or replace function public.upsert_problem_solving_sustain_plan(
  target_case_id uuid,
  target_sustain_plan_standardised text default null,
  target_sustain_plan_owner_membership_id uuid default null,
  target_sustain_plan_monitoring text default null,
  target_sustain_plan_review_date date default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.upsert_problem_solving_sustain_plan(
    target_case_id,
    target_sustain_plan_standardised,
    target_sustain_plan_owner_membership_id,
    target_sustain_plan_monitoring,
    target_sustain_plan_review_date
  )
$$;

grant execute on function public.upsert_problem_solving_sustain_plan(
  uuid, text, uuid, text, date
) to authenticated;

revoke all on function public.upsert_problem_solving_sustain_plan(
  uuid, text, uuid, text, date
) from public, anon, service_role;

-- ── Problem-solving actions: expected result on countermeasure actions ────────

drop function if exists public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
);

create or replace function private.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_assignee_membership_id uuid default null,
  target_expected_result text default null
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
  case_unit_id uuid;
  new_action_id uuid;
  resolved_assignee uuid;
  normalized_expected text;
begin
  if org_id is null
    or actor_membership_id is null
    or not private.can_manage_problem_solving_case(org_id, target_problem_solving_case_id) then
    raise exception 'problem-solving action creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  perform private.require_problem_solving_case_open_for_mutation(
    org_id,
    target_problem_solving_case_id,
    'case is closed; problem-solving action cannot be created'
  );

  if target_context_role not in ('containment', 'countermeasure', 'sustainment') then
    raise exception 'invalid context role'
      using errcode = '22023';
  end if;

  if target_context_role = 'containment' and target_containment_id is null then
    raise exception 'containment actions require a containment_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'countermeasure' and target_countermeasure_id is null then
    raise exception 'countermeasure actions require a countermeasure_id'
      using errcode = '22023';
  end if;
  if target_context_role = 'sustainment' and target_sustainment_item_id is null then
    raise exception 'sustainment actions require a sustainment_item_id'
      using errcode = '22023';
  end if;

  normalized_expected := nullif(btrim(coalesce(target_expected_result, '')), '');

  select case_row.organisation_unit_id
  into case_unit_id
  from public.problem_solving_cases case_row
  where case_row.organisation_id = org_id
    and case_row.id = target_problem_solving_case_id;

  new_action_id := private.create_action(
    target_title,
    target_description,
    target_priority,
    case_unit_id,
    target_problem_solving_case_id,
    target_due_at,
    null
  );

  resolved_assignee := coalesce(target_assignee_membership_id, actor_membership_id);
  perform private.set_action_assignee(new_action_id, resolved_assignee);

  update public.actions action_row
  set expected_result = normalized_expected,
      updated_at = statement_timestamp()
  where action_row.organisation_id = org_id
    and action_row.id = new_action_id;

  insert into public.problem_solving_action_context (
    organisation_id,
    problem_solving_case_id,
    action_id,
    context_role,
    containment_id,
    countermeasure_id,
    sustainment_item_id,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    new_action_id,
    target_context_role,
    target_containment_id,
    target_countermeasure_id,
    target_sustainment_item_id,
    actor_membership_id
  );

  return new_action_id;
end;
$$;

alter function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid, text
) owner to lean_hub_private_owner;

revoke all on function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid, text
) from public, anon, authenticated, service_role;

grant execute on function private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid, text
) to lean_hub_private_owner;

drop function if exists private.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid
);

create or replace function public.create_problem_solving_action(
  target_title text,
  target_problem_solving_case_id uuid,
  target_context_role text,
  target_containment_id uuid default null,
  target_countermeasure_id uuid default null,
  target_sustainment_item_id uuid default null,
  target_description text default null,
  target_priority text default 'normal',
  target_due_at timestamptz default null,
  target_assignee_membership_id uuid default null,
  target_expected_result text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_problem_solving_action(
    target_title,
    target_problem_solving_case_id,
    target_context_role,
    target_containment_id,
    target_countermeasure_id,
    target_sustainment_item_id,
    target_description,
    target_priority,
    target_due_at,
    target_assignee_membership_id,
    target_expected_result
  )
$$;

grant execute on function public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid, text
) to authenticated;

revoke all on function public.create_problem_solving_action(
  text, uuid, text, uuid, uuid, uuid, text, text, timestamptz, uuid, text
) from public, anon;

-- ── Delete pending hypothesis tests ───────────────────────────────────────────

create or replace function private.delete_hypothesis_test(
  target_test_id uuid
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
  hypothesis_row public.problem_solving_hypotheses%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test deletion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select test_table.*
  into test_row
  from public.problem_solving_hypothesis_tests test_table
  where test_table.organisation_id = org_id
    and test_table.id = target_test_id;

  if not found
    or not private.can_manage_problem_solving_case(
      org_id,
      test_row.problem_solving_case_id
    ) then
    raise exception 'hypothesis test deletion is not authorised'
      using errcode = '42501';
  end if;

  perform private.require_problem_solving_case_open_for_mutation(
    org_id,
    test_row.problem_solving_case_id,
    'case is closed; hypothesis cannot be changed'
  );

  select test_table.*
  into test_row
  from public.problem_solving_hypothesis_tests test_table
  where test_table.organisation_id = org_id
    and test_table.id = target_test_id
  for update;

  if not found then
    raise exception 'hypothesis test deletion is not authorised'
      using errcode = '42501';
  end if;

  select hypothesis_table.*
  into hypothesis_row
  from public.problem_solving_hypotheses hypothesis_table
  where hypothesis_table.organisation_id = org_id
    and hypothesis_table.id = test_row.hypothesis_id;

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'cannot delete tests for a hypothesis in terminal state'
      using errcode = '55000';
  end if;

  if test_row.completed_date is not null then
    raise exception 'only pending hypothesis tests can be deleted'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.problem_solving_evidence_links link_row
    where link_row.organisation_id = org_id
      and link_row.hypothesis_test_id = target_test_id
  )
  or exists (
    select 1
    from public.ai_source_references ref_row
    where ref_row.organisation_id = org_id
      and ref_row.hypothesis_test_id = target_test_id
  )
  or exists (
    select 1
    from public.ai_acceptance_provenance prov_row
    where prov_row.organisation_id = org_id
      and prov_row.hypothesis_test_id = target_test_id
  ) then
    raise exception 'hypothesis test has linked evidence or AI provenance and cannot be deleted'
      using errcode = '55000';
  end if;

  delete from public.problem_solving_client_mutations mutation_row
  where mutation_row.organisation_id = org_id
    and mutation_row.resource_type = 'hypothesis_test'
    and mutation_row.resource_id = target_test_id;

  delete from public.problem_solving_hypothesis_tests test_table
  where test_table.organisation_id = org_id
    and test_table.id = target_test_id
    and test_table.completed_date is null;

  perform private.append_business_audit(
    org_id,
    'hypothesis_test.deleted',
    test_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'test_id', target_test_id,
      'hypothesis_id', test_row.hypothesis_id,
      'case_id', test_row.problem_solving_case_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    test_row.problem_solving_case_id,
    'HypothesisTestDeleted',
    target_test_id::text,
    jsonb_build_object(
      'test_id', target_test_id,
      'hypothesis_id', test_row.hypothesis_id,
      'case_id', test_row.problem_solving_case_id
    )
  );

  return true;
end;
$$;

alter function private.delete_hypothesis_test(uuid) owner to lean_hub_private_owner;

revoke all on function private.delete_hypothesis_test(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.delete_hypothesis_test(uuid) to lean_hub_private_owner;

create or replace function public.delete_hypothesis_test(
  target_test_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.delete_hypothesis_test(target_test_id) $$;

grant execute on function public.delete_hypothesis_test(uuid) to authenticated;

revoke all on function public.delete_hypothesis_test(uuid)
  from public, anon, service_role;

-- ── Client mutation idempotency ─────────────────────────────────────────────

drop function if exists public.add_analysis_node(uuid, text, uuid, text, integer, jsonb);

create or replace function private.add_analysis_node(
  target_analysis_id uuid,
  target_label text,
  target_parent_node_id uuid default null,
  target_category text default null,
  target_sort_order integer default 0,
  target_display_metadata jsonb default '{}'::jsonb,
  target_mutation_key text default null
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
  analysis_row public.problem_solving_analyses%rowtype;
  normalized_mutation_key text;
  mapping_row public.problem_solving_client_mutations%rowtype;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'analysis node creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  normalized_mutation_key := nullif(btrim(coalesce(target_mutation_key, '')), '');

  select analysis_table.*
  into analysis_row
  from public.problem_solving_analyses analysis_table
  where analysis_table.organisation_id = org_id
    and analysis_table.id = target_analysis_id;

  if not found then
    raise exception 'analysis not found'
      using errcode = 'P0002';
  end if;

  if not private.can_manage_problem_solving_case(
    org_id,
    analysis_row.problem_solving_case_id
  ) then
    raise exception 'analysis node creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.require_problem_solving_case_open_for_mutation(
    org_id,
    analysis_row.problem_solving_case_id,
    'case is closed; analysis cannot be changed'
  );

  if target_parent_node_id is not null then
    if not exists (
      select 1
      from public.problem_solving_analysis_nodes parent_node
      where parent_node.organisation_id = org_id
        and parent_node.id = target_parent_node_id
        and parent_node.analysis_id = target_analysis_id
    ) then
      raise exception 'parent node not found in the same analysis'
        using errcode = 'P0002';
    end if;
  end if;

  if normalized_mutation_key is not null then
    new_id := gen_random_uuid();

    insert into public.problem_solving_client_mutations (
      organisation_id,
      membership_id,
      case_id,
      parent_id,
      mutation_key,
      resource_type,
      resource_id
    )
    values (
      org_id,
      actor_membership_id,
      analysis_row.problem_solving_case_id,
      target_analysis_id,
      normalized_mutation_key,
      'analysis_node',
      new_id
    )
    on conflict (organisation_id, membership_id, mutation_key) do nothing;

    if not found then
      select mutation_row.*
      into mapping_row
      from public.problem_solving_client_mutations mutation_row
      where mutation_row.organisation_id = org_id
        and mutation_row.membership_id = actor_membership_id
        and mutation_row.mutation_key = normalized_mutation_key;

      if mapping_row.resource_type <> 'analysis_node'
        or mapping_row.parent_id <> target_analysis_id then
        raise exception 'mutation key reused for a different request'
          using errcode = '23505';
      end if;

      if not exists (
        select 1
        from public.problem_solving_analysis_nodes node_row
        where node_row.organisation_id = org_id
          and node_row.id = mapping_row.resource_id
      ) then
        raise exception 'mutation already applied; resource was removed'
          using errcode = '55000';
      end if;

      return mapping_row.resource_id;
    end if;

    insert into public.problem_solving_analysis_nodes (
      id,
      organisation_id,
      analysis_id,
      parent_node_id,
      category,
      label,
      sort_order,
      display_metadata,
      created_by_membership_id
    )
    values (
      new_id,
      org_id,
      target_analysis_id,
      target_parent_node_id,
      target_category,
      btrim(target_label),
      target_sort_order,
      target_display_metadata,
      actor_membership_id
    );
  else
    insert into public.problem_solving_analysis_nodes (
      organisation_id,
      analysis_id,
      parent_node_id,
      category,
      label,
      sort_order,
      display_metadata,
      created_by_membership_id
    )
    values (
      org_id,
      target_analysis_id,
      target_parent_node_id,
      target_category,
      btrim(target_label),
      target_sort_order,
      target_display_metadata,
      actor_membership_id
    )
    returning id into new_id;
  end if;

  perform private.append_business_audit(
    org_id,
    'problem_solving.analysis_node_added',
    analysis_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'node_id', new_id,
      'analysis_id', target_analysis_id,
      'case_id', analysis_row.problem_solving_case_id
    )
  );

  return new_id;
end;
$$;

alter function private.add_analysis_node(
  uuid, text, uuid, text, integer, jsonb, text
) owner to lean_hub_private_owner;

revoke all on function private.add_analysis_node(
  uuid, text, uuid, text, integer, jsonb, text
) from public, anon, authenticated, service_role;

grant execute on function private.add_analysis_node(
  uuid, text, uuid, text, integer, jsonb, text
) to lean_hub_private_owner;

drop function if exists private.add_analysis_node(uuid, text, uuid, text, integer, jsonb);

create or replace function public.add_analysis_node(
  target_analysis_id uuid,
  target_label text,
  target_parent_node_id uuid default null,
  target_category text default null,
  target_sort_order integer default 0,
  target_display_metadata jsonb default '{}'::jsonb,
  target_mutation_key text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.add_analysis_node(
  target_analysis_id,
  target_label,
  target_parent_node_id,
  target_category,
  target_sort_order,
  target_display_metadata,
  target_mutation_key
) $$;

grant execute on function public.add_analysis_node(
  uuid, text, uuid, text, integer, jsonb, text
) to authenticated;

revoke all on function public.add_analysis_node(
  uuid, text, uuid, text, integer, jsonb, text
) from public, anon, service_role;

drop function if exists public.create_hypothesis_test(uuid, text, text, text, uuid, date);

create or replace function private.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text default null,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null,
  target_mutation_key text default null
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
  normalized_expected text;
  normalized_method text;
  normalized_mutation_key text;
  mapping_row public.problem_solving_client_mutations%rowtype;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis test creation is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  normalized_mutation_key := nullif(btrim(coalesce(target_mutation_key, '')), '');

  if btrim(coalesce(target_test_question, '')) = '' then
    raise exception 'test question is required'
      using errcode = '22023';
  end if;

  normalized_method := nullif(btrim(coalesce(target_method, '')), '');
  if normalized_method is null then
    raise exception 'verification method is required'
      using errcode = '22023';
  end if;

  normalized_expected := nullif(btrim(coalesce(target_expected_result, '')), '');

  select hypothesis_table.*
  into hypothesis_row
  from public.problem_solving_hypotheses hypothesis_table
  where hypothesis_table.organisation_id = org_id
    and hypothesis_table.id = target_hypothesis_id;

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

  perform private.require_problem_solving_case_open_for_mutation(
    org_id,
    hypothesis_row.problem_solving_case_id,
    'case is closed; hypothesis cannot be changed'
  );

  if hypothesis_row.status in ('verified', 'rejected', 'superseded') then
    raise exception 'cannot create tests for a hypothesis in terminal state'
      using errcode = '55000';
  end if;

  resolved_owner_membership_id := coalesce(target_owner_membership_id, actor_membership_id);

  if normalized_mutation_key is not null then
    new_id := gen_random_uuid();

    insert into public.problem_solving_client_mutations (
      organisation_id,
      membership_id,
      case_id,
      parent_id,
      mutation_key,
      resource_type,
      resource_id
    )
    values (
      org_id,
      actor_membership_id,
      hypothesis_row.problem_solving_case_id,
      target_hypothesis_id,
      normalized_mutation_key,
      'hypothesis_test',
      new_id
    )
    on conflict (organisation_id, membership_id, mutation_key) do nothing;

    if not found then
      select mutation_row.*
      into mapping_row
      from public.problem_solving_client_mutations mutation_row
      where mutation_row.organisation_id = org_id
        and mutation_row.membership_id = actor_membership_id
        and mutation_row.mutation_key = normalized_mutation_key;

      if mapping_row.resource_type <> 'hypothesis_test'
        or mapping_row.parent_id <> target_hypothesis_id then
        raise exception 'mutation key reused for a different request'
          using errcode = '23505';
      end if;

      if not exists (
        select 1
        from public.problem_solving_hypothesis_tests test_row
        where test_row.organisation_id = org_id
          and test_row.id = mapping_row.resource_id
      ) then
        raise exception 'mutation already applied; resource was removed'
          using errcode = '55000';
      end if;

      return mapping_row.resource_id;
    end if;

    insert into public.problem_solving_hypothesis_tests (
      id,
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
      new_id,
      org_id,
      hypothesis_row.problem_solving_case_id,
      target_hypothesis_id,
      btrim(target_test_question),
      normalized_expected,
      normalized_method,
      resolved_owner_membership_id,
      target_planned_date,
      actor_membership_id
    );
  else
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
      normalized_expected,
      normalized_method,
      resolved_owner_membership_id,
      target_planned_date,
      actor_membership_id
    )
    returning id into new_id;
  end if;

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

alter function private.create_hypothesis_test(
  uuid, text, text, text, uuid, date, text
) owner to lean_hub_private_owner;

revoke all on function private.create_hypothesis_test(
  uuid, text, text, text, uuid, date, text
) from public, anon, authenticated, service_role;

grant execute on function private.create_hypothesis_test(
  uuid, text, text, text, uuid, date, text
) to lean_hub_private_owner;

drop function if exists private.create_hypothesis_test(uuid, text, text, text, uuid, date);

create or replace function public.create_hypothesis_test(
  target_hypothesis_id uuid,
  target_test_question text,
  target_expected_result text default null,
  target_method text default null,
  target_owner_membership_id uuid default null,
  target_planned_date date default null,
  target_mutation_key text default null
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
  target_planned_date,
  target_mutation_key
) $$;

grant execute on function public.create_hypothesis_test(
  uuid, text, text, text, uuid, date, text
) to authenticated;

revoke all on function public.create_hypothesis_test(
  uuid, text, text, text, uuid, date, text
) from public, anon, service_role;

-- ── Case detail: sustain plan fields ────────────────────────────────────────

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
  membership_display_names jsonb;
  linked_project_id uuid;
  linked_project jsonb;
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
        'result_rationale', eff.result_rationale,
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
        'expected_result', a.expected_result,
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
  membership_display_names := private.membership_public_display_names(
    org_id,
    (
      select coalesce(array_agg(distinct referenced.membership_id), '{}'::uuid[])
      from (
        select case_row.owner_membership_id as membership_id
        union
        select case_row.facilitator_membership_id
        union
        select case_row.sustain_plan_owner_membership_id
        union
        select case_row.created_by_membership_id
        union
        select case_row.closed_by_membership_id
        union
        select case_row.cancelled_by_membership_id
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(status_history, '[]'::jsonb)) history_entry
        union
        select (history_entry->>'changed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(stage_history, '[]'::jsonb)) history_entry
        union
        select (hypothesis_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (hypothesis_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(hypotheses, '[]'::jsonb)) hypothesis_entry
        union
        select (countermeasure_entry->>'proposed_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'selected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (countermeasure_entry->>'rejected_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(countermeasures, '[]'::jsonb)) countermeasure_entry
        union
        select (effectiveness_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (effectiveness_entry->>'verified_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(effectiveness_checks, '[]'::jsonb)) effectiveness_entry
        union
        select (sustainment_entry->>'owner_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (sustainment_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(sustainment_items, '[]'::jsonb)) sustainment_entry
        union
        select (lesson_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(lessons_learned, '[]'::jsonb)) lesson_entry
        union
        select (session_entry->>'facilitator_membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        union
        select (participant_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(sessions, '[]'::jsonb)) session_entry
        cross join lateral jsonb_array_elements(
          coalesce(session_entry->'participants', '[]'::jsonb)
        ) participant_entry
        union
        select (evidence_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(evidence_links, '[]'::jsonb)) evidence_entry
        union
        select (action_entry->>'created_by_membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        union
        select (assignee_entry->>'membership_id')::uuid
        from jsonb_array_elements(coalesce(actions, '[]'::jsonb)) action_entry
        cross join lateral jsonb_array_elements(
          coalesce(action_entry->'assignees', '[]'::jsonb)
        ) assignee_entry
      ) referenced
      where referenced.membership_id is not null
    )
  );

  select link_row.project_id
  into linked_project_id
  from public.ci_project_source_links link_row
  where link_row.organisation_id = org_id
    and link_row.source_resource_id = target_case_id
    and link_row.link_kind = 'work_item'
  limit 1;

  select private.ci_project_link_summary(org_id, linked_project_id)
  into linked_project;

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
    'owner_display_name', private.membership_public_display_name(
      org_id,
      case_row.owner_membership_id
    ),
    'facilitator_membership_id', case_row.facilitator_membership_id,
    'facilitator_display_name', private.membership_public_display_name(
      org_id,
      case_row.facilitator_membership_id
    ),
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
    'source_links', source_links,
    'membership_display_names', membership_display_names,
    'linked_project', linked_project
  )
  || jsonb_build_object(
    'sustain_plan_standardised', case_row.sustain_plan_standardised,
    'sustain_plan_owner_membership_id', case_row.sustain_plan_owner_membership_id,
    'sustain_plan_owner_display_name', private.membership_public_display_name(
      org_id,
      case_row.sustain_plan_owner_membership_id
    ),
    'sustain_plan_monitoring', case_row.sustain_plan_monitoring,
    'sustain_plan_review_date', case_row.sustain_plan_review_date
  );
end;
$$;

grant execute on function public.get_problem_solving_detail(uuid) to authenticated;
revoke all on function public.get_problem_solving_detail(uuid) from public, anon;
