-- M2 hotfix: derive import access scope from authoritative role grant-scope policy.

create or replace function private.role_version_permitted_scope_types(
  target_organisation_id uuid,
  target_role_version_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select array_agg(policy_row.scope_type order by policy_row.scope_type)
      from public.role_grant_scope_policies policy_row
      join public.role_versions role_version
        on role_version.organisation_id = policy_row.organisation_id
       and role_version.role_id = policy_row.role_id
      where role_version.organisation_id = target_organisation_id
        and role_version.id = target_role_version_id
    ),
    array[]::text[]
  )
$$;

create or replace function private.validate_workforce_import_row_payload(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_payload jsonb,
  out row_status text,
  out resolved jsonb,
  out field_errors jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  first_name text := btrim(coalesce(target_payload ->> 'first_name', ''));
  last_name text := btrim(coalesce(target_payload ->> 'last_name', ''));
  username text := lower(btrim(coalesce(target_payload ->> 'username', '')));
  notification_email text := lower(btrim(coalesce(target_payload ->> 'notification_email', '')));
  job_title text := btrim(coalesce(target_payload ->> 'job_title', ''));
  job_function_name text := btrim(coalesce(target_payload ->> 'job_function', ''));
  primary_unit_path text := btrim(coalesce(target_payload ->> 'primary_unit_path', ''));
  application_role text := btrim(coalesce(target_payload ->> 'application_role', ''));
  access_scope_path text := btrim(coalesce(target_payload ->> 'access_scope_unit_path', ''));
  errors jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  job_function_id uuid;
  job_function_status text;
  job_function_message text;
  primary_unit_id uuid;
  primary_unit_status text;
  primary_unit_message text;
  primary_unit_suggestion text;
  role_version_id uuid;
  role_status text;
  role_message text;
  scope_unit_id uuid;
  scope_unit_status text;
  scope_unit_message text;
  scope_unit_suggestion text;
  scope_type text;
  allowed_scopes text[];
  allows_organisation_scope boolean;
  allows_unit_subtree_scope boolean;
  display_name text;
begin
  row_status := 'valid';
  resolved := '{}'::jsonb;
  field_errors := '[]'::jsonb;

  if first_name = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'first_name',
        'issue', 'First name is required.',
        'suggestion', 'Provide the employee first name.'
      )
    );
  end if;

  if last_name = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'last_name',
        'issue', 'Last name is required.',
        'suggestion', 'Provide the employee last name.'
      )
    );
  end if;

  if username = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'username',
        'issue', 'Username is required.',
        'suggestion', 'Provide a unique workforce username.'
      )
    );
  elsif username !~ '^[a-z0-9][a-z0-9._-]{0,127}$' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'username',
        'issue', 'Username format is invalid.',
        'suggestion', 'Use lowercase letters, numbers, dots, underscores, or hyphens.'
      )
    );
  elsif not private.workforce_alias_is_available(target_organisation_id, username) then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'username',
        'issue', format('Username ''%s'' already exists.', username),
        'suggestion', 'Choose another username.'
      )
    );
  end if;

  if notification_email <> ''
    and notification_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'notification_email',
        'issue', 'Notification email format is invalid.',
        'suggestion', 'Provide a valid email address or leave blank.'
      )
    );
  end if;

  select
    resolved_job_function_id,
    resolution_status,
    resolution_message
  into job_function_id, job_function_status, job_function_message
  from private.resolve_job_function_by_name(target_organisation_id, job_function_name);

  if job_function_status <> 'resolved' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'job_function',
        'issue', coalesce(job_function_message, 'Job function could not be resolved.'),
        'suggestion', 'Use an exact active job function name from your organisation.'
      )
    );
  end if;

  select
    resolved_unit_id,
    resolution_status,
    resolution_message,
    resolution_suggestion
  into primary_unit_id, primary_unit_status, primary_unit_message, primary_unit_suggestion
  from private.resolve_organisation_unit_path(target_organisation_id, primary_unit_path);

  if primary_unit_status <> 'resolved' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'primary_unit_path',
        'issue', coalesce(primary_unit_message, 'Primary work area could not be resolved.'),
        'suggestion', coalesce(
          primary_unit_suggestion,
          'Use the full organisational path from the root site.'
        )
      )
    );
  end if;

  select
    resolved_role_version_id,
    resolution_status,
    resolution_message
  into role_version_id, role_status, role_message
  from private.resolve_role_version_by_display_name(target_organisation_id, application_role);

  if role_status <> 'resolved' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'application_role',
        'issue', coalesce(role_message, 'Application role could not be resolved.'),
        'suggestion', 'Use an exact published application role name.'
      )
    );
  end if;

  if role_version_id is not null then
    allowed_scopes := private.role_version_permitted_scope_types(
      target_organisation_id,
      role_version_id
    );
    allows_organisation_scope := 'organisation' = any(allowed_scopes);
    allows_unit_subtree_scope := 'unit_subtree' = any(allowed_scopes);

    if coalesce(array_length(allowed_scopes, 1), 0) = 0 then
      if access_scope_path = '' then
        scope_type := 'organisation';
        scope_unit_id := null;
      else
        select
          resolved_unit_id,
          resolution_status,
          resolution_message,
          resolution_suggestion
        into scope_unit_id, scope_unit_status, scope_unit_message, scope_unit_suggestion
        from private.resolve_organisation_unit_path(target_organisation_id, access_scope_path);

        if scope_unit_status <> 'resolved' then
          errors := errors || jsonb_build_array(
            jsonb_build_object(
              'field', 'access_scope_unit_path',
              'issue', coalesce(scope_unit_message, 'Access scope could not be resolved.'),
              'suggestion', coalesce(
                scope_unit_suggestion,
                'Use the full organisational path from the root site.'
              )
            )
          );
        else
          scope_type := 'unit_subtree';
        end if;
      end if;
    elsif allows_organisation_scope and not allows_unit_subtree_scope then
      if access_scope_path <> '' then
        errors := errors || jsonb_build_array(
          jsonb_build_object(
            'field', 'access_scope_unit_path',
            'issue', format(
              '%s is an organisation-wide role. Leave access_scope_unit_path blank.',
              application_role
            ),
            'suggestion', 'Remove the access scope path for organisation-wide roles.'
          )
        );
      else
        scope_type := 'organisation';
        scope_unit_id := null;
      end if;
    elsif allows_unit_subtree_scope and not allows_organisation_scope then
      if access_scope_path = '' then
        errors := errors || jsonb_build_array(
          jsonb_build_object(
            'field', 'access_scope_unit_path',
            'issue', format(
              '%s requires an access scope. Provide the full organisational path.',
              application_role
            ),
            'suggestion', 'Provide the organisational unit path that defines access scope.'
          )
        );
      else
        select
          resolved_unit_id,
          resolution_status,
          resolution_message,
          resolution_suggestion
        into scope_unit_id, scope_unit_status, scope_unit_message, scope_unit_suggestion
        from private.resolve_organisation_unit_path(target_organisation_id, access_scope_path);

        if scope_unit_status <> 'resolved' then
          errors := errors || jsonb_build_array(
            jsonb_build_object(
              'field', 'access_scope_unit_path',
              'issue', coalesce(scope_unit_message, 'Access scope could not be resolved.'),
              'suggestion', coalesce(
                scope_unit_suggestion,
                'Use the full organisational path from the root site.'
              )
            )
          );
        else
          scope_type := 'unit_subtree';
        end if;
      end if;
    elsif allows_organisation_scope and allows_unit_subtree_scope then
      if access_scope_path = '' then
        scope_type := 'organisation';
        scope_unit_id := null;
      else
        select
          resolved_unit_id,
          resolution_status,
          resolution_message,
          resolution_suggestion
        into scope_unit_id, scope_unit_status, scope_unit_message, scope_unit_suggestion
        from private.resolve_organisation_unit_path(target_organisation_id, access_scope_path);

        if scope_unit_status <> 'resolved' then
          errors := errors || jsonb_build_array(
            jsonb_build_object(
              'field', 'access_scope_unit_path',
              'issue', coalesce(scope_unit_message, 'Access scope could not be resolved.'),
              'suggestion', coalesce(
                scope_unit_suggestion,
                'Use the full organisational path from the root site.'
              )
            )
          );
        else
          scope_type := 'unit_subtree';
        end if;
      end if;
    else
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'application_role',
          'issue', format(
            'Application role ''%s'' cannot be assigned through bulk import.',
            application_role
          ),
          'suggestion', 'Choose a role with organisation or unit subtree access scope.'
        )
      );
    end if;

    if role_version_id is not null
      and scope_type is not null
      and jsonb_array_length(errors) = 0 then
      begin
        perform private.assert_role_version_grant_scope_allowed(
          target_organisation_id,
          role_version_id,
          scope_type,
          scope_unit_id
        );
      exception
        when others then
          errors := errors || jsonb_build_array(
            jsonb_build_object(
              'field', 'application_role',
              'issue', format(
                'Application role ''%s'' cannot be assigned with that scope.',
                application_role
              ),
              'suggestion', 'Choose a compatible role and access scope combination.'
            )
          );
      end;

      if jsonb_array_length(errors) = 0 then
        begin
          perform private.assert_workforce_provision_delegation(
            target_organisation_id,
            actor_membership_id,
            role_version_id,
            scope_type,
            scope_unit_id
          );
        exception
          when others then
            errors := errors || jsonb_build_array(
              jsonb_build_object(
                'field', 'application_role',
                'issue', 'You are not authorised to assign this role and scope.',
                'suggestion', 'Choose a role and scope within your delegation authority.'
              )
            );
        end;
      end if;
    end if;
  end if;

  if job_function_id is not null and primary_unit_id is not null then
    if not private.membership_has_scoped_permission(
      actor_membership_id,
      target_organisation_id,
      'hierarchy.read',
      null,
      primary_unit_id
    ) then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'primary_unit_path',
          'issue', 'Primary work area is not accessible.',
          'suggestion', 'Choose a work area within your authority.'
        )
      );
    end if;

    if not private.membership_has_scoped_permission(
      actor_membership_id,
      target_organisation_id,
      'job_functions.manage',
      null,
      primary_unit_id
    ) then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'job_function',
          'issue', 'Job function assignment is not authorised for that work area.',
          'suggestion', 'Choose a work area you can manage.'
        )
      );
    end if;
  end if;

  if jsonb_array_length(errors) > 0 then
    row_status := 'error';
    field_errors := errors;
    return;
  end if;

  display_name := first_name || ' ' || last_name;

  resolved := jsonb_build_object(
    'display_name', display_name,
    'username', username,
    'notification_email', case when notification_email = '' then null else notification_email end,
    'job_title', case when job_title = '' then null else job_title end,
    'job_function_id', job_function_id,
    'organisational_unit_id', primary_unit_id,
    'role_version_id', role_version_id,
    'scope_type', scope_type,
    'scope_unit_id', scope_unit_id,
    'primary_unit_path', primary_unit_path,
    'access_scope_unit_path', case when access_scope_path = '' then null else access_scope_path end,
    'application_role', application_role,
    'job_function', job_function_name
  );

  if jsonb_array_length(warnings) > 0 then
    row_status := 'warning';
    field_errors := warnings;
  end if;
end;
$$;

alter function private.role_version_permitted_scope_types(uuid, uuid) owner to lean_hub_private_owner;
alter function private.validate_workforce_import_row_payload(uuid, uuid, jsonb) owner to lean_hub_private_owner;
