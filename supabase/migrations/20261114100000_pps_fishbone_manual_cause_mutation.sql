-- Manual fishbone cause edit/remove and atomic promote RPCs for problem-solving root cause analysis.

create or replace function private.update_analysis_node(
  target_node_id uuid,
  target_label text
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
  analysis_type text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'analysis node update is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  if btrim(coalesce(target_label, '')) = '' then
    raise exception 'cause label is required'
      using errcode = '22023';
  end if;

  if char_length(btrim(target_label)) > 500 then
    raise exception 'cause label must be 500 characters or fewer'
      using errcode = '22023';
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

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be changed here'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'analysis node update is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id is not null then
    raise exception 'promoted fishbone causes cannot be changed; edit the hypothesis instead'
      using errcode = '55000';
  end if;

  update public.problem_solving_analysis_nodes n
  set label = btrim(target_label)
  where n.organisation_id = org_id
    and n.id = target_node_id;

  return true;
end;
$$;

create or replace function private.delete_analysis_node(
  target_node_id uuid
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
  analysis_type text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'analysis node deletion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be changed here'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'analysis node deletion is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id is not null then
    raise exception 'promoted fishbone causes cannot be removed; edit the hypothesis instead'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.problem_solving_analysis_nodes child
    where child.organisation_id = org_id
      and child.parent_node_id = target_node_id
  ) then
    raise exception 'remove child causes before deleting this node'
      using errcode = '55000';
  end if;

  delete from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id;

  return true;
end;
$$;

create or replace function private.promote_analysis_node_to_hypothesis(
  target_node_id uuid,
  target_statement text default null,
  target_category text default null
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
  node_row public.problem_solving_analysis_nodes%rowtype;
  analysis_case_id uuid;
  analysis_type text;
  statement_text text;
  category_text text;
  new_hypothesis_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'hypothesis promotion is not authorised'
      using errcode = '42501';
  end if;

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id
  for update;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  select a.problem_solving_case_id, a.analysis_type
  into analysis_case_id, analysis_type
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if analysis_type is distinct from 'fishbone' then
    raise exception 'only fishbone causes can be promoted to a hypothesis'
      using errcode = '55000';
  end if;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'hypothesis promotion is not authorised'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.problem_solving_cases c
    where c.organisation_id = org_id
      and c.id = analysis_case_id
      and c.status in ('closed', 'cancelled')
  ) then
    raise exception 'case is closed; analysis cannot be changed'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id is not null then
    raise exception 'this cause is already promoted to a hypothesis'
      using errcode = '55000';
  end if;

  statement_text := btrim(coalesce(target_statement, node_row.label));
  if statement_text = '' then
    raise exception 'hypothesis statement is required'
      using errcode = '22023';
  end if;

  category_text := nullif(btrim(coalesce(target_category, node_row.category)), '');

  new_hypothesis_id := private.create_hypothesis(
    analysis_case_id,
    statement_text,
    null,
    category_text,
    null
  );

  update public.problem_solving_analysis_nodes n
  set linked_hypothesis_id = new_hypothesis_id,
      updated_at           = statement_timestamp()
  where n.organisation_id = org_id
    and n.id = target_node_id;

  return new_hypothesis_id;
end;
$$;

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

  perform private.assert_current_organisation_module_entitled('problem_solving');

  select n.*
  into node_row
  from public.problem_solving_analysis_nodes n
  where n.organisation_id = org_id
    and n.id = target_node_id;

  if not found then
    raise exception 'analysis node not found'
      using errcode = 'P0002';
  end if;

  if node_row.linked_hypothesis_id is not null
     and node_row.linked_hypothesis_id is distinct from target_hypothesis_id then
    raise exception 'fishbone cause already has a different linked hypothesis'
      using errcode = '55000';
  end if;

  if node_row.linked_hypothesis_id = target_hypothesis_id then
    return true;
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

create or replace function public.update_analysis_node(
  target_node_id uuid,
  target_label text
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_analysis_node(target_node_id, target_label)
$$;

create or replace function public.delete_analysis_node(target_node_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.delete_analysis_node(target_node_id)
$$;

create or replace function public.promote_analysis_node_to_hypothesis(
  target_node_id uuid,
  target_statement text default null,
  target_category text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.promote_analysis_node_to_hypothesis(
    target_node_id,
    target_statement,
    target_category
  )
$$;

grant execute on function public.update_analysis_node(uuid, text) to authenticated;
grant execute on function public.delete_analysis_node(uuid) to authenticated;
grant execute on function public.promote_analysis_node_to_hypothesis(uuid, text, text) to authenticated;

revoke all on function public.update_analysis_node(uuid, text) from public, anon;
revoke all on function public.delete_analysis_node(uuid) from public, anon;
revoke all on function public.promote_analysis_node_to_hypothesis(uuid, text, text) from public, anon;

revoke all on function private.update_analysis_node(uuid, text) from public;
revoke all on function private.delete_analysis_node(uuid) from public;
revoke all on function private.promote_analysis_node_to_hypothesis(uuid, text, text) from public;

grant execute on function private.update_analysis_node(uuid, text) to lean_hub_private_owner;
grant execute on function private.delete_analysis_node(uuid) to lean_hub_private_owner;
grant execute on function private.promote_analysis_node_to_hypothesis(uuid, text, text) to lean_hub_private_owner;

alter function private.update_analysis_node(uuid, text) owner to lean_hub_private_owner;
alter function private.delete_analysis_node(uuid) owner to lean_hub_private_owner;
alter function private.promote_analysis_node_to_hypothesis(uuid, text, text) owner to lean_hub_private_owner;
alter function private.link_node_hypothesis(uuid, uuid) owner to lean_hub_private_owner;