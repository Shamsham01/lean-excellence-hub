create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_organisation_id()
$$;

create or replace function public.has_scoped_permission(
  target_organisation_id uuid,
  target_permission_key text,
  target_membership_id uuid default null,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    target_permission_key,
    target_membership_id,
    target_unit_id
  )
$$;

grant execute on function public.current_organisation_id() to authenticated;
grant execute on function public.has_scoped_permission(uuid, text, uuid, uuid)
  to authenticated;
