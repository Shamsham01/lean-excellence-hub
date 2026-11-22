-- Extend people directory rows for HR-style listing (filters, identity, unit, dates).

drop function if exists public.get_people_directory(text, integer, integer, boolean);

create or replace function public.get_people_directory(
  target_search text default null,
  target_page integer default 1,
  target_page_size integer default 25,
  target_include_inactive boolean default false,
  target_unit_id uuid default null,
  target_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  offset_value integer;
  effective_page_size integer;
  can_include_inactive boolean := false;
  can_read_identity boolean := false;
  normalized_status text;
begin
  if org_id is null
    or not private.can_read_people_directory(org_id) then
    raise exception 'people directory is not authorised'
      using errcode = '42501';
  end if;

  can_include_inactive := target_include_inactive
    and private.has_scoped_permission(org_id, 'memberships.manage', null, null);

  can_read_identity := private.has_scoped_permission(
    org_id,
    'memberships.read',
    null,
    null
  );

  normalized_status := nullif(btrim(target_status), '');

  if normalized_status is not null
    and normalized_status not in ('all', 'active', 'pending', 'inactive') then
    normalized_status := null;
  end if;

  effective_page_size := least(greatest(coalesce(target_page_size, 25), 1), 100);
  offset_value := greatest(target_page - 1, 0) * effective_page_size;

  return (
    with directory_rows as (
      select
        membership_row.id as membership_id,
        coalesce(membership_row.display_name, profile_row.display_name) as display_name,
        membership_row.job_title,
        assignment_row.job_function_name_snapshot as job_function_name,
        assignment_row.job_function_code_snapshot as job_function_code,
        membership_row.status,
        profile_row.avatar_url,
        assignment_row.organisational_unit_id as primary_unit_id,
        unit_row.name as primary_unit_name,
        unit_row.code as primary_unit_code,
        coalesce(membership_row.activated_at, membership_row.created_at) as joined_at,
        workforce_alias.canonical_alias as username,
        case
          when can_read_identity and workforce_alias.canonical_alias is null
            then auth_user.email
          else null
        end as auth_login_email,
        case
          when can_read_identity
            or membership_row.id = private.current_membership_id(org_id) then
            contact_row.contact_address
          else null
        end as notification_email,
        case
          when can_read_identity then workforce_alias.canonical_alias is not null
          else false
        end as is_workforce_account
      from public.organisation_memberships membership_row
      left join public.profiles profile_row
        on profile_row.user_id = membership_row.user_id
      left join public.membership_job_function_assignments assignment_row
        on assignment_row.organisation_id = org_id
       and assignment_row.membership_id = membership_row.id
       and assignment_row.is_primary = true
       and assignment_row.valid_from <= statement_timestamp()
       and (
         assignment_row.valid_to is null
         or assignment_row.valid_to > statement_timestamp()
       )
      left join public.organisation_units unit_row
        on unit_row.organisation_id = org_id
       and unit_row.id = assignment_row.organisational_unit_id
      left join private.workforce_aliases workforce_alias
        on workforce_alias.organisation_id = org_id
       and workforce_alias.membership_id = membership_row.id
       and workforce_alias.alias_type = 'username'
       and workforce_alias.status = 'active'
      left join auth.users auth_user
        on auth_user.id = membership_row.user_id
      left join public.membership_notification_contacts contact_row
        on contact_row.organisation_id = org_id
       and contact_row.membership_id = membership_row.id
       and contact_row.channel_type = 'email'
       and contact_row.status = 'active'
      where membership_row.organisation_id = org_id
        and private.can_read_membership_capability_profile(
          org_id,
          membership_row.id
        )
        and (
          case
            when normalized_status = 'active' then
              membership_row.status = 'active'
            when normalized_status = 'pending' then
              membership_row.status = 'pending'
            when normalized_status = 'inactive' then
              membership_row.status = 'inactive'
              and can_include_inactive
            when normalized_status = 'all' then
              membership_row.status in ('active', 'pending')
              or (
                membership_row.status = 'inactive'
                and can_include_inactive
              )
            when normalized_status is null
              and target_include_inactive
              and can_include_inactive then
              membership_row.status in ('active', 'inactive')
            else membership_row.status = 'active'
          end
        )
        and (
          target_unit_id is null
          or assignment_row.organisational_unit_id = target_unit_id
        )
        and (
          target_search is null
          or coalesce(membership_row.display_name, profile_row.display_name, '')
            ilike '%' || btrim(target_search) || '%'
          or (
            can_read_identity
            and (
              coalesce(auth_user.email, '') ilike '%' || btrim(target_search) || '%'
              or coalesce(workforce_alias.canonical_alias, '')
                ilike '%' || btrim(target_search) || '%'
              or coalesce(contact_row.contact_address, '')
                ilike '%' || btrim(target_search) || '%'
            )
          )
        )
    )
    select jsonb_build_object(
      'people',
        coalesce(
          (
            select jsonb_agg(row_payload.row_data)
            from (
              select jsonb_build_object(
                'membership_id', directory_row.membership_id,
                'display_name', directory_row.display_name,
                'job_title', directory_row.job_title,
                'job_function_name', directory_row.job_function_name,
                'job_function_code', directory_row.job_function_code,
                'status', directory_row.status,
                'avatar_url', directory_row.avatar_url,
                'primary_unit_id', directory_row.primary_unit_id,
                'primary_unit_name', directory_row.primary_unit_name,
                'primary_unit_code', directory_row.primary_unit_code,
                'joined_at', directory_row.joined_at,
                'username', directory_row.username,
                'email',
                  case
                    when directory_row.is_workforce_account then null
                    else directory_row.auth_login_email
                  end,
                'notification_email', directory_row.notification_email,
                'is_workforce_account', directory_row.is_workforce_account
              ) as row_data
              from directory_rows directory_row
              order by
                case when directory_row.status = 'active' then 0 else 1 end,
                directory_row.display_name
              limit effective_page_size offset offset_value
            ) row_payload
          ),
          '[]'::jsonb
        ),
      'total_count', (select count(*)::integer from directory_rows),
      'page', target_page,
      'page_size', effective_page_size,
      'include_inactive', can_include_inactive,
      'can_read_identity', can_read_identity
    )
  );
end;
$$;

grant execute on function public.get_people_directory(
  text,
  integer,
  integer,
  boolean,
  uuid,
  text
) to authenticated;
revoke all on function public.get_people_directory(
  text,
  integer,
  integer,
  boolean,
  uuid,
  text
) from public, anon;
