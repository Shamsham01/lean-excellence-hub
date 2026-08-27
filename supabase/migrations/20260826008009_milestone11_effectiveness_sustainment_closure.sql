-- Milestone 11: effectiveness checks, sustainment, lessons learned, case closure and stage navigation.

-- Add closed_by_membership_id to cases (missing from original schema)

alter table public.problem_solving_cases
  add column if not exists closed_by_membership_id uuid;

alter table public.problem_solving_cases
  add constraint problem_solving_cases_closed_by_fkey
  foreign key (organisation_id, closed_by_membership_id)
  references public.organisation_memberships(organisation_id, id)
  on delete restrict;

-- Widen closure_outcome to include the verified/unverified variants

alter table public.problem_solving_cases
  drop constraint if exists problem_solving_cases_closure_outcome_check;

alter table public.problem_solving_cases
  add constraint problem_solving_cases_closure_outcome_check
  check (
    (status <> 'closed' and closure_outcome is null)
    or (status = 'closed' and closure_outcome in (
      'resolved_verified_cause',
      'resolved_without_verified_cause',
      'transferred'
    ))
  );

create table public.problem_solving_effectiveness_checks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  criterion text not null,
  baseline_description text,
  target_description text,
  baseline_numeric numeric,
  target_numeric numeric,
  actual_numeric numeric,
  unit text,
  observation_window_start date,
  observation_window_end date,
  due_date date,
  result text,
  verified_by_membership_id uuid,
  verified_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ps_effectiveness_checks_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_effectiveness_checks_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ps_effectiveness_checks_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_effectiveness_checks_verifier_fkey
    foreign key (organisation_id, verified_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_effectiveness_checks_criterion_check
    check (criterion = btrim(criterion) and char_length(criterion) between 1 and 500),
  constraint ps_effectiveness_checks_baseline_desc_check
    check (baseline_description is null or char_length(baseline_description) <= 4000),
  constraint ps_effectiveness_checks_target_desc_check
    check (target_description is null or char_length(target_description) <= 4000),
  constraint ps_effectiveness_checks_unit_check
    check (unit is null or char_length(unit) <= 100),
  constraint ps_effectiveness_checks_observation_window_check
    check (
      observation_window_start is null
      or observation_window_end is null
      or observation_window_end >= observation_window_start
    ),
  constraint ps_effectiveness_checks_result_check
    check (result is null or result in ('pass', 'fail', 'inconclusive')),
  constraint ps_effectiveness_checks_verified_provenance_check
    check (
      (verified_by_membership_id is null and verified_at is null)
      or (verified_by_membership_id is not null and verified_at is not null)
    )
);

create table public.problem_solving_effectiveness_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  effectiveness_check_id uuid not null,
  attachment_id uuid not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ps_eff_evidence_links_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_eff_evidence_links_check_attachment_key
    unique (organisation_id, effectiveness_check_id, attachment_id),
  constraint ps_eff_evidence_links_check_fkey
    foreign key (organisation_id, effectiveness_check_id)
    references public.problem_solving_effectiveness_checks(organisation_id, id)
    on delete restrict,
  constraint ps_eff_evidence_links_attachment_fkey
    foreign key (organisation_id, attachment_id)
    references public.attachments(organisation_id, id)
    on delete restrict,
  constraint ps_eff_evidence_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

create table public.problem_solving_sustainment_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  what text not null,
  owner_membership_id uuid,
  check_method text,
  follow_up_date date,
  result text,
  training_session_id uuid,
  schedule_definition_id uuid,
  evidence text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ps_sustainment_items_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_sustainment_items_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ps_sustainment_items_owner_fkey
    foreign key (organisation_id, owner_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_sustainment_items_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_sustainment_items_training_fkey
    foreign key (organisation_id, training_session_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint ps_sustainment_items_schedule_fkey
    foreign key (organisation_id, schedule_definition_id)
    references public.resource_records(organisation_id, id)
    on delete restrict,
  constraint ps_sustainment_items_what_check
    check (what = btrim(what) and char_length(what) between 1 and 500),
  constraint ps_sustainment_items_check_method_check
    check (check_method is null or char_length(check_method) <= 4000),
  constraint ps_sustainment_items_result_check
    check (result is null or char_length(result) <= 4000),
  constraint ps_sustainment_items_evidence_check
    check (evidence is null or char_length(evidence) <= 4000)
);

-- Add FK from existing action_context to sustainment_items

alter table public.problem_solving_action_context
  add constraint problem_solving_action_context_sustainment_item_fkey
  foreign key (organisation_id, sustainment_item_id)
  references public.problem_solving_sustainment_items(organisation_id, id)
  on delete restrict;

create table public.problem_solving_lessons_learned (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  case_id uuid not null,
  what_happened text not null,
  what_learned text not null,
  standardise text,
  apply_elsewhere text,
  notes text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint ps_lessons_learned_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_lessons_learned_case_fkey
    foreign key (organisation_id, case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint ps_lessons_learned_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint ps_lessons_learned_what_happened_check
    check (what_happened = btrim(what_happened) and char_length(what_happened) between 1 and 4000),
  constraint ps_lessons_learned_what_learned_check
    check (what_learned = btrim(what_learned) and char_length(what_learned) between 1 and 4000),
  constraint ps_lessons_learned_standardise_check
    check (standardise is null or char_length(standardise) <= 4000),
  constraint ps_lessons_learned_apply_elsewhere_check
    check (apply_elsewhere is null or char_length(apply_elsewhere) <= 4000),
  constraint ps_lessons_learned_notes_check
    check (notes is null or char_length(notes) <= 4000)
);

-- Triggers

create trigger ps_effectiveness_checks_touch_updated_at
before update on public.problem_solving_effectiveness_checks
for each row execute function private.touch_updated_at();

create trigger ps_effectiveness_checks_prevent_org_change
before update on public.problem_solving_effectiveness_checks
for each row execute function private.prevent_organisation_id_change();

create trigger ps_eff_evidence_links_prevent_org_change
before update on public.problem_solving_effectiveness_evidence_links
for each row execute function private.prevent_organisation_id_change();

create trigger ps_sustainment_items_touch_updated_at
before update on public.problem_solving_sustainment_items
for each row execute function private.touch_updated_at();

create trigger ps_sustainment_items_prevent_org_change
before update on public.problem_solving_sustainment_items
for each row execute function private.prevent_organisation_id_change();

create trigger ps_lessons_learned_touch_updated_at
before update on public.problem_solving_lessons_learned
for each row execute function private.touch_updated_at();

create trigger ps_lessons_learned_prevent_org_change
before update on public.problem_solving_lessons_learned
for each row execute function private.prevent_organisation_id_change();

-- Indexes

create index ps_effectiveness_checks_case_idx
  on public.problem_solving_effectiveness_checks (organisation_id, case_id);
create index ps_eff_evidence_links_check_idx
  on public.problem_solving_effectiveness_evidence_links (organisation_id, effectiveness_check_id);
create index ps_sustainment_items_case_idx
  on public.problem_solving_sustainment_items (organisation_id, case_id);
create index ps_lessons_learned_case_idx
  on public.problem_solving_lessons_learned (organisation_id, case_id);

-- RLS

alter table public.problem_solving_effectiveness_checks enable row level security;
alter table public.problem_solving_effectiveness_checks force row level security;
alter table public.problem_solving_effectiveness_evidence_links enable row level security;
alter table public.problem_solving_effectiveness_evidence_links force row level security;
alter table public.problem_solving_sustainment_items enable row level security;
alter table public.problem_solving_sustainment_items force row level security;
alter table public.problem_solving_lessons_learned enable row level security;
alter table public.problem_solving_lessons_learned force row level security;

revoke all on public.problem_solving_effectiveness_checks from public, anon, authenticated, service_role;
revoke all on public.problem_solving_effectiveness_evidence_links from public, anon, authenticated, service_role;
revoke all on public.problem_solving_sustainment_items from public, anon, authenticated, service_role;
revoke all on public.problem_solving_lessons_learned from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_effectiveness_checks to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_effectiveness_evidence_links to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_sustainment_items to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_lessons_learned to lean_hub_private_owner;

create policy private_owner_all_ps_effectiveness_checks
on public.problem_solving_effectiveness_checks for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_eff_evidence_links
on public.problem_solving_effectiveness_evidence_links for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_sustainment_items
on public.problem_solving_sustainment_items for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_lessons_learned
on public.problem_solving_lessons_learned for all to lean_hub_private_owner
using (true) with check (true);

-- Authenticated read policies

grant select on public.problem_solving_effectiveness_checks to authenticated;
grant select on public.problem_solving_effectiveness_evidence_links to authenticated;
grant select on public.problem_solving_sustainment_items to authenticated;
grant select on public.problem_solving_lessons_learned to authenticated;

create policy ps_effectiveness_checks_select
on public.problem_solving_effectiveness_checks for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

create policy ps_eff_evidence_links_select
on public.problem_solving_effectiveness_evidence_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_effectiveness_checks eff_check
    where eff_check.organisation_id = problem_solving_effectiveness_evidence_links.organisation_id
      and eff_check.id = problem_solving_effectiveness_evidence_links.effectiveness_check_id
      and private.can_read_problem_solving_case(eff_check.organisation_id, eff_check.case_id)
  )
);

create policy ps_sustainment_items_select
on public.problem_solving_sustainment_items for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

create policy ps_lessons_learned_select
on public.problem_solving_lessons_learned for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, case_id)
);

-- close_problem_solving_case RPC

create or replace function private.close_problem_solving_case(
  target_case_id uuid,
  target_closure_outcome text,
  target_closure_rationale text default null
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
  case_row public.problem_solving_cases%rowtype;
  has_verified_cause boolean;
  has_corrective_countermeasures boolean;
  has_effectiveness_checks boolean;
  all_effectiveness_passed boolean;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case closure is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status not in ('draft', 'active') then
    raise exception 'case cannot be closed from current status'
      using errcode = '55000';
  end if;

  if not private.can_close_problem_solving_case(org_id, target_case_id) then
    raise exception 'case closure is not authorised'
      using errcode = '42501';
  end if;

  if target_closure_outcome not in (
    'resolved_verified_cause',
    'resolved_without_verified_cause',
    'transferred'
  ) then
    raise exception 'invalid closure outcome'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.problem_solving_hypotheses h
    where h.organisation_id = org_id
      and h.problem_solving_case_id = target_case_id
      and h.status = 'verified'
  )
  into has_verified_cause;

  select exists (
    select 1
    from public.problem_solving_countermeasures cm
    where cm.organisation_id = org_id
      and cm.problem_solving_case_id = target_case_id
      and cm.status in ('selected', 'implementing', 'implemented', 'effective')
  )
  into has_corrective_countermeasures;

  if target_closure_outcome = 'resolved_verified_cause' then
    if not has_verified_cause then
      raise exception 'resolved_verified_cause requires at least one verified hypothesis'
        using errcode = '22023';
    end if;
  end if;

  if target_closure_outcome = 'resolved_without_verified_cause' then
    if target_closure_rationale is null or btrim(target_closure_rationale) = '' then
      raise exception 'resolved_without_verified_cause requires a closure rationale'
        using errcode = '22023';
    end if;

    if has_corrective_countermeasures then
      select exists (
        select 1
        from public.problem_solving_effectiveness_checks eff
        where eff.organisation_id = org_id
          and eff.case_id = target_case_id
      )
      into has_effectiveness_checks;

      if not has_effectiveness_checks then
        raise exception 'corrective countermeasures require effectiveness checks before closure'
          using errcode = '22023';
      end if;
    end if;
  end if;

  if has_corrective_countermeasures then
    select not exists (
      select 1
      from public.problem_solving_effectiveness_checks eff
      where eff.organisation_id = org_id
        and eff.case_id = target_case_id
        and (eff.result is null or eff.result = 'fail')
    )
    into all_effectiveness_passed;

    if not all_effectiveness_passed and target_closure_outcome <> 'transferred' then
      raise exception 'all effectiveness checks must pass or be inconclusive before closure'
        using errcode = '22023';
    end if;
  end if;

  update public.problem_solving_cases ps_case
  set status = 'closed',
      closure_outcome = target_closure_outcome,
      closure_rationale = target_closure_rationale,
      closed_at = statement_timestamp(),
      closed_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    case_row.status,
    'closed',
    actor_membership_id,
    target_closure_outcome || coalesce(': ' || target_closure_rationale, '')
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_closed',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'closure_outcome', target_closure_outcome,
      'has_verified_cause', has_verified_cause
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseClosed',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'closure_outcome', target_closure_outcome
    )
  );

  return true;
end;
$$;

-- cancel_problem_solving_case RPC (distinct from closure)

create or replace function private.cancel_problem_solving_case(
  target_case_id uuid,
  target_cancellation_rationale text
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
  case_row public.problem_solving_cases%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case cancellation is not authorised'
      using errcode = '42501';
  end if;

  if target_cancellation_rationale is null or btrim(target_cancellation_rationale) = '' then
    raise exception 'cancellation requires a rationale'
      using errcode = '22023';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status in ('closed', 'cancelled') then
    raise exception 'case cannot be cancelled from current status'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'case cancellation is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_cases ps_case
  set status = 'cancelled',
      cancellation_rationale = btrim(target_cancellation_rationale),
      cancelled_at = statement_timestamp(),
      cancelled_by_membership_id = actor_membership_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_status_history (
    organisation_id,
    case_id,
    from_status,
    to_status,
    changed_by_membership_id,
    rationale
  )
  values (
    org_id,
    target_case_id,
    case_row.status,
    'cancelled',
    actor_membership_id,
    target_cancellation_rationale
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_cancelled',
    target_case_id,
    'succeeded',
    jsonb_build_object('rationale', target_cancellation_rationale)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseCancelled',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'rationale', target_cancellation_rationale
    )
  );

  return true;
end;
$$;

-- move_problem_solving_stage RPC

create or replace function private.move_problem_solving_stage(
  target_case_id uuid,
  target_stage_id uuid
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
  case_row public.problem_solving_cases%rowtype;
  stage_belongs boolean;
  previous_stage_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'stage movement is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.status <> 'active' then
    raise exception 'stage movement requires an active case'
      using errcode = '55000';
  end if;

  if case_row.method_version_id is null then
    raise exception 'case has no pinned method version'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'stage movement is not authorised'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.problem_solving_method_stages stage
    where stage.organisation_id = org_id
      and stage.id = target_stage_id
      and stage.method_version_id = case_row.method_version_id
  )
  into stage_belongs;

  if not stage_belongs then
    raise exception 'target stage does not belong to the pinned method version'
      using errcode = '22023';
  end if;

  previous_stage_id := case_row.current_method_stage_id;

  update public.problem_solving_cases ps_case
  set current_method_stage_id = target_stage_id,
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  insert into public.problem_solving_stage_history (
    organisation_id,
    case_id,
    from_stage_id,
    to_stage_id,
    changed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    previous_stage_id,
    target_stage_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.stage_moved',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'from_stage_id', previous_stage_id,
      'to_stage_id', target_stage_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingStageMoved',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'from_stage_id', previous_stage_id,
      'to_stage_id', target_stage_id
    )
  );

  return true;
end;
$$;

-- activate_problem_solving_case (pin method version & set first stage)

create or replace function private.activate_problem_solving_case(
  target_case_id uuid,
  target_method_id uuid
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
  case_row public.problem_solving_cases%rowtype;
  resolved_method_version_id uuid;
  first_stage_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

  select ps_case.*
  into case_row
  from public.problem_solving_cases ps_case
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id
  for update;

  if not found then
    raise exception 'problem solving case not found'
      using errcode = 'P0002';
  end if;

  if case_row.method_version_id is not null then
    raise exception 'case already has a pinned method version'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, target_case_id) then
    raise exception 'case activation is not authorised'
      using errcode = '42501';
  end if;

  select mv.id
  into resolved_method_version_id
  from public.problem_solving_method_versions mv
  where mv.organisation_id = org_id
    and mv.method_id = target_method_id
    and mv.status = 'published'
  order by mv.version_number desc
  limit 1;

  if resolved_method_version_id is null then
    raise exception 'no published method version found'
      using errcode = 'P0002';
  end if;

  select stage.id
  into first_stage_id
  from public.problem_solving_method_stages stage
  where stage.organisation_id = org_id
    and stage.method_version_id = resolved_method_version_id
  order by stage.display_order asc
  limit 1;

  if first_stage_id is null then
    raise exception 'method version has no stages'
      using errcode = 'P0002';
  end if;

  update public.problem_solving_cases ps_case
  set method_version_id = resolved_method_version_id,
      current_method_stage_id = first_stage_id,
      status = 'active',
      activated_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where ps_case.organisation_id = org_id
    and ps_case.id = target_case_id;

  if case_row.status = 'draft' then
    insert into public.problem_solving_status_history (
      organisation_id,
      case_id,
      from_status,
      to_status,
      changed_by_membership_id,
      rationale
    )
    values (
      org_id,
      target_case_id,
      'draft',
      'active',
      actor_membership_id,
      'method activated'
    );
  end if;

  insert into public.problem_solving_stage_history (
    organisation_id,
    case_id,
    from_stage_id,
    to_stage_id,
    changed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    null,
    first_stage_id,
    actor_membership_id
  );

  perform private.append_business_audit(
    org_id,
    'problem_solving.case_activated',
    target_case_id,
    'succeeded',
    jsonb_build_object(
      'method_version_id', resolved_method_version_id,
      'first_stage_id', first_stage_id
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCaseActivated',
    target_case_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'method_version_id', resolved_method_version_id,
      'first_stage_id', first_stage_id
    )
  );

  return true;
end;
$$;

-- Public RPC wrappers

create or replace function public.close_problem_solving_case(
  target_case_id uuid,
  target_closure_outcome text,
  target_closure_rationale text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.close_problem_solving_case(
  target_case_id,
  target_closure_outcome,
  target_closure_rationale
) $$;

create or replace function public.cancel_problem_solving_case(
  target_case_id uuid,
  target_cancellation_rationale text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.cancel_problem_solving_case(
  target_case_id,
  target_cancellation_rationale
) $$;

create or replace function public.move_problem_solving_stage(
  target_case_id uuid,
  target_stage_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.move_problem_solving_stage(
  target_case_id,
  target_stage_id
) $$;

create or replace function public.activate_problem_solving_case(
  target_case_id uuid,
  target_method_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.activate_problem_solving_case(
  target_case_id,
  target_method_id
) $$;

grant execute on function public.close_problem_solving_case(uuid, text, text) to authenticated;
grant execute on function public.cancel_problem_solving_case(uuid, text) to authenticated;
grant execute on function public.move_problem_solving_stage(uuid, uuid) to authenticated;
grant execute on function public.activate_problem_solving_case(uuid, uuid) to authenticated;

revoke all on function public.close_problem_solving_case(uuid, text, text) from public, anon;
revoke all on function public.cancel_problem_solving_case(uuid, text) from public, anon;
revoke all on function public.move_problem_solving_stage(uuid, uuid) from public, anon;
revoke all on function public.activate_problem_solving_case(uuid, uuid) from public, anon;

revoke all on function private.close_problem_solving_case(uuid, text, text) from public;
revoke all on function private.cancel_problem_solving_case(uuid, text) from public;
revoke all on function private.move_problem_solving_stage(uuid, uuid) from public;
revoke all on function private.activate_problem_solving_case(uuid, uuid) from public;

grant execute on function private.close_problem_solving_case(uuid, text, text) to lean_hub_private_owner;
grant execute on function private.cancel_problem_solving_case(uuid, text) to lean_hub_private_owner;
grant execute on function private.move_problem_solving_stage(uuid, uuid) to lean_hub_private_owner;
grant execute on function private.activate_problem_solving_case(uuid, uuid) to lean_hub_private_owner;

alter function private.close_problem_solving_case(uuid, text, text) owner to lean_hub_private_owner;
alter function private.cancel_problem_solving_case(uuid, text) owner to lean_hub_private_owner;
alter function private.move_problem_solving_stage(uuid, uuid) owner to lean_hub_private_owner;
alter function private.activate_problem_solving_case(uuid, uuid) owner to lean_hub_private_owner;
