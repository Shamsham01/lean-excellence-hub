-- M2 workforce bulk import operations and validation RPCs.

create or replace function private.assert_workforce_import_authorised(
  target_organisation_id uuid,
  actor_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_organisation_id is null or actor_membership_id is null then
    raise exception 'workforce import is not authorised'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'workforce.import',
    null,
    null
  ) then
    raise exception 'workforce import is not authorised'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.split_organisation_unit_path(
  target_path text
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_path text := btrim(target_path);
  segments text[];
  segment text;
  cleaned text[] := ARRAY[]::text[];
begin
  if normalized_path = '' then
    return cleaned;
  end if;

  segments := regexp_split_to_array(normalized_path, '\s*>\s*');

  foreach segment in array segments
  loop
    if btrim(segment) <> '' then
      cleaned := array_append(cleaned, btrim(segment));
    end if;
  end loop;

  return cleaned;
end;
$$;

create or replace function private.resolve_organisation_unit_path(
  target_organisation_id uuid,
  target_path text,
  out resolved_unit_id uuid,
  out resolution_status text,
  out resolution_message text,
  out resolution_suggestion text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  segments text[];
  segment text;
  current_parent uuid := null;
  matched_count integer;
  matched_id uuid;
  partial_path text := '';
begin
  resolved_unit_id := null;
  resolution_status := 'not_found';
  resolution_message := null;
  resolution_suggestion := null;

  if target_path is null or btrim(target_path) = '' then
    resolution_status := 'missing';
    resolution_message := 'Organisational path is required.';
    return;
  end if;

  segments := private.split_organisation_unit_path(target_path);

  if coalesce(array_length(segments, 1), 0) = 0 then
    resolution_status := 'missing';
    resolution_message := 'Organisational path is required.';
    return;
  end if;

  foreach segment in array segments
  loop
    partial_path := case
      when partial_path = '' then segment
      else partial_path || ' > ' || segment
    end;

    select count(*)
    into matched_count
    from public.organisation_units unit_row
    where unit_row.organisation_id = target_organisation_id
      and unit_row.status = 'active'
      and unit_row.name = segment
      and (
        (current_parent is null and unit_row.parent_unit_id is null)
        or unit_row.parent_unit_id = current_parent
      );

    if matched_count = 0 then
      resolution_status := 'not_found';
      resolution_message := format('Work area "%s" was not found.', partial_path);
      resolution_suggestion := 'Check the organisational path and use the full path from the root site.';
      return;
    elsif matched_count > 1 then
      resolution_status := 'ambiguous';
      resolution_message := format(
        'Work area "%s" matches more than one unit.',
        segment
      );
      resolution_suggestion := format(
        'Use the full organisational path, e.g. "%s > %s".',
        partial_path,
        segment
      );
      return;
    end if;

    select unit_row.id
    into matched_id
    from public.organisation_units unit_row
    where unit_row.organisation_id = target_organisation_id
      and unit_row.status = 'active'
      and unit_row.name = segment
      and (
        (current_parent is null and unit_row.parent_unit_id is null)
        or unit_row.parent_unit_id = current_parent
      )
    order by unit_row.id
    limit 1;

    current_parent := matched_id;
  end loop;

  resolved_unit_id := current_parent;
  resolution_status := 'resolved';
end;
$$;

create or replace function private.resolve_job_function_by_name(
  target_organisation_id uuid,
  target_name text,
  out resolved_job_function_id uuid,
  out resolution_status text,
  out resolution_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  matched_count integer;
begin
  resolved_job_function_id := null;
  resolution_status := 'not_found';
  resolution_message := null;

  if target_name is null or btrim(target_name) = '' then
    resolution_status := 'missing';
    resolution_message := 'Job function is required.';
    return;
  end if;

  select count(*)
  into matched_count
  from public.job_functions job_function_row
  where job_function_row.organisation_id = target_organisation_id
    and job_function_row.status = 'active'
    and lower(job_function_row.name) = lower(btrim(target_name));

  if matched_count = 0 then
    resolution_message := format('Job function ''%s'' was not found.', btrim(target_name));
    return;
  elsif matched_count > 1 then
    resolution_status := 'ambiguous';
    resolution_message := format(
      'Job function ''%s'' matches more than one active job function.',
      btrim(target_name)
    );
    resolved_job_function_id := null;
    return;
  end if;

  select job_function_row.id
  into resolved_job_function_id
  from public.job_functions job_function_row
  where job_function_row.organisation_id = target_organisation_id
    and job_function_row.status = 'active'
    and lower(job_function_row.name) = lower(btrim(target_name))
  order by job_function_row.id
  limit 1;

  resolution_status := 'resolved';
end;
$$;

create or replace function private.resolve_role_version_by_display_name(
  target_organisation_id uuid,
  target_role_name text,
  out resolved_role_version_id uuid,
  out resolution_status text,
  out resolution_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  matched_count integer;
begin
  resolved_role_version_id := null;
  resolution_status := 'not_found';
  resolution_message := null;

  if target_role_name is null or btrim(target_role_name) = '' then
    resolution_status := 'missing';
    resolution_message := 'Application role is required.';
    return;
  end if;

  select count(*)
  into matched_count
  from public.role_versions role_version_row
  join public.roles role_row
    on role_row.organisation_id = role_version_row.organisation_id
   and role_row.id = role_version_row.role_id
  where role_version_row.organisation_id = target_organisation_id
    and role_version_row.status = 'published'
    and role_row.status = 'active'
    and lower(role_row.display_name) = lower(btrim(target_role_name));

  if matched_count = 0 then
    resolution_message := format(
      'Application role ''%s'' was not found.',
      btrim(target_role_name)
    );
    return;
  elsif matched_count > 1 then
    resolution_status := 'ambiguous';
    resolution_message := format(
      'Application role ''%s'' matches more than one published role.',
      btrim(target_role_name)
    );
    resolved_role_version_id := null;
    return;
  end if;

  select role_version_row.id
  into resolved_role_version_id
  from public.role_versions role_version_row
  join public.roles role_row
    on role_row.organisation_id = role_version_row.organisation_id
   and role_row.id = role_version_row.role_id
  where role_version_row.organisation_id = target_organisation_id
    and role_version_row.status = 'published'
    and role_row.status = 'active'
    and lower(role_row.display_name) = lower(btrim(target_role_name))
  order by role_version_row.id
  limit 1;

  resolution_status := 'resolved';
end;
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

  if access_scope_path = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'access_scope_unit_path',
        'issue', 'Access scope path is required.',
        'suggestion', 'Provide the organisational path for access scope.'
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
    end if;
  end if;

  if role_version_id is not null and scope_unit_id is not null then
    scope_type := 'unit_subtree';
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
    'access_scope_unit_path', access_scope_path,
    'application_role', application_role,
    'job_function', job_function_name
  );

  if jsonb_array_length(warnings) > 0 then
    row_status := 'warning';
    field_errors := warnings;
  end if;
end;
$$;

create or replace function public.create_workforce_import_job(
  target_original_filename text
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
  new_job_id uuid;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  if target_original_filename is null
    or btrim(target_original_filename) = ''
    or char_length(btrim(target_original_filename)) > 255 then
    raise exception 'original filename is invalid'
      using errcode = '22023';
  end if;

  insert into public.workforce_import_jobs (
    organisation_id,
    created_by_membership_id,
    status,
    original_filename
  )
  values (
    org_id,
    actor_membership_id,
    'draft',
    btrim(target_original_filename)
  )
  returning id into new_job_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.import_job_created',
    'workforce_import_job',
    new_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('original_filename', btrim(target_original_filename))
  );

  return new_job_id;
end;
$$;

create or replace function public.submit_workforce_import_rows(
  target_import_job_id uuid,
  target_rows jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  row_item jsonb;
  row_index integer := 0;
  row_count integer;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.status <> 'draft' then
    raise exception 'import job cannot accept rows in its current state'
      using errcode = '55000';
  end if;

  if target_rows is null or jsonb_typeof(target_rows) <> 'array' then
    raise exception 'rows payload must be a JSON array'
      using errcode = '22023';
  end if;

  row_count := jsonb_array_length(target_rows);

  if row_count = 0 then
    raise exception 'import file is empty'
      using errcode = '22023';
  end if;

  if row_count > 1000 then
    raise exception 'import exceeds the maximum of 1000 rows'
      using errcode = '22023';
  end if;

  delete from public.workforce_import_rows import_row
  where import_row.import_job_id = target_import_job_id;

  for row_item in
    select value
    from jsonb_array_elements(target_rows) as payload(value)
  loop
    row_index := row_index + 1;
    insert into public.workforce_import_rows (
      import_job_id,
      organisation_id,
      row_number,
      input_payload,
      status
    )
    values (
      target_import_job_id,
      org_id,
      row_index,
      row_item,
      'pending'
    );
  end loop;

  update public.workforce_import_jobs
  set total_rows = row_count,
      valid_rows = 0,
      error_rows = 0,
      warning_rows = 0,
      provisioned_rows = 0,
      failed_rows = 0,
      remediation_rows = 0,
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function public.validate_workforce_import_job(
  target_import_job_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  import_row public.workforce_import_rows%rowtype;
  seen_usernames jsonb := '{}'::jsonb;
  username text;
  row_status text;
  resolved jsonb;
  validation_field_errors jsonb;
  valid_count integer := 0;
  error_count integer := 0;
  warning_count integer := 0;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  for import_row in
    select import_row_table.*
    from public.workforce_import_rows import_row_table
    where import_row_table.import_job_id = target_import_job_id
    order by import_row_table.row_number
  loop
    username := lower(btrim(coalesce(import_row.input_payload ->> 'username', '')));

    if username <> '' and seen_usernames ? username then
      row_status := 'error';
      validation_field_errors := jsonb_build_array(
        jsonb_build_object(
          'field', 'username',
          'issue', format('Username ''%s'' is duplicated in this file.', username),
          'suggestion', 'Use a unique username for each row.'
        )
      );
      resolved := null;
    else
      if username <> '' then
        seen_usernames := seen_usernames || jsonb_build_object(username, true);
      end if;

      select
        validation.row_status,
        validation.resolved,
        validation.field_errors
      into row_status, resolved, validation_field_errors
      from private.validate_workforce_import_row_payload(
        org_id,
        actor_membership_id,
        import_row.input_payload
      ) as validation;
    end if;

    update public.workforce_import_rows import_row_target
    set status = row_status,
        resolved_payload = resolved,
        field_errors = validation_field_errors,
        error_code = case when row_status = 'error' then 'validation_failed' else null end,
        error_message = case
          when row_status = 'error' then 'Row failed validation.'
          else null
        end,
        updated_at = statement_timestamp()
    where import_row_target.id = import_row.id;

    if row_status = 'valid' then
      valid_count := valid_count + 1;
    elsif row_status = 'warning' then
      warning_count := warning_count + 1;
      valid_count := valid_count + 1;
    else
      error_count := error_count + 1;
    end if;
  end loop;

  update public.workforce_import_jobs
  set status = case when error_count = 0 then 'validated' else 'validation_failed' end,
      valid_rows = valid_count,
      error_rows = error_count,
      warning_rows = warning_count,
      validation_completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = target_import_job_id;

  return jsonb_build_object(
    'total_rows', job_row.total_rows,
    'valid_rows', valid_count,
    'error_rows', error_count,
    'warning_rows', warning_count,
    'can_provision', error_count = 0
  );
end;
$$;

create or replace function private.preauthorize_workforce_import_row(
  target_import_row_id uuid
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
  import_row public.workforce_import_rows%rowtype;
  job_row public.workforce_import_jobs%rowtype;
  resolved jsonb;
  sealed_login text;
  new_intent_id uuid;
  existing_intent_id uuid;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into import_row
  from public.workforce_import_rows import_row_table
  where import_row_table.id = target_import_row_id
    and import_row_table.organisation_id = org_id
  for update;

  if import_row.id is null then
    raise exception 'import row does not exist'
      using errcode = 'P0002';
  end if;

  if import_row.status = 'provisioning'
    and import_row.provisioning_intent_id is not null then
    select intent_row.id
    into existing_intent_id
    from public.workforce_provision_intents intent_row
    where intent_row.id = import_row.provisioning_intent_id
      and intent_row.status in ('pending', 'auth_created', 'completed');

    if existing_intent_id is not null then
      return existing_intent_id;
    end if;
  end if;

  if import_row.status not in ('valid', 'warning', 'failed') then
    if import_row.status = 'completed' and import_row.provisioning_intent_id is not null then
      return import_row.provisioning_intent_id;
    end if;

    raise exception 'import row is not ready for provisioning'
      using errcode = '55000';
  end if;

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = import_row.import_job_id
    and import_job.organisation_id = org_id;

  if job_row.status not in ('provisioning', 'validated') then
    raise exception 'import job is not provisioning'
      using errcode = '55000';
  end if;

  if import_row.provisioning_intent_id is not null then
    select intent_row.id
    into existing_intent_id
    from public.workforce_provision_intents intent_row
    where intent_row.id = import_row.provisioning_intent_id
      and intent_row.status in ('pending', 'auth_created', 'completed');

    if existing_intent_id is not null then
      return existing_intent_id;
    end if;
  end if;

  resolved := import_row.resolved_payload;

  perform private.assert_workforce_provision_delegation(
    org_id,
    actor_membership_id,
    (resolved ->> 'role_version_id')::uuid,
    resolved ->> 'scope_type',
    (resolved ->> 'scope_unit_id')::uuid
  );

  if not private.workforce_alias_is_available(org_id, resolved ->> 'username') then
    raise exception 'workforce alias is unavailable'
      using errcode = '23505';
  end if;

  sealed_login := private.generate_workforce_internal_login_identifier();

  insert into public.workforce_provision_intents (
    organisation_id,
    actor_membership_id,
    intent_kind,
    status,
    target_display_name,
    target_canonical_alias,
    target_alias_type,
    target_job_title,
    target_notification_email,
    sealed_internal_login_identifier,
    target_job_function_id,
    target_organisational_unit_id,
    target_role_version_id,
    target_scope_type,
    target_scope_unit_id,
    expires_at,
    idempotency_key,
    source_import_job_id,
    source_import_row_id
  )
  values (
    org_id,
    actor_membership_id,
    'bulk_import_create',
    'pending',
    resolved ->> 'display_name',
    resolved ->> 'username',
    'username',
    resolved ->> 'job_title',
    resolved ->> 'notification_email',
    sealed_login,
    (resolved ->> 'job_function_id')::uuid,
    (resolved ->> 'organisational_unit_id')::uuid,
    (resolved ->> 'role_version_id')::uuid,
    resolved ->> 'scope_type',
    (resolved ->> 'scope_unit_id')::uuid,
    statement_timestamp() + interval '24 hours',
    'import-row:' || import_row.id::text,
    import_row.import_job_id,
    import_row.id
  )
  returning id into new_intent_id;

  update public.workforce_import_rows
  set status = 'provisioning',
      provisioning_intent_id = new_intent_id,
      updated_at = statement_timestamp()
  where id = import_row.id;

  return new_intent_id;
end;
$$;

create or replace function public.start_workforce_import_provisioning(
  target_import_job_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.status <> 'validated' or job_row.error_rows > 0 then
    raise exception 'import job cannot be provisioned until validation succeeds'
      using errcode = '55000';
  end if;

  update public.workforce_import_jobs
  set status = 'provisioning',
      started_at = coalesce(started_at, statement_timestamp()),
      credential_export_status = 'none',
      credential_expires_at = null,
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function public.claim_workforce_import_batch(
  target_import_job_id uuid,
  target_batch_size integer default 25
)
returns table (
  import_row_id uuid,
  provisioning_intent_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  import_row public.workforce_import_rows%rowtype;
  claimed integer := 0;
  intent_id uuid;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  if target_batch_size < 1 or target_batch_size > 50 then
    raise exception 'batch size must be between 1 and 50'
      using errcode = '22023';
  end if;

  for import_row in
    select import_row_table.*
    from public.workforce_import_rows import_row_table
    where import_row_table.import_job_id = target_import_job_id
      and import_row_table.organisation_id = org_id
      and import_row_table.status in ('valid', 'warning', 'provisioning')
    order by import_row_table.row_number
    for update skip locked
  loop
    exit when claimed >= target_batch_size;

    intent_id := private.preauthorize_workforce_import_row(import_row.id);
    import_row_id := import_row.id;
    provisioning_intent_id := intent_id;
    claimed := claimed + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.record_workforce_import_row_success(
  target_import_row_id uuid,
  target_membership_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  import_row public.workforce_import_rows%rowtype;
  pending_count integer;
begin
  select *
  into import_row
  from public.workforce_import_rows import_row_table
  where import_row_table.id = target_import_row_id
  for update;

  if import_row.id is null then
    raise exception 'import row does not exist'
      using errcode = 'P0002';
  end if;

  update public.workforce_import_rows
  set status = 'completed',
      created_membership_id = target_membership_id,
      error_code = null,
      error_message = null,
      updated_at = statement_timestamp()
  where id = import_row.id;

  update public.workforce_import_jobs import_job
  set provisioned_rows = provisioned_rows + 1,
      updated_at = statement_timestamp()
  where import_job.id = import_row.import_job_id;

  select count(*)
  into pending_count
  from public.workforce_import_rows pending_row
  where pending_row.import_job_id = import_row.import_job_id
    and pending_row.status in ('valid', 'warning', 'provisioning', 'failed');

  if pending_count = 0 then
    update public.workforce_import_jobs import_job
    set status = case
          when import_job.remediation_rows > 0 or import_job.failed_rows > 0
            then 'completed_with_remediation'
          else 'completed'
        end,
        completed_at = statement_timestamp(),
        credential_export_status = case
          when import_job.provisioned_rows > 0 then 'available'
          else import_job.credential_export_status
        end,
        credential_expires_at = case
          when import_job.provisioned_rows > 0
            then coalesce(
              import_job.credential_expires_at,
              statement_timestamp() + interval '24 hours'
            )
          else import_job.credential_expires_at
        end,
        updated_at = statement_timestamp()
    where import_job.id = import_row.import_job_id;
  end if;
end;
$$;

create or replace function public.record_workforce_import_row_failure(
  target_import_row_id uuid,
  target_error_code text,
  target_error_message text,
  target_needs_remediation boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  import_row public.workforce_import_rows%rowtype;
begin
  select *
  into import_row
  from public.workforce_import_rows import_row_table
  where import_row_table.id = target_import_row_id
  for update;

  if import_row.id is null then
    raise exception 'import row does not exist'
      using errcode = 'P0002';
  end if;

  if import_row.status in ('failed', 'needs_platform_remediation', 'completed') then
    return;
  end if;

  update public.workforce_import_rows
  set status = case
        when target_needs_remediation then 'needs_platform_remediation'
        else 'failed'
      end,
      error_code = target_error_code,
      error_message = target_error_message,
      updated_at = statement_timestamp()
  where id = import_row.id;

  update public.workforce_import_jobs import_job
  set failed_rows = failed_rows + case when target_needs_remediation then 0 else 1 end,
      remediation_rows = remediation_rows + case when target_needs_remediation then 1 else 0 end,
      updated_at = statement_timestamp()
  where import_job.id = import_row.import_job_id;

  update public.workforce_import_jobs import_job
  set status = case
        when remediation_rows > 0 or failed_rows > 0 then 'completed_with_remediation'
        else status
      end,
      completed_at = case
        when not exists (
          select 1
          from public.workforce_import_rows pending_row
          where pending_row.import_job_id = import_row.import_job_id
            and pending_row.status in ('valid', 'warning', 'provisioning', 'failed')
        ) then statement_timestamp()
        else completed_at
      end,
      credential_export_status = case
        when credential_export_status = 'none'
          and not exists (
            select 1
            from public.workforce_import_rows pending_row
            where pending_row.import_job_id = import_row.import_job_id
              and pending_row.status in ('valid', 'warning', 'provisioning', 'failed')
          )
          and provisioned_rows > 0 then 'available'
        else credential_export_status
      end,
      credential_expires_at = case
        when credential_expires_at is null
          and not exists (
            select 1
            from public.workforce_import_rows pending_row
            where pending_row.import_job_id = import_row.import_job_id
              and pending_row.status in ('valid', 'warning', 'provisioning', 'failed')
          )
          and provisioned_rows > 0 then statement_timestamp() + interval '24 hours'
        else credential_expires_at
      end,
      updated_at = statement_timestamp()
  where import_job.id = import_row.import_job_id
    and not exists (
      select 1
      from public.workforce_import_rows pending_row
      where pending_row.import_job_id = import_row.import_job_id
        and pending_row.status in ('valid', 'warning', 'provisioning', 'failed')
    );
end;
$$;

create or replace function public.store_workforce_import_row_credential(
  target_import_row_id uuid,
  target_ciphertext bytea,
  target_nonce bytea,
  target_expires_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  import_row public.workforce_import_rows%rowtype;
begin
  select *
  into import_row
  from public.workforce_import_rows import_row_table
  where import_row_table.id = target_import_row_id
  for update;

  if import_row.id is null then
    raise exception 'import row does not exist'
      using errcode = 'P0002';
  end if;

  insert into public.workforce_import_row_credentials (
    import_row_id,
    import_job_id,
    organisation_id,
    credential_ciphertext,
    credential_nonce,
    expires_at
  )
  values (
    import_row.id,
    import_row.import_job_id,
    import_row.organisation_id,
    target_ciphertext,
    target_nonce,
    target_expires_at
  )
  on conflict (import_row_id) do update
  set credential_ciphertext = excluded.credential_ciphertext,
      credential_nonce = excluded.credential_nonce,
      expires_at = excluded.expires_at;
end;
$$;

create or replace function public.get_workforce_import_job_progress(
  target_import_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
  remaining_count integer;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  select count(*)
  into remaining_count
  from public.workforce_import_rows import_row
  where import_row.import_job_id = target_import_job_id
    and import_row.status in ('valid', 'warning', 'provisioning', 'failed');

  return jsonb_build_object(
    'status', job_row.status,
    'total_rows', job_row.total_rows,
    'valid_rows', job_row.valid_rows,
    'error_rows', job_row.error_rows,
    'warning_rows', job_row.warning_rows,
    'provisioned_rows', job_row.provisioned_rows,
    'failed_rows', job_row.failed_rows,
    'remediation_rows', job_row.remediation_rows,
    'remaining_rows', remaining_count,
    'credential_export_status', job_row.credential_export_status,
    'credential_expires_at', job_row.credential_expires_at,
    'completed_at', job_row.completed_at
  );
end;
$$;

create or replace function public.get_workforce_import_validation_rows(
  target_import_job_id uuid
)
returns setof public.workforce_import_rows
language sql
stable
security definer
set search_path = ''
as $$
  select import_row.*
  from public.workforce_import_rows import_row
  where import_row.import_job_id = target_import_job_id
    and import_row.organisation_id = private.current_organisation_id()
    and private.membership_has_scoped_permission(
      private.current_membership_id(import_row.organisation_id),
      import_row.organisation_id,
      'workforce.import',
      null,
      null
    )
  order by import_row.row_number;
$$;

create or replace function public.get_workforce_import_preview_rows(
  target_import_job_id uuid
)
returns table (
  row_number integer,
  display_name text,
  username text,
  job_function text,
  primary_unit_path text,
  application_role text,
  access_scope_unit_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    import_row.row_number,
    import_row.resolved_payload ->> 'display_name',
    import_row.resolved_payload ->> 'username',
    import_row.resolved_payload ->> 'job_function',
    import_row.resolved_payload ->> 'primary_unit_path',
    import_row.resolved_payload ->> 'application_role',
    import_row.resolved_payload ->> 'access_scope_unit_path'
  from public.workforce_import_rows import_row
  where import_row.import_job_id = target_import_job_id
    and import_row.organisation_id = private.current_organisation_id()
    and import_row.status in ('valid', 'warning')
    and private.membership_has_scoped_permission(
      private.current_membership_id(import_row.organisation_id),
      import_row.organisation_id,
      'workforce.import',
      null,
      null
    )
  order by import_row.row_number;
$$;

create or replace function public.mark_workforce_import_credentials_exported(
  target_import_job_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  job_row public.workforce_import_jobs%rowtype;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.credential_export_status not in ('available', 'exported') then
    raise exception 'credential export is not available'
      using errcode = '55000';
  end if;

  if job_row.credential_expires_at is not null
    and job_row.credential_expires_at <= statement_timestamp() then
    raise exception 'credential export has expired'
      using errcode = '55000';
  end if;

  delete from public.workforce_import_row_credentials credential_row
  where credential_row.import_job_id = target_import_job_id;

  update public.workforce_import_jobs
  set credential_export_status = 'exported',
      updated_at = statement_timestamp()
  where id = target_import_job_id;

  insert into public.security_audit_events (
    organisation_id,
    action,
    target_type,
    target_id,
    outcome,
    request_correlation_id,
    metadata
  )
  values (
    org_id,
    'workforce.import_credentials_exported',
    'workforce_import_job',
    target_import_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('row_count', job_row.provisioned_rows)
  );
end;
$$;

create or replace function public.get_workforce_import_credential_export_rows(
  target_import_job_id uuid
)
returns table (
  import_row_id uuid,
  row_number integer,
  first_name text,
  last_name text,
  username text,
  job_title text,
  primary_unit_path text,
  credential_ciphertext bytea,
  credential_nonce bytea
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  select import_job.organisation_id
  into org_id
  from public.workforce_import_jobs import_job
  where import_job.id = target_import_job_id;

  if org_id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  return query
  select
    import_row.id,
    import_row.row_number,
    import_row.input_payload ->> 'first_name',
    import_row.input_payload ->> 'last_name',
    import_row.resolved_payload ->> 'username',
    import_row.resolved_payload ->> 'job_title',
    import_row.resolved_payload ->> 'primary_unit_path',
    credential_row.credential_ciphertext,
    credential_row.credential_nonce
  from public.workforce_import_rows import_row
  join public.workforce_import_row_credentials credential_row
    on credential_row.import_row_id = import_row.id
  join public.workforce_import_jobs import_job
    on import_job.id = import_row.import_job_id
  where import_row.import_job_id = target_import_job_id
    and import_row.organisation_id = org_id
    and import_row.status = 'completed'
    and import_job.credential_export_status = 'available'
    and (
      import_job.credential_expires_at is null
      or import_job.credential_expires_at > statement_timestamp()
    )
  order by import_row.row_number;
end;
$$;

create or replace function public.retry_workforce_import_failed_rows(
  target_import_job_id uuid
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
  reset_count integer := 0;
begin
  perform private.assert_workforce_import_authorised(org_id, actor_membership_id);

  update public.workforce_import_rows import_row
  set status = 'valid',
      error_code = null,
      error_message = null,
      updated_at = statement_timestamp()
  where import_row.import_job_id = target_import_job_id
    and import_row.organisation_id = org_id
    and import_row.status = 'failed';

  get diagnostics reset_count = row_count;

  if reset_count > 0 then
    update public.workforce_import_jobs
    set status = 'provisioning',
        failed_rows = greatest(failed_rows - reset_count, 0),
        completed_at = null,
        updated_at = statement_timestamp()
    where id = target_import_job_id
      and organisation_id = org_id;
  end if;

  return reset_count;
end;
$$;

grant execute on function public.create_workforce_import_job(text) to authenticated;
grant execute on function public.submit_workforce_import_rows(uuid, jsonb) to authenticated;
grant execute on function public.validate_workforce_import_job(uuid) to authenticated;
grant execute on function public.start_workforce_import_provisioning(uuid) to authenticated;
grant execute on function public.claim_workforce_import_batch(uuid, integer) to authenticated;
grant execute on function public.get_workforce_import_job_progress(uuid) to authenticated;
grant execute on function public.get_workforce_import_validation_rows(uuid) to authenticated;
grant execute on function public.get_workforce_import_preview_rows(uuid) to authenticated;
grant execute on function public.retry_workforce_import_failed_rows(uuid) to authenticated;

revoke all on function public.create_workforce_import_job(text) from public, anon;
revoke all on function public.submit_workforce_import_rows(uuid, jsonb) from public, anon;
revoke all on function public.validate_workforce_import_job(uuid) from public, anon;
revoke all on function public.start_workforce_import_provisioning(uuid) from public, anon;
revoke all on function public.claim_workforce_import_batch(uuid, integer) from public, anon;
revoke all on function public.get_workforce_import_job_progress(uuid) from public, anon;
revoke all on function public.get_workforce_import_validation_rows(uuid) from public, anon;
revoke all on function public.get_workforce_import_preview_rows(uuid) from public, anon;
revoke all on function public.retry_workforce_import_failed_rows(uuid) from public, anon;

grant execute on function public.record_workforce_import_row_success(uuid, uuid) to lean_hub_private_owner, service_role;
grant execute on function public.record_workforce_import_row_failure(uuid, text, text, boolean) to lean_hub_private_owner, service_role;
grant execute on function public.store_workforce_import_row_credential(uuid, bytea, bytea, timestamptz) to lean_hub_private_owner, service_role;
grant execute on function public.mark_workforce_import_credentials_exported(uuid) to authenticated, lean_hub_private_owner;
grant execute on function public.get_workforce_import_credential_export_rows(uuid) to lean_hub_private_owner, service_role;

revoke all on function public.record_workforce_import_row_success(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_workforce_import_row_failure(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.store_workforce_import_row_credential(uuid, bytea, bytea, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_workforce_import_credentials_exported(uuid) from public, anon;
revoke all on function public.get_workforce_import_credential_export_rows(uuid) from public, anon, authenticated;

alter function private.assert_workforce_import_authorised(uuid, uuid) owner to lean_hub_private_owner;
alter function private.split_organisation_unit_path(text) owner to lean_hub_private_owner;
alter function private.resolve_organisation_unit_path(uuid, text) owner to lean_hub_private_owner;
alter function private.resolve_job_function_by_name(uuid, text) owner to lean_hub_private_owner;
alter function private.resolve_role_version_by_display_name(uuid, text) owner to lean_hub_private_owner;
alter function private.validate_workforce_import_row_payload(uuid, uuid, jsonb) owner to lean_hub_private_owner;
alter function private.preauthorize_workforce_import_row(uuid) owner to lean_hub_private_owner;

revoke all on function private.assert_workforce_import_authorised(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.split_organisation_unit_path(text) from public, anon, authenticated, service_role;
revoke all on function private.resolve_organisation_unit_path(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.resolve_job_function_by_name(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.resolve_role_version_by_display_name(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.validate_workforce_import_row_payload(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.preauthorize_workforce_import_row(uuid) from public, anon, authenticated, service_role;
