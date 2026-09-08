-- Organisation Structure V2 lifecycle (Issue #57 PR3)
-- Extends existing hierarchy RPCs with safe edit/archive rules.

create or replace function private.update_organisation_unit(
  target_organisation_id uuid,
  target_unit_id uuid,
  unit_name text,
  unit_type text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_unit public.organisation_units%rowtype;
  trimmed_name text := btrim(unit_name);
  trimmed_type text := btrim(unit_type);
begin
  if private.current_membership_id(target_organisation_id) is null
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_unit_id
    ) then
    raise exception 'unit update is not authorised'
      using errcode = '42501';
  end if;

  if trimmed_name is null
    or char_length(trimmed_name) < 1
    or char_length(trimmed_name) > 160
    or trimmed_type is null
    or char_length(trimmed_type) < 1
    or char_length(trimmed_type) > 80 then
    raise exception 'unit details are invalid'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  select *
  into current_unit
  from public.organisation_units unit_row
  where unit_row.organisation_id = target_organisation_id
    and unit_row.id = target_unit_id
    and unit_row.status = 'active'
  for update;

  if not found then
    raise exception 'unit is not active in organisation'
      using errcode = '23514';
  end if;

  if trimmed_type is distinct from current_unit.unit_type then
    if private.organisation_requires_site_boundary(target_organisation_id)
      and private.normalise_organisation_unit_semantic_scope(trimmed_type) = 'site'
      and current_unit.parent_unit_id is not null
      and private.resolve_site_unit_id(
        target_organisation_id,
        current_unit.parent_unit_id
      ) is not null then
      raise exception 'nested site units are not permitted'
        using errcode = '23514';
    end if;

    if private.organisation_requires_site_boundary(target_organisation_id)
      and private.normalise_organisation_unit_semantic_scope(
        current_unit.unit_type
      ) = 'site'
      and private.resolve_site_unit_id(
        target_organisation_id,
        current_unit.id
      ) = current_unit.id
      and exists (
        select 1
        from public.organisation_unit_closure closure
        join public.organisation_units descendant
          on descendant.organisation_id = closure.organisation_id
         and descendant.id = closure.descendant_unit_id
        where closure.organisation_id = target_organisation_id
          and closure.ancestor_unit_id = current_unit.id
          and closure.depth > 0
          and descendant.status = 'active'
      ) then
      raise exception 'site unit type cannot change while active descendants exist'
        using errcode = '23514';
    end if;
  end if;

  update public.organisation_units
  set name = trimmed_name,
      unit_type = trimmed_type,
      version = version + 1
  where organisation_id = target_organisation_id
    and id = target_unit_id;

  perform private.append_security_audit(
    target_organisation_id,
    'hierarchy.unit_updated',
    'unit',
    target_unit_id,
    'succeeded',
    jsonb_build_object(
      'name', trimmed_name,
      'unit_type', trimmed_type
    )
  );

  return true;
end;
$$;

create or replace function private.set_organisation_unit_status(
  target_organisation_id uuid,
  target_unit_id uuid,
  target_status text,
  change_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_membership_id uuid :=
    private.current_membership_id(target_organisation_id);
  trimmed_reason text := btrim(change_reason);
begin
  if actor_membership_id is null
    or target_status not in ('active', 'retired')
    or not private.has_scoped_permission(
      target_organisation_id,
      'hierarchy.manage',
      null,
      target_unit_id
    ) then
    raise exception 'unit lifecycle change is not authorised'
      using errcode = '42501';
  end if;

  if target_status = 'retired'
    and (
      trimmed_reason is null
      or char_length(trimmed_reason) < 1
      or char_length(trimmed_reason) > 1000
    ) then
    raise exception 'retirement reason is required'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organisation_id::text, 0)
  );

  if target_status = 'retired' and exists (
    select 1
    from public.organisation_unit_closure closure
    join public.organisation_units descendant
      on descendant.organisation_id = closure.organisation_id
     and descendant.id = closure.descendant_unit_id
    where closure.organisation_id = target_organisation_id
      and closure.ancestor_unit_id = target_unit_id
      and closure.depth > 0
      and descendant.status = 'active'
  ) then
    raise exception 'active descendants must be retired first'
      using errcode = '23514';
  end if;

  if target_status = 'retired' and exists (
    select 1
    from public.membership_job_function_assignments assignment_row
    where assignment_row.organisation_id = target_organisation_id
      and assignment_row.organisational_unit_id = target_unit_id
      and assignment_row.valid_from <= statement_timestamp()
      and (
        assignment_row.valid_to is null
        or assignment_row.valid_to > statement_timestamp()
      )
  ) then
    raise exception 'active membership placements must be moved before retirement'
      using errcode = '23514';
  end if;

  if target_status = 'retired' and exists (
    select 1
    from public.access_grants grant_row
    where grant_row.organisation_id = target_organisation_id
      and grant_row.scope_type = 'unit_subtree'
      and grant_row.scope_unit_id = target_unit_id
      and grant_row.status = 'active'
  ) then
    raise exception 'active scoped grants must be revoked before retirement'
      using errcode = '23514';
  end if;

  if target_status = 'active' and exists (
    select 1
    from public.organisation_units unit_row
    join public.organisation_units parent_unit
      on parent_unit.organisation_id = unit_row.organisation_id
     and parent_unit.id = unit_row.parent_unit_id
    where unit_row.organisation_id = target_organisation_id
      and unit_row.id = target_unit_id
      and parent_unit.status <> 'active'
  ) then
    raise exception 'unit cannot be restored beneath a retired parent'
      using errcode = '23514';
  end if;

  update public.organisation_units
  set status = target_status,
      retired_at = case when target_status = 'retired'
        then statement_timestamp() else null end,
      restored_at = case when target_status = 'active'
        then statement_timestamp() else restored_at end,
      status_changed_by_membership_id = actor_membership_id,
      status_reason = case when target_status = 'retired'
        then trimmed_reason else null end,
      version = version + 1
  where organisation_id = target_organisation_id
    and id = target_unit_id;

  if not found then
    raise exception 'unit does not exist'
      using errcode = '23503';
  end if;

  perform private.append_security_audit(
    target_organisation_id,
    case when target_status = 'retired'
      then 'hierarchy.unit_retired'
      else 'hierarchy.unit_restored'
    end,
    'unit',
    target_unit_id,
    'succeeded',
    '{}'::jsonb
  );

  return true;
end;
$$;

create or replace function public.update_organisation_unit(
  target_organisation_id uuid,
  target_unit_id uuid,
  unit_name text,
  unit_type text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.update_organisation_unit(
    target_organisation_id,
    target_unit_id,
    unit_name,
    unit_type
  )
$$;

alter function private.update_organisation_unit(uuid, uuid, text, text)
  owner to lean_hub_private_owner;
alter function private.set_organisation_unit_status(uuid, uuid, text, text)
  owner to lean_hub_private_owner;

revoke all on function private.update_organisation_unit(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.update_organisation_unit(uuid, uuid, text, text)
  to authenticated;

revoke all on function public.update_organisation_unit(uuid, uuid, text, text)
  from public, anon;
grant execute on function public.update_organisation_unit(uuid, uuid, text, text)
  to authenticated;

-- Scoped hierarchy managers must enumerate units within their granted subtree
-- without requiring organisation-wide hierarchy.read or a home-site placement.
drop policy if exists units_select_scoped on public.organisation_units;
create policy units_select_scoped
on public.organisation_units
for select
to authenticated
using (
  organisation_id = (select private.current_organisation_id())
  and (
    private.has_scoped_permission(
      organisation_id,
      'hierarchy.read',
      null,
      id
    )
    or (
      private.has_scoped_permission(
        organisation_id,
        'maturity.assess.self',
        private.current_membership_id(organisation_id),
        null
      )
      and (
        not private.organisation_requires_site_boundary(organisation_id)
        or private.membership_can_access_unit_site(
          organisation_id,
          private.current_membership_id(organisation_id),
          id
        )
      )
    )
  )
  and (
    not private.organisation_requires_site_boundary(organisation_id)
    or private.has_scoped_permission(
      organisation_id,
      'hierarchy.read',
      null,
      id
    )
    or private.has_scoped_permission(
      organisation_id,
      'hierarchy.manage',
      null,
      id
    )
    or private.membership_can_access_unit_site(
      organisation_id,
      private.current_membership_id(organisation_id),
      id
    )
    or private.membership_has_scoped_permission(
      private.current_membership_id(organisation_id),
      organisation_id,
      'hierarchy.read',
      null,
      null
    )
    or private.membership_has_scoped_permission(
      private.current_membership_id(organisation_id),
      organisation_id,
      'memberships.manage',
      null,
      null
    )
  )
);
