-- Suggestion submission catalogue visibility and admin programme/category lifecycle.

create or replace function private.can_read_suggestion_submission_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_scoped_permission(
    target_organisation_id,
    'suggestions.read',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.submit',
    null,
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.read',
    private.current_membership_id(target_organisation_id),
    null
  )
  or private.has_scoped_permission(
    target_organisation_id,
    'suggestions.submit',
    private.current_membership_id(target_organisation_id),
    null
  )
  or exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key in ('suggestions.read', 'suggestions.submit')
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id =
        private.current_membership_id(target_organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
      and grant_row.scope_type = 'unit_subtree'
  )
$$;

create or replace function private.suggestion_programme_version_visible_for_submission(
  target_organisation_id uuid,
  target_applicable_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_applicable_unit_id is null then
      private.can_read_suggestion_submission_catalog(target_organisation_id)
    else
      private.has_scoped_permission(
        target_organisation_id,
        'suggestions.read',
        null,
        null
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.submit',
        null,
        null
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.read',
        null,
        target_applicable_unit_id
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.submit',
        null,
        target_applicable_unit_id
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.read',
        private.current_membership_id(target_organisation_id),
        null
      )
      or private.has_scoped_permission(
        target_organisation_id,
        'suggestions.submit',
        private.current_membership_id(target_organisation_id),
        null
      )
  end
$$;

create or replace function private.get_available_suggestion_submission_configuration()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null then
    raise exception 'organisation context is required' using errcode = '42501';
  end if;

  if private.current_membership_id(org_id) is null then
    raise exception 'membership context is required' using errcode = '42501';
  end if;

  if not private.can_read_suggestion_submission_catalog(org_id) then
    raise exception 'suggestion submission configuration is not authorised'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'programmes',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'programme_version_id', version_row.id,
            'programme_name', programme_row.name,
            'submission_guidance', version_row.submission_guidance
          )
          order by programme_row.name, version_row.version_number
        )
        from public.suggestion_programme_versions version_row
        join public.suggestion_programmes programme_row
          on programme_row.organisation_id = version_row.organisation_id
         and programme_row.id = version_row.programme_id
        where version_row.organisation_id = org_id
          and version_row.lifecycle = 'published'
          and programme_row.status = 'active'
          and private.suggestion_programme_version_visible_for_submission(
            org_id,
            version_row.applicable_unit_id
          )
      ),
      '[]'::jsonb
    ),
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'category_id', category_row.id,
            'category_name', category_row.name
          )
          order by category_row.display_order, category_row.name
        )
        from public.suggestion_categories category_row
        where category_row.organisation_id = org_id
          and category_row.status = 'active'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.get_available_suggestion_submission_configuration()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_available_suggestion_submission_configuration()
$$;

grant execute on function public.get_available_suggestion_submission_configuration()
  to authenticated;
revoke all on function public.get_available_suggestion_submission_configuration()
  from public, anon;

-- Align draft creation with published/active catalogue rules and unit applicability.
create or replace function private.create_suggestion_draft(
  target_programme_version_id uuid,
  target_category_id uuid,
  target_title text,
  target_problem_or_opportunity text,
  target_proposed_idea text,
  target_expected_benefit_summary text default null,
  target_target_unit_id uuid default null,
  target_template_submission_id uuid default null
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
  origin_unit_id uuid;
  new_suggestion_id uuid;
  programme_version_row public.suggestion_programme_versions%rowtype;
  programme_row public.suggestion_programmes%rowtype;
  category_row public.suggestion_categories%rowtype;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion draft creation is not authorised' using errcode = '42501';
  end if;

  origin_unit_id := private.membership_primary_organisational_unit_id(org_id, actor_membership_id);
  if origin_unit_id is null then
    raise exception 'author has no primary organisational unit' using errcode = '22023';
  end if;

  if not private.can_submit_suggestion_to_unit(org_id, origin_unit_id) then
    raise exception 'suggestion draft creation is not authorised' using errcode = '42501';
  end if;

  select version_table.*
  into programme_version_row
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = target_programme_version_id
    and version_table.lifecycle = 'published';

  if not found then
    raise exception 'programme version is not available for submission' using errcode = '22023';
  end if;

  select programme_table.*
  into programme_row
  from public.suggestion_programmes programme_table
  where programme_table.organisation_id = org_id
    and programme_table.id = programme_version_row.programme_id;

  if programme_row.status <> 'active' then
    raise exception 'programme is not active for submission' using errcode = '22023';
  end if;

  if not private.suggestion_programme_version_visible_for_submission(
    org_id,
    programme_version_row.applicable_unit_id
  ) then
    raise exception 'programme version is not available for submission' using errcode = '42501';
  end if;

  select category_table.*
  into category_row
  from public.suggestion_categories category_table
  where category_table.organisation_id = org_id
    and category_table.id = target_category_id;

  if not found or category_row.status <> 'active' then
    raise exception 'category is not active for submission' using errcode = '22023';
  end if;

  if target_target_unit_id is not null
    and not private.can_submit_suggestion_to_unit(org_id, target_target_unit_id) then
    raise exception 'target unit is not within submit scope' using errcode = '42501';
  end if;

  new_suggestion_id := private.register_resource_record(
    org_id, 'improvement_suggestion', gen_random_uuid(), actor_membership_id
  );

  insert into public.improvement_suggestions (
    id, organisation_id, programme_version_id, title,
    problem_or_opportunity, proposed_idea, expected_benefit_summary,
    category_id, origin_unit_id, target_unit_id,
    review_jurisdiction_unit_id, author_membership_id,
    template_submission_id, status
  ) values (
    new_suggestion_id, org_id, target_programme_version_id, btrim(target_title),
    btrim(target_problem_or_opportunity), btrim(target_proposed_idea), target_expected_benefit_summary,
    target_category_id, origin_unit_id, target_target_unit_id,
    coalesce(target_target_unit_id, origin_unit_id), actor_membership_id,
    target_template_submission_id, 'draft'
  );

  perform private.append_suggestion_status_history(
    org_id, new_suggestion_id, 'draft', 'draft', actor_membership_id, 'created'
  );

  return new_suggestion_id;
end;
$$;

-- Reject submission against deactivated catalogue rows.
create or replace function private.submit_suggestion(target_suggestion_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  programme_row public.suggestion_programmes%rowtype;
  category_row public.suggestion_categories%rowtype;
  origin_unit_row public.organisation_units%rowtype;
  target_unit_row public.organisation_units%rowtype;
  programme_version_row public.suggestion_programme_versions%rowtype;
  submission_version_id uuid;
  allocated_suggestion_number text;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select suggestion_table.*
  into suggestion_row
  from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id
  for update;

  if not found or suggestion_row.status <> 'draft' then
    raise exception 'suggestion is not submittable' using errcode = '55000';
  end if;

  if suggestion_row.author_membership_id <> actor_membership_id then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  if not private.can_submit_suggestion_to_unit(org_id, suggestion_row.origin_unit_id) then
    raise exception 'suggestion submit is not authorised' using errcode = '42501';
  end if;

  select version_table.*
  into programme_version_row
  from public.suggestion_programme_versions version_table
  where version_table.organisation_id = org_id
    and version_table.id = suggestion_row.programme_version_id
    and version_table.lifecycle = 'published';

  if not found then
    raise exception 'programme version is not published' using errcode = '22023';
  end if;

  select programme_table.* into programme_row
  from public.suggestion_programmes programme_table
  where programme_table.organisation_id = org_id
    and programme_table.id = programme_version_row.programme_id;

  if programme_row.status <> 'active' then
    raise exception 'programme is not active for submission' using errcode = '22023';
  end if;

  select category_table.* into category_row
  from public.suggestion_categories category_table
  where category_table.organisation_id = org_id
    and category_table.id = suggestion_row.category_id;

  if category_row.status <> 'active' then
    raise exception 'category is not active for submission' using errcode = '22023';
  end if;

  select unit_table.* into origin_unit_row
  from public.organisation_units unit_table
  where unit_table.organisation_id = org_id
    and unit_table.id = suggestion_row.origin_unit_id;

  if suggestion_row.target_unit_id is not null then
    select unit_table.* into target_unit_row
    from public.organisation_units unit_table
    where unit_table.organisation_id = org_id
      and unit_table.id = suggestion_row.target_unit_id;
  end if;

  if programme_version_row.template_version_id is not null then
    if suggestion_row.template_submission_id is null then
      raise exception 'template submission is required' using errcode = '22023';
    end if;

    select submission_table.template_version_id
    into submission_version_id
    from public.template_submissions submission_table
    where submission_table.organisation_id = org_id
      and submission_table.id = suggestion_row.template_submission_id;

    if submission_version_id is distinct from programme_version_row.template_version_id then
      raise exception 'template submission does not match programme template version' using errcode = '22023';
    end if;

    perform private.complete_template_submission(suggestion_row.template_submission_id);
  end if;

  allocated_suggestion_number := private.allocate_organisation_document_number(
    org_id, 'improvement_suggestion', 'IDEA'
  );

  update public.improvement_suggestions suggestion_table
  set status = 'submitted',
      suggestion_number = allocated_suggestion_number,
      programme_name_snapshot = programme_row.name,
      programme_code_snapshot = programme_row.code,
      category_name_snapshot = category_row.name,
      category_code_snapshot = category_row.code,
      origin_unit_name_snapshot = origin_unit_row.name,
      origin_unit_code_snapshot = origin_unit_row.code,
      target_unit_name_snapshot = target_unit_row.name,
      target_unit_code_snapshot = target_unit_row.code,
      review_jurisdiction_unit_id = coalesce(suggestion_row.target_unit_id, suggestion_row.origin_unit_id),
      submitted_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where suggestion_table.organisation_id = org_id
    and suggestion_table.id = target_suggestion_id;

  perform private.append_suggestion_status_history(
    org_id, target_suggestion_id, 'draft', 'submitted', actor_membership_id, 'submitted'
  );

  perform private.append_business_audit(org_id, 'suggestion.submitted', target_suggestion_id, 'succeeded', '{}'::jsonb);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionSubmitted', target_suggestion_id::text, '{}'::jsonb);

  return true;
end;
$$;

create or replace function private.update_suggestion_programme(
  target_programme_id uuid,
  target_name text,
  target_description text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme update is not authorised' using errcode = '42501';
  end if;

  update public.suggestion_programmes programme_row
  set
    name = btrim(target_name),
    description = target_description,
    updated_at = statement_timestamp()
  where programme_row.organisation_id = org_id
    and programme_row.id = target_programme_id;

  if not found then
    raise exception 'programme not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.deactivate_suggestion_programme(
  target_programme_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme deactivation is not authorised' using errcode = '42501';
  end if;

  update public.suggestion_programmes programme_row
  set
    status = 'deactivated',
    updated_at = statement_timestamp()
  where programme_row.organisation_id = org_id
    and programme_row.id = target_programme_id
    and programme_row.status = 'active';

  if not found then
    raise exception 'programme not found or not active' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.reactivate_suggestion_programme(
  target_programme_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme reactivation is not authorised' using errcode = '42501';
  end if;

  update public.suggestion_programmes programme_row
  set
    status = 'active',
    updated_at = statement_timestamp()
  where programme_row.organisation_id = org_id
    and programme_row.id = target_programme_id
    and programme_row.status = 'deactivated';

  if not found then
    raise exception 'programme not found or not deactivated' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.delete_suggestion_programme_draft(
  target_programme_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'programme deletion is not authorised' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.suggestion_programme_versions version_row
    where version_row.organisation_id = org_id
      and version_row.programme_id = target_programme_id
      and version_row.lifecycle <> 'draft'
  ) then
    raise exception 'only unpublished draft programmes may be deleted' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.improvement_suggestions suggestion_row
    join public.suggestion_programme_versions version_row
      on version_row.organisation_id = suggestion_row.organisation_id
     and version_row.id = suggestion_row.programme_version_id
    where version_row.organisation_id = org_id
      and version_row.programme_id = target_programme_id
  ) then
    raise exception 'programme is referenced by suggestions and cannot be deleted' using errcode = '55000';
  end if;

  delete from public.suggestion_programme_versions version_row
  where version_row.organisation_id = org_id
    and version_row.programme_id = target_programme_id;

  delete from public.suggestion_programmes programme_row
  where programme_row.organisation_id = org_id
    and programme_row.id = target_programme_id;

  if not found then
    raise exception 'programme not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.update_suggestion_category(
  target_category_id uuid,
  target_name text default null,
  target_description text default null,
  target_display_order integer default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'category update is not authorised' using errcode = '42501';
  end if;

  update public.suggestion_categories category_row
  set
    name = coalesce(btrim(target_name), category_row.name),
    description = coalesce(target_description, category_row.description),
    display_order = coalesce(target_display_order, category_row.display_order),
    updated_at = statement_timestamp()
  where category_row.organisation_id = org_id
    and category_row.id = target_category_id;

  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.deactivate_suggestion_category(
  target_category_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'category deactivation is not authorised' using errcode = '42501';
  end if;

  update public.suggestion_categories category_row
  set
    status = 'deactivated',
    updated_at = statement_timestamp()
  where category_row.organisation_id = org_id
    and category_row.id = target_category_id
    and category_row.status = 'active';

  if not found then
    raise exception 'category not found or not active' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.reactivate_suggestion_category(
  target_category_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'category reactivation is not authorised' using errcode = '42501';
  end if;

  update public.suggestion_categories category_row
  set
    status = 'active',
    updated_at = statement_timestamp()
  where category_row.organisation_id = org_id
    and category_row.id = target_category_id
    and category_row.status = 'deactivated';

  if not found then
    raise exception 'category not found or not deactivated' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function private.delete_suggestion_category(
  target_category_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
begin
  if org_id is null or not private.can_manage_suggestion_programmes(org_id) then
    raise exception 'category deletion is not authorised' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = org_id
      and suggestion_row.category_id = target_category_id
  ) then
    raise exception 'category is referenced by suggestions; deactivate instead' using errcode = '55000';
  end if;

  delete from public.suggestion_categories category_row
  where category_row.organisation_id = org_id
    and category_row.id = target_category_id;

  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

create or replace function public.update_suggestion_programme(
  target_programme_id uuid,
  target_name text,
  target_description text default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_suggestion_programme(
    target_programme_id,
    target_name,
    target_description
  )
$$;

create or replace function public.deactivate_suggestion_programme(
  target_programme_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.deactivate_suggestion_programme(target_programme_id)
$$;

create or replace function public.reactivate_suggestion_programme(
  target_programme_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reactivate_suggestion_programme(target_programme_id)
$$;

create or replace function public.delete_suggestion_programme_draft(
  target_programme_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.delete_suggestion_programme_draft(target_programme_id)
$$;

create or replace function public.update_suggestion_category(
  target_category_id uuid,
  target_name text default null,
  target_description text default null,
  target_display_order integer default null
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.update_suggestion_category(
    target_category_id,
    target_name,
    target_description,
    target_display_order
  )
$$;

create or replace function public.deactivate_suggestion_category(
  target_category_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.deactivate_suggestion_category(target_category_id)
$$;

create or replace function public.reactivate_suggestion_category(
  target_category_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.reactivate_suggestion_category(target_category_id)
$$;

create or replace function public.delete_suggestion_category(
  target_category_id uuid
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select private.delete_suggestion_category(target_category_id)
$$;

grant execute on function public.update_suggestion_programme(uuid, text, text) to authenticated;
grant execute on function public.deactivate_suggestion_programme(uuid) to authenticated;
grant execute on function public.reactivate_suggestion_programme(uuid) to authenticated;
grant execute on function public.delete_suggestion_programme_draft(uuid) to authenticated;
grant execute on function public.update_suggestion_category(uuid, text, text, integer) to authenticated;
grant execute on function public.deactivate_suggestion_category(uuid) to authenticated;
grant execute on function public.reactivate_suggestion_category(uuid) to authenticated;
grant execute on function public.delete_suggestion_category(uuid) to authenticated;

revoke all on function public.update_suggestion_programme(uuid, text, text) from public, anon;
revoke all on function public.deactivate_suggestion_programme(uuid) from public, anon;
revoke all on function public.reactivate_suggestion_programme(uuid) from public, anon;
revoke all on function public.delete_suggestion_programme_draft(uuid) from public, anon;
revoke all on function public.update_suggestion_category(uuid, text, text, integer) from public, anon;
revoke all on function public.deactivate_suggestion_category(uuid) from public, anon;
revoke all on function public.reactivate_suggestion_category(uuid) from public, anon;
revoke all on function public.delete_suggestion_category(uuid) from public, anon;

alter function private.can_read_suggestion_submission_catalog(uuid) owner to lean_hub_private_owner;
alter function private.suggestion_programme_version_visible_for_submission(uuid, uuid) owner to lean_hub_private_owner;
alter function private.get_available_suggestion_submission_configuration() owner to lean_hub_private_owner;
alter function private.update_suggestion_programme(uuid, text, text) owner to lean_hub_private_owner;
alter function private.deactivate_suggestion_programme(uuid) owner to lean_hub_private_owner;
alter function private.reactivate_suggestion_programme(uuid) owner to lean_hub_private_owner;
alter function private.delete_suggestion_programme_draft(uuid) owner to lean_hub_private_owner;
alter function private.update_suggestion_category(uuid, text, text, integer) owner to lean_hub_private_owner;
alter function private.deactivate_suggestion_category(uuid) owner to lean_hub_private_owner;
alter function private.reactivate_suggestion_category(uuid) owner to lean_hub_private_owner;
alter function private.delete_suggestion_category(uuid) owner to lean_hub_private_owner;
