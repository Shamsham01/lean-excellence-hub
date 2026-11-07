-- Bulk colleague invitation import (CSV) for organisation administrators.

create table public.people_invitation_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  created_by_membership_id uuid not null,
  status text not null default 'draft',
  original_filename text not null,
  content_fingerprint text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  warning_rows integer not null default 0,
  created_invitation_rows integer not null default 0,
  skipped_rows integer not null default 0,
  failed_rows integer not null default 0,
  created_unit_rows integer not null default 0,
  validation_completed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint people_invitation_import_jobs_actor_fkey
    foreign key (organisation_id, created_by_membership_id)
    references public.organisation_memberships(organisation_id, id)
    on delete restrict,
  constraint people_invitation_import_jobs_status_check
    check (
      status in (
        'draft',
        'validated',
        'validation_failed',
        'importing',
        'completed',
        'completed_with_failures',
        'failed',
        'cancelled'
      )
    ),
  constraint people_invitation_import_jobs_total_rows_check
    check (total_rows >= 0 and total_rows <= 1000),
  constraint people_invitation_import_jobs_filename_check
    check (
      original_filename = btrim(original_filename)
      and char_length(original_filename) between 1 and 255
    )
);

create table public.people_invitation_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.people_invitation_import_jobs(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  row_number integer not null,
  record_type text not null default 'person',
  input_payload jsonb not null,
  resolved_payload jsonb,
  status text not null default 'pending',
  recipient_key text,
  created_invitation_id uuid references public.organisation_invitations(id) on delete set null,
  created_unit_id uuid,
  error_code text,
  error_message text,
  field_errors jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint people_invitation_import_rows_job_fkey
    foreign key (import_job_id)
    references public.people_invitation_import_jobs(id)
    on delete restrict,
  constraint people_invitation_import_rows_invitation_fkey
    foreign key (organisation_id, created_invitation_id)
    references public.organisation_invitations(organisation_id, id)
    on delete restrict,
  constraint people_invitation_import_rows_row_number_check
    check (row_number > 0),
  constraint people_invitation_import_rows_record_type_check
    check (record_type in ('person', 'unit')),
  constraint people_invitation_import_rows_status_check
    check (
      status in (
        'pending',
        'valid',
        'error',
        'warning',
        'importing',
        'completed',
        'skipped',
        'failed'
      )
    ),
  constraint people_invitation_import_rows_unique_row
    unique (import_job_id, row_number)
);

create unique index people_invitation_import_completed_recipient_idx
  on public.people_invitation_import_rows (organisation_id, recipient_key)
  where status = 'completed' and record_type = 'person' and recipient_key is not null;

create index people_invitation_import_jobs_org_created_idx
  on public.people_invitation_import_jobs (organisation_id, created_at desc);

create index people_invitation_import_rows_job_status_idx
  on public.people_invitation_import_rows (import_job_id, status, row_number);

create trigger people_invitation_import_jobs_touch_updated_at
before update on public.people_invitation_import_jobs
for each row execute function private.touch_updated_at();

create trigger people_invitation_import_rows_touch_updated_at
before update on public.people_invitation_import_rows
for each row execute function private.touch_updated_at();

alter table public.people_invitation_import_jobs enable row level security;
alter table public.people_invitation_import_jobs force row level security;

alter table public.people_invitation_import_rows enable row level security;
alter table public.people_invitation_import_rows force row level security;

revoke all on public.people_invitation_import_jobs from public, anon, authenticated, service_role;
revoke all on public.people_invitation_import_rows from public, anon, authenticated, service_role;

grant select, insert, update on public.people_invitation_import_jobs to lean_hub_private_owner;
grant select, insert, update on public.people_invitation_import_rows to lean_hub_private_owner;

create policy private_owner_all_people_invitation_import_jobs
on public.people_invitation_import_jobs
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy private_owner_all_people_invitation_import_rows
on public.people_invitation_import_rows
for all
to lean_hub_private_owner
using (true)
with check (true);

create policy people_invitation_import_jobs_select_scoped
on public.people_invitation_import_jobs
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.membership_has_scoped_permission(
    private.current_membership_id(organisation_id),
    organisation_id,
    'invitations.manage',
    null,
    null
  )
  and private.membership_has_scoped_permission(
    private.current_membership_id(organisation_id),
    organisation_id,
    'roles.delegate',
    null,
    null
  )
);

create policy people_invitation_import_rows_select_scoped
on public.people_invitation_import_rows
for select
to authenticated
using (
  organisation_id = private.current_organisation_id()
  and private.membership_has_scoped_permission(
    private.current_membership_id(organisation_id),
    organisation_id,
    'invitations.manage',
    null,
    null
  )
  and private.membership_has_scoped_permission(
    private.current_membership_id(organisation_id),
    organisation_id,
    'roles.delegate',
    null,
    null
  )
);

grant select on public.people_invitation_import_jobs to authenticated;
grant select on public.people_invitation_import_rows to authenticated;

alter table public.security_audit_events
  drop constraint if exists security_audit_events_target_type_check;

alter table public.security_audit_events
  add constraint security_audit_events_target_type_check
  check (
    target_type is null
    or target_type in (
      'identity',
      'organisation',
      'membership',
      'invitation',
      'unit',
      'role',
      'role_version',
      'grant',
      'session',
      'workforce_account',
      'workforce_alias',
      'workforce_provision_intent',
      'workforce_import_job',
      'people_invitation_import_job',
      'authentication'
    )
  );

create or replace function private.assert_people_invitation_import_authorised(
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
    raise exception 'people invitation import is not authorised'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'invitations.manage',
    null,
    null
  ) then
    raise exception 'people invitation import is not authorised'
      using errcode = '42501';
  end if;

  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'roles.delegate',
    null,
    null
  ) then
    raise exception 'people invitation import is not authorised'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function private.organisation_member_exists_for_email(
  target_organisation_id uuid,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_memberships membership
    inner join public.membership_notification_contacts contact_row
      on contact_row.organisation_id = membership.organisation_id
     and contact_row.membership_id = membership.id
    where membership.organisation_id = target_organisation_id
      and membership.status in ('pending', 'active')
      and contact_row.status = 'active'
      and lower(contact_row.contact_address) = lower(btrim(target_email))
  );
$$;

create or replace function private.pending_invitation_exists_for_email(
  target_organisation_id uuid,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_invitations invitation
    where invitation.organisation_id = target_organisation_id
      and invitation.recipient_type = 'email'
      and invitation.canonical_recipient = lower(btrim(target_email))
      and invitation.status = 'pending'
      and invitation.expires_at > statement_timestamp()
  );
$$;

create or replace function private.people_invitation_import_completed_for_email(
  target_organisation_id uuid,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.people_invitation_import_rows import_row
    where import_row.organisation_id = target_organisation_id
      and import_row.record_type = 'person'
      and import_row.recipient_key = lower(btrim(target_email))
      and import_row.status = 'completed'
  );
$$;

create or replace function private.validate_people_invitation_import_person_payload(
  target_organisation_id uuid,
  actor_membership_id uuid,
  target_payload jsonb,
  out row_status text,
  out resolved jsonb,
  out field_errors jsonb,
  out recipient_key text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  display_name text := btrim(coalesce(target_payload ->> 'display_name', target_payload ->> 'name', ''));
  email text := lower(btrim(coalesce(target_payload ->> 'email', '')));
  job_function_name text := btrim(coalesce(target_payload ->> 'department', target_payload ->> 'job_function', ''));
  primary_unit_path text := btrim(coalesce(target_payload ->> 'site', target_payload ->> 'primary_unit_path', ''));
  application_role text := btrim(coalesce(target_payload ->> 'role', target_payload ->> 'application_role', ''));
  access_scope_path text := btrim(coalesce(
    target_payload ->> 'access_scope_site',
    target_payload ->> 'access_scope_unit_path',
    primary_unit_path
  ));
  errors jsonb := '[]'::jsonb;
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
  scope_type text := 'unit_subtree';
begin
  row_status := 'valid';
  resolved := '{}'::jsonb;
  field_errors := '[]'::jsonb;
  recipient_key := null;

  if display_name = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'display_name',
        'issue', 'Name is required.',
        'suggestion', 'Provide the colleague display name.'
      )
    );
  elsif char_length(display_name) > 120 then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'display_name',
        'issue', 'Name is too long.',
        'suggestion', 'Use 120 characters or fewer.'
      )
    );
  end if;

  if email = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'email',
        'issue', 'Email is required.',
        'suggestion', 'Provide a work email address.'
      )
    );
  elsif email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'email',
        'issue', 'Email format is invalid.',
        'suggestion', 'Provide a valid email address.'
      )
    );
  else
    recipient_key := email;
  end if;

  if job_function_name <> '' then
    select
      resolved_job_function_id,
      resolution_status,
      resolution_message
    into job_function_id, job_function_status, job_function_message
    from private.resolve_job_function_by_name(target_organisation_id, job_function_name);

    if job_function_status <> 'resolved' then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'department',
          'issue', coalesce(job_function_message, 'Department could not be resolved.'),
          'suggestion', 'Use an exact active job function name or leave blank.'
        )
      );
    end if;
  end if;

  if primary_unit_path <> '' then
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
          'field', 'site',
          'issue', coalesce(primary_unit_message, 'Site could not be resolved.'),
          'suggestion', coalesce(
            primary_unit_suggestion,
            'Use the full organisational path from the root site.'
          )
        )
      );
    end if;
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
        'field', 'role',
        'issue', coalesce(role_message, 'Application role could not be resolved.'),
        'suggestion', 'Use an exact published application role name.'
      )
    );
  end if;

  if access_scope_path = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'access_scope_site',
        'issue', 'Access scope site is required.',
        'suggestion', 'Provide the site path for role access or set site to the same path.'
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
          'field', 'access_scope_site',
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
            'field', 'role',
            'issue', format(
              'Application role ''%s'' cannot be assigned with that scope.',
              application_role
            ),
            'suggestion', 'Choose a compatible role and access scope combination.'
          )
        );
    end;

    begin
      perform private.assert_invitation_grant_delegatable(
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
            'field', 'role',
            'issue', 'You are not authorised to assign this role and scope.',
            'suggestion', 'Choose a role and scope within your delegation authority.'
          )
        );
    end;
  end if;

  if email <> '' then
    if private.organisation_member_exists_for_email(target_organisation_id, email) then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'email',
          'issue', 'This person is already a member of the organisation.',
          'suggestion', 'Remove this row or update their access from People.'
        )
      );
    elsif private.pending_invitation_exists_for_email(target_organisation_id, email) then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'email',
          'issue', 'A pending invitation already exists for this email.',
          'suggestion', 'Remove the row or reissue the existing invitation from People settings.'
        )
      );
    end if;
  end if;

  if jsonb_array_length(errors) > 0 then
    row_status := 'error';
    field_errors := errors;
    return;
  end if;

  resolved := jsonb_build_object(
    'display_name', display_name,
    'email', email,
    'job_function_id', job_function_id,
    'organisational_unit_id', primary_unit_id,
    'role_version_id', role_version_id,
    'scope_type', scope_type,
    'scope_unit_id', scope_unit_id,
    'offered_grants', jsonb_build_array(
      jsonb_build_object(
        'role_version_id', role_version_id,
        'scope_type', scope_type,
        'scope_unit_id', scope_unit_id
      )
    )
  );
end;
$$;

create or replace function private.validate_people_invitation_import_unit_payload(
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
  parent_path text := btrim(coalesce(target_payload ->> 'parent_site_path', target_payload ->> 'parent_site', ''));
  area_name text := btrim(coalesce(target_payload ->> 'area_name', target_payload ->> 'unit_name', ''));
  area_code text := upper(btrim(coalesce(target_payload ->> 'area_code', target_payload ->> 'unit_code', '')));
  unit_type text := lower(btrim(coalesce(target_payload ->> 'unit_type', 'area')));
  parent_unit_id uuid;
  parent_status text;
  parent_message text;
  parent_suggestion text;
  errors jsonb := '[]'::jsonb;
  existing_unit_id uuid;
begin
  row_status := 'valid';
  resolved := '{}'::jsonb;
  field_errors := '[]'::jsonb;

  if not private.membership_has_scoped_permission(
    actor_membership_id,
    target_organisation_id,
    'hierarchy.manage',
    null,
    null
  ) then
    row_status := 'error';
    field_errors := jsonb_build_array(
      jsonb_build_object(
        'field', 'record_type',
        'issue', 'You do not have permission to create organisation units from import.',
        'suggestion', 'Ask an administrator with hierarchy access or remove unit rows.'
      )
    );
    return;
  end if;

  if area_name = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'area_name',
        'issue', 'Area name is required for unit rows.',
        'suggestion', 'Provide the work area name.'
      )
    );
  end if;

  if parent_path = '' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'parent_site_path',
        'issue', 'Parent site path is required.',
        'suggestion', 'Provide the full path to the parent site or area.'
      )
    );
  else
    select
      resolved_unit_id,
      resolution_status,
      resolution_message,
      resolution_suggestion
    into parent_unit_id, parent_status, parent_message, parent_suggestion
    from private.resolve_organisation_unit_path(target_organisation_id, parent_path);

    if parent_status <> 'resolved' then
      errors := errors || jsonb_build_array(
        jsonb_build_object(
          'field', 'parent_site_path',
          'issue', coalesce(parent_message, 'Parent site could not be resolved.'),
          'suggestion', coalesce(parent_suggestion, 'Use the full organisational path.')
        )
      );
    end if;
  end if;

  if area_code <> '' and area_code !~ '^[A-Z0-9_-]{1,32}$' then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'area_code',
        'issue', 'Area code format is invalid.',
        'suggestion', 'Use uppercase letters, numbers, underscores, or hyphens.'
      )
    );
  end if;

  if unit_type not in ('area', 'department', 'line', 'cell') then
    errors := errors || jsonb_build_array(
      jsonb_build_object(
        'field', 'unit_type',
        'issue', 'Unit type is not supported.',
        'suggestion', 'Use area, department, line, or cell.'
      )
    );
  end if;

  if jsonb_array_length(errors) > 0 then
    row_status := 'error';
    field_errors := errors;
    return;
  end if;

  if parent_unit_id is not null then
    select unit_row.id
    into existing_unit_id
    from public.organisation_units unit_row
    where unit_row.organisation_id = target_organisation_id
      and unit_row.status = 'active'
      and unit_row.parent_unit_id = parent_unit_id
      and lower(unit_row.name) = lower(area_name)
    order by unit_row.id
    limit 1;

    if existing_unit_id is not null then
      row_status := 'warning';
      field_errors := jsonb_build_array(
        jsonb_build_object(
          'field', 'area_name',
          'issue', 'This work area already exists and will be skipped on import.',
          'suggestion', 'No action required unless you intended a different area.'
        )
      );
      resolved := jsonb_build_object(
        'existing_unit_id', existing_unit_id,
        'parent_unit_id', parent_unit_id,
        'area_name', area_name,
        'area_code', nullif(area_code, ''),
        'unit_type', unit_type,
        'skip_create', true
      );
      return;
    end if;
  end if;

  resolved := jsonb_build_object(
    'parent_unit_id', parent_unit_id,
    'area_name', area_name,
    'area_code', nullif(area_code, ''),
    'unit_type', unit_type,
    'skip_create', false
  );
end;
$$;

create or replace function public.create_people_invitation_import_job(
  target_original_filename text,
  target_content_fingerprint text default null
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
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  if target_original_filename is null
    or btrim(target_original_filename) = ''
    or char_length(btrim(target_original_filename)) > 255 then
    raise exception 'original filename is invalid'
      using errcode = '22023';
  end if;

  insert into public.people_invitation_import_jobs (
    organisation_id,
    created_by_membership_id,
    status,
    original_filename,
    content_fingerprint
  )
  values (
    org_id,
    actor_membership_id,
    'draft',
    btrim(target_original_filename),
    nullif(btrim(coalesce(target_content_fingerprint, '')), '')
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
    'people_invitation_import.job_created',
    'people_invitation_import_job',
    new_job_id,
    'succeeded',
    gen_random_uuid(),
    jsonb_build_object('original_filename', btrim(target_original_filename))
  );

  return new_job_id;
end;
$$;

create or replace function public.submit_people_invitation_import_rows(
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
  job_row public.people_invitation_import_jobs%rowtype;
  row_item jsonb;
  row_index integer := 0;
  row_count integer;
  record_type text;
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.people_invitation_import_jobs import_job
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

  delete from public.people_invitation_import_rows import_row
  where import_row.import_job_id = target_import_job_id;

  for row_item in
    select value from jsonb_array_elements(target_rows) as payload(value)
  loop
    row_index := row_index + 1;
    record_type := lower(btrim(coalesce(row_item ->> 'record_type', 'person')));

    insert into public.people_invitation_import_rows (
      import_job_id,
      organisation_id,
      row_number,
      record_type,
      input_payload,
      status
    )
    values (
      target_import_job_id,
      org_id,
      row_index,
      case when record_type = 'unit' then 'unit' else 'person' end,
      row_item,
      'pending'
    );
  end loop;

  update public.people_invitation_import_jobs
  set total_rows = row_count,
      valid_rows = 0,
      error_rows = 0,
      warning_rows = 0,
      created_invitation_rows = 0,
      skipped_rows = 0,
      failed_rows = 0,
      created_unit_rows = 0,
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function public.validate_people_invitation_import_job(
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
  job_row public.people_invitation_import_jobs%rowtype;
  import_row public.people_invitation_import_rows%rowtype;
  seen_emails jsonb := '{}'::jsonb;
  email_key text;
  row_status text;
  resolved jsonb;
  validation_field_errors jsonb;
  resolved_recipient_key text;
  valid_count integer := 0;
  error_count integer := 0;
  warning_count integer := 0;
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.people_invitation_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  for import_row in
    select import_row_table.*
    from public.people_invitation_import_rows import_row_table
    where import_row_table.import_job_id = target_import_job_id
    order by import_row_table.row_number
  loop
    row_status := 'valid';
    resolved := null;
    validation_field_errors := '[]'::jsonb;
    resolved_recipient_key := null;

    if import_row.record_type = 'unit' then
      select
        validation.row_status,
        validation.resolved,
        validation.field_errors
      into row_status, resolved, validation_field_errors
      from private.validate_people_invitation_import_unit_payload(
        org_id,
        actor_membership_id,
        import_row.input_payload
      ) as validation;
    else
      email_key := lower(btrim(coalesce(import_row.input_payload ->> 'email', '')));

      if email_key <> '' and seen_emails ? email_key then
        row_status := 'error';
        validation_field_errors := jsonb_build_array(
          jsonb_build_object(
            'field', 'email',
            'issue', format('Email ''%s'' is duplicated in this file.', email_key),
            'suggestion', 'Use a single row per email address.'
          )
        );
      elsif email_key <> ''
        and private.people_invitation_import_completed_for_email(org_id, email_key) then
        row_status := 'warning';
        validation_field_errors := jsonb_build_array(
          jsonb_build_object(
            'field', 'email',
            'issue', 'This colleague was already imported earlier and will be skipped.',
            'suggestion', 'Remove the row or leave it to record a deliberate skip.'
          )
        );
        resolved := jsonb_build_object('email', email_key, 'skip_import', true);
        resolved_recipient_key := email_key;
        seen_emails := seen_emails || jsonb_build_object(email_key, true);
      else
        if email_key <> '' then
          seen_emails := seen_emails || jsonb_build_object(email_key, true);
        end if;

        select
          validation.row_status,
          validation.resolved,
          validation.field_errors,
          validation.recipient_key
        into row_status, resolved, validation_field_errors, resolved_recipient_key
        from private.validate_people_invitation_import_person_payload(
          org_id,
          actor_membership_id,
          import_row.input_payload
        ) as validation;
      end if;
    end if;

    update public.people_invitation_import_rows import_row_target
    set status = row_status,
        resolved_payload = resolved,
        field_errors = validation_field_errors,
        recipient_key = resolved_recipient_key,
        error_code = case when row_status = 'error' then 'validation_failed' else null end,
        error_message = case when row_status = 'error' then 'Row failed validation.' else null end,
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

  update public.people_invitation_import_jobs
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
    'can_import', error_count = 0
  );
end;
$$;

create or replace function public.get_people_invitation_import_validation_rows(
  target_import_job_id uuid
)
returns table (
  row_number integer,
  record_type text,
  label text,
  status text,
  field_errors jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  return query
  select
    import_row.row_number,
    import_row.record_type,
    case
      when import_row.record_type = 'unit' then
        coalesce(import_row.input_payload ->> 'area_name', import_row.input_payload ->> 'unit_name', 'Unit row')
      else
        coalesce(
          import_row.input_payload ->> 'display_name',
          import_row.input_payload ->> 'name',
          import_row.input_payload ->> 'email',
          'Colleague row'
        )
    end as label,
    import_row.status,
    coalesce(import_row.field_errors, '[]'::jsonb) as field_errors
  from public.people_invitation_import_rows import_row
  inner join public.people_invitation_import_jobs import_job
    on import_job.id = import_row.import_job_id
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  order by import_row.row_number;
end;
$$;

create or replace function public.get_people_invitation_import_preview_rows(
  target_import_job_id uuid
)
returns table (
  row_number integer,
  record_type text,
  display_name text,
  email text,
  department text,
  site text,
  application_role text,
  access_scope_site text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  return query
  select
    import_row.row_number,
    import_row.record_type,
    coalesce(import_row.resolved_payload ->> 'display_name', import_row.input_payload ->> 'display_name', import_row.input_payload ->> 'name') as display_name,
    coalesce(import_row.resolved_payload ->> 'email', import_row.input_payload ->> 'email') as email,
    import_row.input_payload ->> 'department' as department,
    coalesce(import_row.input_payload ->> 'site', import_row.input_payload ->> 'primary_unit_path') as site,
    coalesce(import_row.input_payload ->> 'role', import_row.input_payload ->> 'application_role') as application_role,
    coalesce(import_row.input_payload ->> 'access_scope_site', import_row.input_payload ->> 'access_scope_unit_path') as access_scope_site
  from public.people_invitation_import_rows import_row
  inner join public.people_invitation_import_jobs import_job
    on import_job.id = import_row.import_job_id
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
    and import_row.record_type = 'person'
    and import_row.status in ('valid', 'warning')
  order by import_row.row_number;
end;
$$;

create or replace function public.start_people_invitation_import(
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
  job_row public.people_invitation_import_jobs%rowtype;
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.people_invitation_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  if job_row.status <> 'validated' or job_row.error_rows > 0 then
    raise exception 'import job cannot start until validation succeeds'
      using errcode = '55000';
  end if;

  update public.people_invitation_import_jobs
  set status = 'importing',
      started_at = coalesce(started_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function private.process_people_invitation_import_row(
  target_import_row_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  import_row public.people_invitation_import_rows%rowtype;
  resolved jsonb;
  invitation_id uuid;
  unit_id uuid;
  generated_code text;
begin
  select *
  into import_row
  from public.people_invitation_import_rows import_row_table
  where import_row_table.id = target_import_row_id
    and import_row_table.organisation_id = org_id
  for update;

  if import_row.id is null then
    raise exception 'import row does not exist'
      using errcode = 'P0002';
  end if;

  if import_row.status in ('completed', 'skipped') then
    return import_row.status;
  end if;

  if import_row.status not in ('valid', 'warning', 'importing', 'failed') then
    raise exception 'import row is not ready'
      using errcode = '55000';
  end if;

  resolved := import_row.resolved_payload;

  if import_row.record_type = 'unit' then
    if coalesce(resolved ->> 'skip_create', 'false')::boolean then
      update public.people_invitation_import_rows
      set status = 'skipped',
          created_unit_id = (resolved ->> 'existing_unit_id')::uuid,
          updated_at = statement_timestamp()
      where id = import_row.id;

      update public.people_invitation_import_jobs
      set skipped_rows = skipped_rows + 1,
          updated_at = statement_timestamp()
      where id = import_row.import_job_id;

      return 'skipped';
    end if;

    generated_code := coalesce(
      resolved ->> 'area_code',
      upper(left(regexp_replace(resolved ->> 'area_name', '[^A-Za-z0-9]+', '', 'g'), 8))
    );

    unit_id := public.create_organisation_unit(
      org_id,
      (resolved ->> 'parent_unit_id')::uuid,
      generated_code,
      resolved ->> 'area_name',
      resolved ->> 'unit_type'
    );

    update public.people_invitation_import_rows
    set status = 'completed',
        created_unit_id = unit_id,
        updated_at = statement_timestamp()
    where id = import_row.id;

    update public.people_invitation_import_jobs
    set created_unit_rows = created_unit_rows + 1,
        updated_at = statement_timestamp()
    where id = import_row.import_job_id;

    return 'completed';
  end if;

  if coalesce(resolved ->> 'skip_import', 'false')::boolean then
    update public.people_invitation_import_rows
    set status = 'skipped',
        updated_at = statement_timestamp()
    where id = import_row.id;

    update public.people_invitation_import_jobs
    set skipped_rows = skipped_rows + 1,
        updated_at = statement_timestamp()
    where id = import_row.import_job_id;

    return 'skipped';
  end if;

  begin
    invitation_id := public.issue_organisation_member_invitation_grants(
      'email',
      resolved ->> 'email',
      extensions.digest(encode(extensions.gen_random_bytes(32), 'base64'), 'sha256'),
      statement_timestamp() + interval '7 days',
      resolved -> 'offered_grants',
      resolved ->> 'display_name',
      nullif(resolved ->> 'job_function_id', '')::uuid,
      nullif(resolved ->> 'organisational_unit_id', '')::uuid
    );
  exception
    when unique_violation then
      update public.people_invitation_import_rows
      set status = 'skipped',
          error_code = 'duplicate_invitation',
          error_message = 'Invitation already exists.',
          updated_at = statement_timestamp()
      where id = import_row.id;

      update public.people_invitation_import_jobs
      set skipped_rows = skipped_rows + 1,
          updated_at = statement_timestamp()
      where id = import_row.import_job_id;

      return 'skipped';
    when others then
      update public.people_invitation_import_rows
      set status = 'failed',
          error_code = 'import_failed',
          error_message = sqlerrm,
          updated_at = statement_timestamp()
      where id = import_row.id;

      update public.people_invitation_import_jobs
      set failed_rows = failed_rows + 1,
          updated_at = statement_timestamp()
      where id = import_row.import_job_id;

      return 'failed';
  end;

  update public.people_invitation_import_rows
  set status = 'completed',
      created_invitation_id = invitation_id,
      recipient_key = lower(resolved ->> 'email'),
      updated_at = statement_timestamp()
  where id = import_row.id;

  update public.people_invitation_import_jobs
  set created_invitation_rows = created_invitation_rows + 1,
      updated_at = statement_timestamp()
  where id = import_row.import_job_id;

  return 'completed';
end;
$$;

create or replace function public.claim_people_invitation_import_batch(
  target_import_job_id uuid,
  target_batch_size integer default 25
)
returns table (
  import_row_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  candidate_row public.people_invitation_import_rows%rowtype;
  claimed integer := 0;
  outcome text;
  pending_count integer;
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  if target_batch_size < 1 or target_batch_size > 50 then
    raise exception 'batch size must be between 1 and 50'
      using errcode = '22023';
  end if;

  for candidate_row in
    select import_row_table.*
    from public.people_invitation_import_rows import_row_table
    where import_row_table.import_job_id = target_import_job_id
      and import_row_table.organisation_id = org_id
      and import_row_table.status in ('valid', 'warning')
    order by import_row_table.row_number
    for update skip locked
  loop
    update public.people_invitation_import_rows
    set status = 'importing',
        updated_at = statement_timestamp()
    where id = candidate_row.id;

    outcome := private.process_people_invitation_import_row(candidate_row.id);

    import_row_id := candidate_row.id;
    claimed := claimed + 1;
    return next;

    exit when claimed >= target_batch_size;
  end loop;

  select count(*)
  into pending_count
  from public.people_invitation_import_rows pending_row
  where pending_row.import_job_id = target_import_job_id
    and pending_row.status in ('valid', 'warning', 'importing');

  if pending_count = 0 then
    perform public.finalize_people_invitation_import_job(target_import_job_id);
  end if;
end;
$$;

create or replace function public.finalize_people_invitation_import_job(
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
  job_row public.people_invitation_import_jobs%rowtype;
  pending_count integer;
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.people_invitation_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id
  for update;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  select count(*)
  into pending_count
  from public.people_invitation_import_rows import_row
  where import_row.import_job_id = target_import_job_id
    and import_row.status in ('valid', 'warning', 'importing');

  if pending_count > 0 then
    return;
  end if;

  update public.people_invitation_import_jobs
  set status = case
        when failed_rows > 0 then 'completed_with_failures'
        else 'completed'
      end,
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = target_import_job_id;
end;
$$;

create or replace function public.get_people_invitation_import_progress(
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
  job_row public.people_invitation_import_jobs%rowtype;
  remaining_rows integer;
begin
  perform private.assert_people_invitation_import_authorised(org_id, actor_membership_id);

  select *
  into job_row
  from public.people_invitation_import_jobs import_job
  where import_job.id = target_import_job_id
    and import_job.organisation_id = org_id;

  if job_row.id is null then
    raise exception 'import job does not exist'
      using errcode = 'P0002';
  end if;

  select count(*)
  into remaining_rows
  from public.people_invitation_import_rows import_row
  where import_row.import_job_id = target_import_job_id
    and import_row.status in ('valid', 'warning', 'importing');

  return jsonb_build_object(
    'status', job_row.status,
    'total_rows', job_row.total_rows,
    'valid_rows', job_row.valid_rows,
    'error_rows', job_row.error_rows,
    'warning_rows', job_row.warning_rows,
    'created_invitation_rows', job_row.created_invitation_rows,
    'created_unit_rows', job_row.created_unit_rows,
    'skipped_rows', job_row.skipped_rows,
    'failed_rows', job_row.failed_rows,
    'remaining_rows', remaining_rows,
    'completed_at', job_row.completed_at
  );
end;
$$;

alter function private.assert_people_invitation_import_authorised(uuid, uuid) owner to lean_hub_private_owner;
alter function private.organisation_member_exists_for_email(uuid, text) owner to lean_hub_private_owner;
alter function private.pending_invitation_exists_for_email(uuid, text) owner to lean_hub_private_owner;
alter function private.people_invitation_import_completed_for_email(uuid, text) owner to lean_hub_private_owner;
alter function private.validate_people_invitation_import_person_payload(uuid, uuid, jsonb) owner to lean_hub_private_owner;
alter function private.validate_people_invitation_import_unit_payload(uuid, uuid, jsonb) owner to lean_hub_private_owner;
alter function private.process_people_invitation_import_row(uuid) owner to lean_hub_private_owner;

revoke all on function private.assert_people_invitation_import_authorised(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.organisation_member_exists_for_email(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.pending_invitation_exists_for_email(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.people_invitation_import_completed_for_email(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.validate_people_invitation_import_person_payload(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.validate_people_invitation_import_unit_payload(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.process_people_invitation_import_row(uuid) from public, anon, authenticated, service_role;

grant execute on function public.create_people_invitation_import_job(text, text) to authenticated;
grant execute on function public.submit_people_invitation_import_rows(uuid, jsonb) to authenticated;
grant execute on function public.validate_people_invitation_import_job(uuid) to authenticated;
grant execute on function public.get_people_invitation_import_validation_rows(uuid) to authenticated;
grant execute on function public.get_people_invitation_import_preview_rows(uuid) to authenticated;
grant execute on function public.start_people_invitation_import(uuid) to authenticated;
grant execute on function public.claim_people_invitation_import_batch(uuid, integer) to authenticated;
grant execute on function public.finalize_people_invitation_import_job(uuid) to authenticated;
grant execute on function public.get_people_invitation_import_progress(uuid) to authenticated;

grant execute on function public.issue_organisation_member_invitation_grants(
  text, text, bytea, timestamptz, jsonb, text, uuid, uuid
) to lean_hub_private_owner;

revoke all on function public.create_people_invitation_import_job(text, text) from public, anon;
revoke all on function public.submit_people_invitation_import_rows(uuid, jsonb) from public, anon;
revoke all on function public.validate_people_invitation_import_job(uuid) from public, anon;
revoke all on function public.get_people_invitation_import_validation_rows(uuid) from public, anon;
revoke all on function public.get_people_invitation_import_preview_rows(uuid) from public, anon;
revoke all on function public.start_people_invitation_import(uuid) from public, anon;
revoke all on function public.claim_people_invitation_import_batch(uuid, integer) from public, anon;
revoke all on function public.finalize_people_invitation_import_job(uuid) from public, anon;
revoke all on function public.get_people_invitation_import_progress(uuid) from public, anon;
