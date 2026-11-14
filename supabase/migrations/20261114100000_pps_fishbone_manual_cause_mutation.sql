-- Manual fishbone cause edit/remove RPCs for problem-solving root cause analysis.

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
    raise exception 'analysis node update is not authorised'
      using errcode = '42501';
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

  select a.problem_solving_case_id
  into analysis_case_id
  from public.problem_solving_analyses a
  where a.organisation_id = org_id
    and a.id = node_row.analysis_id;

  if not private.can_manage_problem_solving_case(org_id, analysis_case_id) then
    raise exception 'analysis node deletion is not authorised'
      using errcode = '42501';
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

grant execute on function public.update_analysis_node(uuid, text) to authenticated;
grant execute on function public.delete_analysis_node(uuid) to authenticated;

revoke all on function public.update_analysis_node(uuid, text) from public, anon;
revoke all on function public.delete_analysis_node(uuid) from public, anon;

revoke all on function private.update_analysis_node(uuid, text) from public;
revoke all on function private.delete_analysis_node(uuid) from public;

grant execute on function private.update_analysis_node(uuid, text) to lean_hub_private_owner;
grant execute on function private.delete_analysis_node(uuid) to lean_hub_private_owner;

alter function private.update_analysis_node(uuid, text) owner to lean_hub_private_owner;
alter function private.delete_analysis_node(uuid) owner to lean_hub_private_owner;