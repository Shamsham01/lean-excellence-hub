-- Milestone 11: cause analyses (five-whys, fishbone, cause tree, brainstorm), analysis nodes, cycle prevention.

-- ──────────────────────────────────────────────────────────────
-- problem_solving_analyses
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_analyses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  problem_solving_case_id uuid not null,
  analysis_type text not null,
  title text not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_analyses_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_analyses_case_fkey
    foreign key (organisation_id, problem_solving_case_id)
    references public.problem_solving_cases(organisation_id, id)
    on delete restrict,
  constraint problem_solving_analyses_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_analyses_title_check
    check (title = btrim(title) and char_length(title) between 1 and 200),
  constraint problem_solving_analyses_type_check
    check (analysis_type in ('five_whys', 'fishbone', 'cause_tree', 'brainstorm'))
);

-- ──────────────────────────────────────────────────────────────
-- problem_solving_analysis_nodes
-- ──────────────────────────────────────────────────────────────

create table public.problem_solving_analysis_nodes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  analysis_id uuid not null,
  parent_node_id uuid,
  linked_hypothesis_id uuid,
  category text,
  label text not null,
  sort_order integer not null default 0,
  display_metadata jsonb not null default '{}'::jsonb,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint problem_solving_analysis_nodes_organisation_id_id_key
    unique (organisation_id, id),
  constraint problem_solving_analysis_nodes_analysis_fkey
    foreign key (organisation_id, analysis_id)
    references public.problem_solving_analyses(organisation_id, id)
    on delete restrict,
  constraint problem_solving_analysis_nodes_parent_fkey
    foreign key (organisation_id, parent_node_id)
    references public.problem_solving_analysis_nodes(organisation_id, id)
    on delete restrict,
  constraint problem_solving_analysis_nodes_hypothesis_fkey
    foreign key (organisation_id, linked_hypothesis_id)
    references public.problem_solving_hypotheses(organisation_id, id)
    on delete restrict,
  constraint problem_solving_analysis_nodes_creator_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint problem_solving_analysis_nodes_label_check
    check (label = btrim(label) and char_length(label) between 1 and 500),
  constraint problem_solving_analysis_nodes_category_check
    check (category is null or char_length(category) <= 200),
  constraint problem_solving_analysis_nodes_display_metadata_check
    check (jsonb_typeof(display_metadata) = 'object')
);

-- ──────────────────────────────────────────────────────────────
-- Cycle prevention trigger
-- ──────────────────────────────────────────────────────────────

create or replace function private.prevent_analysis_node_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_parent uuid;
  depth integer := 0;
  max_depth integer := 100;
begin
  if new.parent_node_id is null then
    return new;
  end if;

  if new.parent_node_id = new.id then
    raise exception 'analysis node cannot be its own parent'
      using errcode = '23514';
  end if;

  current_parent := new.parent_node_id;
  while current_parent is not null and depth < max_depth loop
    select node.parent_node_id
    into current_parent
    from public.problem_solving_analysis_nodes node
    where node.id = current_parent
      and node.organisation_id = new.organisation_id;

    if current_parent = new.id then
      raise exception 'cycle detected in analysis node hierarchy'
        using errcode = '23514';
    end if;

    depth := depth + 1;
  end loop;

  if depth >= max_depth then
    raise exception 'analysis node hierarchy exceeds maximum depth'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger problem_solving_analysis_nodes_prevent_cycle
before insert or update of parent_node_id on public.problem_solving_analysis_nodes
for each row execute function private.prevent_analysis_node_cycle();

-- ──────────────────────────────────────────────────────────────
-- Triggers
-- ──────────────────────────────────────────────────────────────

create trigger problem_solving_analyses_touch_updated_at
before update on public.problem_solving_analyses
for each row execute function private.touch_updated_at();

create trigger problem_solving_analyses_prevent_org_change
before update on public.problem_solving_analyses
for each row execute function private.prevent_organisation_id_change();

create trigger problem_solving_analysis_nodes_touch_updated_at
before update on public.problem_solving_analysis_nodes
for each row execute function private.touch_updated_at();

create trigger problem_solving_analysis_nodes_prevent_org_change
before update on public.problem_solving_analysis_nodes
for each row execute function private.prevent_organisation_id_change();

-- ──────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────

create index problem_solving_analyses_case_idx
  on public.problem_solving_analyses (organisation_id, problem_solving_case_id);
create index problem_solving_analysis_nodes_analysis_idx
  on public.problem_solving_analysis_nodes (organisation_id, analysis_id);
create index problem_solving_analysis_nodes_parent_idx
  on public.problem_solving_analysis_nodes (organisation_id, parent_node_id)
  where parent_node_id is not null;
create index problem_solving_analysis_nodes_hypothesis_idx
  on public.problem_solving_analysis_nodes (organisation_id, linked_hypothesis_id)
  where linked_hypothesis_id is not null;

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

alter table public.problem_solving_analyses enable row level security;
alter table public.problem_solving_analyses force row level security;
alter table public.problem_solving_analysis_nodes enable row level security;
alter table public.problem_solving_analysis_nodes force row level security;

revoke all on public.problem_solving_analyses from public, anon, authenticated, service_role;
revoke all on public.problem_solving_analysis_nodes from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.problem_solving_analyses to lean_hub_private_owner;
grant select, insert, update, delete on public.problem_solving_analysis_nodes to lean_hub_private_owner;

create policy private_owner_all_problem_solving_analyses
on public.problem_solving_analyses for all to lean_hub_private_owner
using (true) with check (true);

create policy private_owner_all_problem_solving_analysis_nodes
on public.problem_solving_analysis_nodes for all to lean_hub_private_owner
using (true) with check (true);

-- ──────────────────────────────────────────────────────────────
-- RPCs – create_analysis
-- ──────────────────────────────────────────────────────────────

create or replace function private.create_analysis(
  target_problem_solving_case_id uuid,
  target_analysis_type text,
  target_title text
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
    raise exception 'analysis creation is not authorised'
      using errcode = '42501';
  end if;

  if target_analysis_type not in ('five_whys', 'fishbone', 'cause_tree', 'brainstorm') then
    raise exception 'invalid analysis type'
      using errcode = '22023';
  end if;

  insert into public.problem_solving_analyses (
    organisation_id,
    problem_solving_case_id,
    analysis_type,
    title,
    created_by_membership_id
  )
  values (
    org_id,
    target_problem_solving_case_id,
    target_analysis_type,
    btrim(target_title),
    actor_membership_id
  )
  returning id into new_id;

  perform private.append_business_audit(
    org_id,
    'analysis.created',
    target_problem_solving_case_id,
    'succeeded',
    jsonb_build_object(
      'analysis_id', new_id,
      'case_id', target_problem_solving_case_id,
      'analysis_type', target_analysis_type
    )
  );

  perform private.enqueue_domain_event(
    org_id,
    target_problem_solving_case_id,
    'AnalysisCreated',
    new_id::text,
    jsonb_build_object(
      'analysis_id', new_id,
      'case_id', target_problem_solving_case_id,
      'analysis_type', target_analysis_type
    )
  );

  return new_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – add_analysis_node
-- ──────────────────────────────────────────────────────────────

create or replace function private.add_analysis_node(
  target_analysis_id uuid,
  target_label text,
  target_parent_node_id uuid default null,
  target_category text default null,
  target_sort_order integer default 0,
  target_display_metadata jsonb default '{}'::jsonb
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
  new_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'analysis node creation is not authorised'
      using errcode = '42501';
  end if;

  select a.*
  into analysis_row
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = target_analysis_id;

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

  if target_parent_node_id is not null then
    if not exists (
      select 1
      from public.problem_solving_analysis_nodes n
      where n.organisation_id = org_id
        and n.id = target_parent_node_id
        and n.analysis_id = target_analysis_id
    ) then
      raise exception 'parent node not found in the same analysis'
        using errcode = 'P0002';
    end if;
  end if;

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

  return new_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPCs – link_node_hypothesis
-- ──────────────────────────────────────────────────────────────

create or replace function private.link_node_hypothesis(
  target_node_id uuid,
  target_hypothesis_id uuid
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  hypothesis_case_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'node-hypothesis linking is not authorised'
      using errcode = '42501';
  end if;

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id
  into analysis_case_id
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'node-hypothesis linking is not authorised'
      using errcode = '42501';
  end if;

  select h.problem_solving_case_id
  into hypothesis_case_id
  from public.problem_solving_hypotheses h
  where h.organisation_id = org_id
    and h.id = target_hypothesis_id;

  if hypothesis_case_id is null then
    raise exception 'hypothesis not found'
      using errcode = 'P0002';
  end if;

  if analysis_case_id <> hypothesis_case_id then
    raise exception 'analysis node and hypothesis must belong to the same case'
      using errcode = '22023';
  end if;

  update public.problem_solving_analysis_nodes n
  set linked_hypothesis_id = target_hypothesis_id,
      updated_at           = statement_timestamp()
  where n.organisation_id = org_id
    and n.id = target_node_id;

  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- Authenticated RLS policies
-- ──────────────────────────────────────────────────────────────

grant select on public.problem_solving_analyses to authenticated;
grant select on public.problem_solving_analysis_nodes to authenticated;

create policy problem_solving_analyses_select
on public.problem_solving_analyses for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.can_read_problem_solving_case(organisation_id, problem_solving_case_id)
);

create policy problem_solving_analysis_nodes_select
on public.problem_solving_analysis_nodes for select to authenticated
using (
  organisation_id = private.current_organisation_id()
  and exists (
    select 1
    from public.problem_solving_analyses a
    where a.organisation_id = problem_solving_analysis_nodes.organisation_id
      and a.id = problem_solving_analysis_nodes.analysis_id
      and private.can_read_problem_solving_case(a.organisation_id, a.problem_solving_case_id)
  )
);

-- ──────────────────────────────────────────────────────────────
-- Public wrappers
-- ──────────────────────────────────────────────────────────────

create or replace function public.create_analysis(
  target_problem_solving_case_id uuid,
  target_analysis_type text,
  target_title text
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$ select private.create_analysis(
  target_problem_solving_case_id,
  target_analysis_type,
  target_title
) $$;

create or replace function public.add_analysis_node(
  target_analysis_id uuid,
  target_label text,
  target_parent_node_id uuid default null,
  target_category text default null,
  target_sort_order integer default 0,
  target_display_metadata jsonb default '{}'::jsonb
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
  target_display_metadata
) $$;

create or replace function public.link_node_hypothesis(
  target_node_id uuid,
  target_hypothesis_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$ select private.link_node_hypothesis(
  target_node_id,
  target_hypothesis_id
) $$;

-- ──────────────────────────────────────────────────────────────
-- Grants
-- ──────────────────────────────────────────────────────────────

grant execute on function public.create_analysis(uuid, text, text) to authenticated;
grant execute on function public.add_analysis_node(uuid, text, uuid, text, integer, jsonb) to authenticated;
grant execute on function public.link_node_hypothesis(uuid, uuid) to authenticated;

revoke all on function public.create_analysis(uuid, text, text) from public, anon;
revoke all on function public.add_analysis_node(uuid, text, uuid, text, integer, jsonb) from public, anon;
revoke all on function public.link_node_hypothesis(uuid, uuid) from public, anon;

revoke all on function private.create_analysis(uuid, text, text) from public;
revoke all on function private.add_analysis_node(uuid, text, uuid, text, integer, jsonb) from public;
revoke all on function private.link_node_hypothesis(uuid, uuid) from public;
revoke all on function private.prevent_analysis_node_cycle() from public;

grant execute on function private.create_analysis(uuid, text, text) to lean_hub_private_owner;
grant execute on function private.add_analysis_node(uuid, text, uuid, text, integer, jsonb) to lean_hub_private_owner;
grant execute on function private.link_node_hypothesis(uuid, uuid) to lean_hub_private_owner;

-- ──────────────────────────────────────────────────────────────
-- Function ownership
-- ──────────────────────────────────────────────────────────────

alter function private.prevent_analysis_node_cycle()
  owner to lean_hub_private_owner;
alter function private.create_analysis(uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.add_analysis_node(uuid, text, uuid, text, integer, jsonb)
  owner to lean_hub_private_owner;
alter function private.link_node_hypothesis(uuid, uuid)
  owner to lean_hub_private_owner;
