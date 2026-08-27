-- Milestone 11: countermeasures domain, cause links, and lifecycle RPCs.

create table public.problem_solving_countermeasures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  title text not null,
  description text,
  rationale text,
  status text not null default 'proposed',
  selected_by_membership_id uuid,
  selected_at timestamptz,
  selected_rationale text,
  rejected_by_membership_id uuid,
  rejected_at timestamptz,
  rejected_rationale text,
  proposed_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_countermeasures_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_countermeasures_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_countermeasures_proposer_fkey
    foreign key (organisation_id, proposed_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_countermeasures_selector_fkey
    foreign key (organisation_id, selected_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_countermeasures_rejector_fkey
    foreign key (organisation_id, rejected_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_countermeasures_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint problem_solving_countermeasures_description_check
    check (description is null or char_length(description) <= 8000),
  constraint problem_solving_countermeasures_rationale_check
    check (rationale is null or char_length(rationale) <= 4000),
  constraint problem_solving_countermeasures_selected_rationale_check
    check (selected_rationale is null or char_length(selected_rationale) <= 4000),
  constraint problem_solving_countermeasures_rejected_rationale_check
    check (rejected_rationale is null or char_length(rejected_rationale) <= 4000),
  constraint problem_solving_countermeasures_status_check
    check (
      status in (
        'proposed',
        'selected',
        'rejected',
        'implementing',
        'implemented',
        'effective',
        'ineffective',
        'superseded'
      )
    ),
  constraint problem_solving_countermeasures_selected_provenance_check
    check (
      (status not in ('selected', 'implementing', 'implemented', 'effective', 'ineffective', 'superseded'))
      or (
        selected_by_membership_id is not null
        and selected_at is not null
      )
    ),
  constraint problem_solving_countermeasures_rejected_provenance_check
    check (
      status <> 'rejected'
      or (
        rejected_by_membership_id is not null
        and rejected_at is not null
      )
    )
);

create table public.problem_solving_countermeasure_cause_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  countermeasure_id uuid not null,
  hypothesis_id uuid not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint ps_cm_cause_links_organisation_id_id_key
    unique (organisation_id, id),
  constraint ps_cm_cause_links_cm_hypothesis_key
    unique (organisation_id, countermeasure_id, hypothesis_id),
  constraint ps_cm_cause_links_countermeasure_fkey
    foreign key (organisation_id, countermeasure_id)
    references public.problem_solving_countermeasures(organisation_id, id)
    on delete restrict,
  constraint ps_cm_cause_links_hypothesis_fkey
    foreign key (organisation_id, hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint ps_cm_cause_links_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict
);

-- Add FK from existing action_context to countermeasures

alter table public.problem_solving_action_context
  add constraint problem_solving_action_context_countermeasure_fkey
  foreign key (organisation_id, countermeasure_id)
  references public.problem_solving_countermeasures(organisation_id, id)
  on delete restrict;

-- Triggers

create trigger problem_solving_countermeasures_touch_updated_at
before update on public.problem_solving_countermeasures
for each row execute function private.touch_updated_at();

create trigger problem_solving_countermeasures_prevent_org_change
before update on public.problem_solving_countermeasures
for each row execute function private.prevent_organisation_id_change();

create trigger ps_cm_cause_links_prevent_org_change
before update on public.problem_solving_countermeasure_cause_links
for each row execute function private.prevent_organisation_id_change();

-- Indexes

create index ps_countermeasures_case_idx
  on public.problem_solving_countermeasures (organisation_id, problem_solving_case_id, status);
create index ps_cm_cause_links_cm_idx
  on public.problem_solving_countermeasure_cause_links (organisation_id, countermeasure_id);
create index ps_cm_cause_links_hypothesis_idx
  on public.problem_solving_countermeasure_cause_links (organisation_id, hypothesis_id);

-- RLS

alter table public.problem_solving_countermeasures enable row level security;
alter table public.problem_solving_countermeasures force row level security;
alter table public.problem_solving_countermeasure_cause_links enable row level security;
alter table public.problem_solving_countermeasure_cause_links force row level security;

revoke all on public.problem_solving_countermeasures from public, anon, authenticated, service_role;
revoke all on public.problem_solving_countermeasure_cause_links from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_countermeasures to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_countermeasure_cause_links to lean_hub_private_owner;

create policy private_owner_all_ps_countermeasures
on public.problem_solving_countermeasures for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_ps_cm_cause_links
on public.problem_solving_countermeasure_cause_links for all to lean_hub_private_owner
using (true) with check (true);

-- Private lifecycle operations

create or replace function private.create_countermeasure(
  target_case_id uuid,
  target_title text,
  target_description text default null,
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
  case_row public.problem_solving_cases%rowtype;
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure creation is not authorised'
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

  if case_row.status <> 'active' then
    raise exception 'case is not in a state that accepts countermeasures'
      using errcode = '55000';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, target_case_id) then
    raise exception 'countermeasure creation is not authorised'
      using errcode = '42501';
  end if;

  insert into public.problem_solving_countermeasures (
    organisation_id,
    problem_solving_case_id,
    title,
    description,
    rationale,
    status,
    proposed_by_membership_id
  )
  values (
    org_id,
    target_case_id,
    btrim(target_title),
    target_description,
    target_rationale,
    'proposed',
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.countermeasure_created',
    target_case_id,
    'succeeded',
    jsonb_build_object('countermeasure_id', new_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    target_case_id,
    'ProblemSolvingCountermeasureCreated',
    new_id::text,
    jsonb_build_object(
      'case_id', target_case_id,
      'countermeasure_id', new_id
    )
  );

  return new_id;
end;
$$;

create or replace function private.select_countermeasure(
  target_countermeasure_id uuid,
  target_rationale text default null
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
  cm_row public.problem_solving_countermeasures%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure selection is not authorised'
      using errcode = '42501';
  end if;

  select cm.*
  into cm_row
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.id = target_countermeasure_id
  for update;

  if not found then
    raise exception 'countermeasure not found'
      using errcode = 'P0002';
  end if;

  if cm_row.status <> 'proposed' then
    raise exception 'countermeasure is not in proposed status'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, cm_row.problem_solving_case_id) then
    raise exception 'countermeasure selection is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_countermeasures cm_table
  set status = 'selected',
      selected_by_membership_id = actor_membership_id,
      selected_at = statement_timestamp(),
      selected_rationale = target_rationale,
      updated_at = statement_timestamp()
  where cm_table.organisation_id = org_id
    and cm_table.id = target_countermeasure_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.countermeasure_selected',
    cm_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object('countermeasure_id', target_countermeasure_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    cm_row.problem_solving_case_id,
    'ProblemSolvingCountermeasureSelected',
    target_countermeasure_id::text,
    jsonb_build_object(
      'case_id', cm_row.problem_solving_case_id,
      'countermeasure_id', target_countermeasure_id
    )
  );

  return true;
end;
$$;

create or replace function private.reject_countermeasure(
  target_countermeasure_id uuid,
  target_rationale text default null
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
  cm_row public.problem_solving_countermeasures%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure rejection is not authorised'
      using errcode = '42501';
  end if;

  select cm.*
  into cm_row
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.id = target_countermeasure_id
  for update;

  if not found then
    raise exception 'countermeasure not found'
      using errcode = 'P0002';
  end if;

  if cm_row.status <> 'proposed' then
    raise exception 'countermeasure is not in proposed status'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, cm_row.problem_solving_case_id) then
    raise exception 'countermeasure rejection is not authorised'
      using errcode = '42501';
  end if;

  update public.problem_solving_countermeasures cm_table
  set status = 'rejected',
      rejected_by_membership_id = actor_membership_id,
      rejected_at = statement_timestamp(),
      rejected_rationale = target_rationale,
      updated_at = statement_timestamp()
  where cm_table.organisation_id = org_id
    and cm_table.id = target_countermeasure_id;

  perform private.append_business_audit(
    org_id,
    'problem_solving.countermeasure_rejected',
    cm_row.problem_solving_case_id,
    'succeeded',
    jsonb_build_object('countermeasure_id', target_countermeasure_id)
  );

  perform private.enqueue_domain_event(
    org_id,
    cm_row.problem_solving_case_id,
    'ProblemSolvingCountermeasureRejected',
    target_countermeasure_id::text,
    jsonb_build_object(
      'case_id', cm_row.problem_solving_case_id,
      'countermeasure_id', target_countermeasure_id
    )
  );

  return true;
end;
$$;

create or replace function private.link_countermeasure_causes(
  target_countermeasure_id uuid,
  target_hypothesis_ids uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  cm_row public.problem_solving_countermeasures%rowtype;
  inserted_count integer := 0;
  current_hypothesis_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'countermeasure cause linking is not authorised'
      using errcode = '42501';
  end if;

  select cm.*
  into cm_row
  from public.problem_solving_countermeasures cm
  where cm.organisation_id = org_id
    and cm.id = target_countermeasure_id;

  if not found then
    raise exception 'countermeasure not found'
      using errcode = 'P0002';
  end if;

  if not private.can_contribute_problem_solving_case(org_id, cm_row.problem_solving_case_id) then
    raise exception 'countermeasure cause linking is not authorised'
      using errcode = '42501';
  end if;

  foreach current_hypothesis_id in array target_hypothesis_ids
  loop
    if not exists (
      select 1
      from public.problem_solving_hypotheses h
      where h.organisation_id = org_id
        and h.id = current_hypothesis_id
        and h.problem_solving_case_id = cm_row.problem_solving_case_id
    ) then
      raise exception 'hypothesis does not belong to the same case'
        using errcode = '22023';
    end if;

    insert into public.problem_solving_countermeasure_cause_links (
      organisation_id,
      countermeasure_id,
      hypothesis_id,
      created_by_membership_id
    )
    values (
      org_id,
      target_countermeasure_id,
      current_hypothesis_id,
      actor_membership_id
    )
    on conflict (organisation_id, countermeasure_id, hypothesis_id) do nothing;

    if found then
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return inserted_count;
end;
$$;

-- Authenticated read policies

grant select on public.problem_solving_countermeasures to authenticated;
grant select on public.problem_solving_countermeasure_cause_links to authenticated;

create policy ps_countermeasures_select
on public.problem_solving_countermeasures for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

create policy ps_cm_cause_links_select
on public.problem_solving_countermeasure_cause_links for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_countermeasures cm
    where cm.organisation_id = problem_solving_countermeasure_cause_links.organisation_id
      and cm.id = problem_solving_countermeasure_cause_links.countermeasure_id
      and private.can_read_problem_solving_case(cm.organisation_id, cm.problem_solving_case_id)
  )
);

-- Public RPC wrappers

create or replace function public.create_countermeasure(
  target_case_id uuid,
  target_title text,
  target_description text default null,
  target_rationale text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_countermeasure(
  target_case_id,
  target_title,
  target_description,
  target_rationale
) $$;

create or replace function public.select_countermeasure(
  target_countermeasure_id uuid,
  target_rationale text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.select_countermeasure(
  target_countermeasure_id,
  target_rationale
) $$;

create or replace function public.reject_countermeasure(
  target_countermeasure_id uuid,
  target_rationale text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.reject_countermeasure(
  target_countermeasure_id,
  target_rationale
) $$;

create or replace function public.link_countermeasure_causes(
  target_countermeasure_id uuid,
  target_hypothesis_ids uuid[]
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$ select private.link_countermeasure_causes(
  target_countermeasure_id,
  target_hypothesis_ids
) $$;

grant execute on function public.create_countermeasure(uuid, text, text, text) to authenticated;
grant execute on function public.select_countermeasure(uuid, text) to authenticated;
grant execute on function public.reject_countermeasure(uuid, text) to authenticated;
grant execute on function public.link_countermeasure_causes(uuid, uuid[]) to authenticated;

revoke all on function public.create_countermeasure(uuid, text, text, text) from public, anon;
revoke all on function public.select_countermeasure(uuid, text) from public, anon;
revoke all on function public.reject_countermeasure(uuid, text) from public, anon;
revoke all on function public.link_countermeasure_causes(uuid, uuid[]) from public, anon;

revoke all on function private.create_countermeasure(uuid, text, text, text) from public;
revoke all on function private.select_countermeasure(uuid, text) from public;
revoke all on function private.reject_countermeasure(uuid, text) from public;
revoke all on function private.link_countermeasure_causes(uuid, uuid[]) from public;

grant execute on function private.create_countermeasure(uuid, text, text, text) to lean_hub_private_owner;
grant execute on function private.select_countermeasure(uuid, text) to lean_hub_private_owner;
grant execute on function private.reject_countermeasure(uuid, text) to lean_hub_private_owner;
grant execute on function private.link_countermeasure_causes(uuid, uuid[]) to lean_hub_private_owner;

alter function private.create_countermeasure(uuid, text, text, text) owner to lean_hub_private_owner;
alter function private.select_countermeasure(uuid, text) owner to lean_hub_private_owner;
alter function private.reject_countermeasure(uuid, text) owner to lean_hub_private_owner;
alter function private.link_countermeasure_causes(uuid, uuid[]) owner to lean_hub_private_owner;
