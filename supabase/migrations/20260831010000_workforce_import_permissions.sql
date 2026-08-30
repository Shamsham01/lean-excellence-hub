-- M2 workforce bulk import permission (Owner + Organisation Administrator only).

insert into public.permission_definitions (permission_key, description, is_protected)
values
  (
    'workforce.import',
    'Bulk import workforce users from CSV or XLSX files.',
    false
  )
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array['workforce.import']::text[]
);

select private.system_upgrade_role_permissions_by_canonical_name(
  'organisation-administrator',
  array['workforce.import']::text[]
);

create or replace function private.ensure_organisation_baseline_application_roles(
  target_organisation_id uuid,
  actor_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.ensure_organisation_baseline_application_roles$m1(
    target_organisation_id,
    actor_membership_id
  );

  perform private.ensure_baseline_role_permissions(
    target_organisation_id,
    'organisation-administrator',
    array[
      'workforce.provision',
      'workforce.credentials.reset',
      'workforce.import'
    ]::text[]
  );
end;
$$;
