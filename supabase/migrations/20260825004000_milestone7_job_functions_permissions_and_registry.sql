insert into public.permission_definitions (permission_key, description, is_protected)
values
  ('job_functions.read', 'Read organisation job functions and assignments within authorised scope.', false),
  ('job_functions.manage', 'Create, edit, and deactivate job functions and manage assignments.', false),
  ('people.capability.read', 'Read people capability profiles, directories, and matrices within authorised scope.', false)
on conflict (permission_key) do nothing;

select private.system_upgrade_owner_role_permissions(
  array[
    'job_functions.read',
    'job_functions.manage',
    'people.capability.read'
  ]::text[]
);
