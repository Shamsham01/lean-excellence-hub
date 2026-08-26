-- Milestone 8/9 closure: unit-scoped catalog read and recognition recipient visibility.

create or replace function private.can_read_ci_project_methodology_catalog(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.access_grants grant_row
    join public.role_versions role_version
      on role_version.organisation_id = grant_row.organisation_id
     and role_version.id = grant_row.role_version_id
     and role_version.status = 'published'
    join public.roles role_row
      on role_row.organisation_id = role_version.organisation_id
     and role_row.id = role_version.role_id
     and role_row.status = 'active'
    join public.role_permissions role_permission
      on role_permission.organisation_id = role_version.organisation_id
     and role_permission.role_version_id = role_version.id
     and role_permission.permission_key in ('projects.read', 'projects.manage')
    where grant_row.organisation_id = target_organisation_id
      and grant_row.grantee_membership_id =
        private.current_membership_id(target_organisation_id)
      and grant_row.status = 'active'
      and (
        grant_row.expires_at is null
        or grant_row.expires_at > statement_timestamp()
      )
  )
$$;

create or replace function private.can_read_recognition_award(
  target_organisation_id uuid,
  target_award_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recognition_awards award_row
    where award_row.organisation_id = target_organisation_id
      and award_row.id = target_award_id
      and (
        private.is_recognition_recipient(
          target_organisation_id,
          target_award_id,
          private.current_membership_id(target_organisation_id)
        )
        or private.has_scoped_permission(target_organisation_id, 'recognition.manage', null, null)
        or private.has_scoped_permission(target_organisation_id, 'recognition.read', null, null)
        or private.has_scoped_permission(
          target_organisation_id,
          'recognition.read',
          null,
          award_row.organisational_unit_id
        )
        or (
          private.has_scoped_permission(
            target_organisation_id,
            'recognition.read',
            private.current_membership_id(target_organisation_id),
            null
          )
          and (
            award_row.visibility = 'organisation'
            or (
              award_row.visibility = 'unit'
              and private.has_scoped_permission(
                target_organisation_id,
                'recognition.read',
                null,
                award_row.organisational_unit_id
              )
            )
            or (
              award_row.visibility = 'recipient_only'
              and (
                private.is_recognition_recipient(
                  target_organisation_id,
                  target_award_id,
                  private.current_membership_id(target_organisation_id)
                )
                or award_row.awarded_by_membership_id =
                  private.current_membership_id(target_organisation_id)
              )
            )
          )
        )
      )
  )
$$;

alter function private.can_read_ci_project_methodology_catalog(uuid)
  owner to lean_hub_private_owner;
