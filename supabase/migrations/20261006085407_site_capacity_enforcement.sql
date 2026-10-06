-- MULTISITE-EXPAND-01A: authoritative subscribed site capacity.
-- Active billable Sites cannot exceed paid site_quantity for organisations
-- with an enforceable subscription. Restore/reactivate and table writes are
-- guarded, not only Site create. Legacy / no-subscription orgs stay uncapped.
--
-- Do not apply this migration to hosted Supabase from this change.

create or replace function private.assert_organisation_can_add_site(
  target_organisation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  paid_limit integer;
  current_count integer;
begin
  paid_limit := private.organisation_paid_site_limit(target_organisation_id);
  if paid_limit is null then
    return;
  end if;

  current_count := private.count_active_billable_sites(target_organisation_id);
  if current_count >= paid_limit then
    raise exception 'site quantity is already at the paid subscription limit'
      using
        errcode = 'P0001',
        detail = 'SITE_CAPACITY_EXHAUSTED',
        hint = 'Increase subscribed site quantity before activating another site';
  end if;
end;
$$;

create or replace function private.enforce_organisation_unit_site_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_is_active_site boolean;
  old_is_active_site boolean := false;
begin
  new_is_active_site :=
    new.status = 'active'
    and private.normalise_organisation_unit_semantic_scope(new.unit_type) = 'site';

  if tg_op = 'UPDATE' then
    old_is_active_site :=
      old.status = 'active'
      and private.normalise_organisation_unit_semantic_scope(old.unit_type) = 'site';
  end if;

  if new_is_active_site and not old_is_active_site then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.organisation_id::text, 0)
    );
    perform private.assert_organisation_can_add_site(new.organisation_id);
  end if;

  return new;
end;
$$;

drop trigger if exists organisation_units_enforce_site_capacity
  on public.organisation_units;

create trigger organisation_units_enforce_site_capacity
before insert or update of status, unit_type
on public.organisation_units
for each row
execute function private.enforce_organisation_unit_site_capacity();

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
  current_unit public.organisation_units%rowtype;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_organisation_id::text, 0)
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

  if target_status = 'active' then
    select *
    into current_unit
    from public.organisation_units unit_row
    where unit_row.organisation_id = target_organisation_id
      and unit_row.id = target_unit_id
    for update;

    if found
      and current_unit.status is distinct from 'active'
      and private.normalise_organisation_unit_semantic_scope(
        current_unit.unit_type
      ) = 'site' then
      perform private.assert_organisation_can_add_site(target_organisation_id);
    end if;
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

alter function private.assert_organisation_can_add_site(uuid)
  owner to lean_hub_private_owner;
alter function private.enforce_organisation_unit_site_capacity()
  owner to lean_hub_private_owner;
alter function private.set_organisation_unit_status(uuid, uuid, text, text)
  owner to lean_hub_private_owner;

revoke all on function private.assert_organisation_can_add_site(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_organisation_unit_site_capacity()
  from public, anon, authenticated, service_role;
revoke all on function private.set_organisation_unit_status(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function private.set_organisation_unit_status(
  uuid, uuid, text, text
) to authenticated, lean_hub_private_owner;
grant execute on function private.assert_organisation_can_add_site(uuid)
  to lean_hub_private_owner;
grant execute on function private.enforce_organisation_unit_site_capacity()
  to lean_hub_private_owner;
