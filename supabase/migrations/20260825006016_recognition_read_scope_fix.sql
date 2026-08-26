-- Recognition read: organisation-visible awards visible to any member with recognition.read grant.

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
        or public.member_has_permission('recognition.manage')
        or (
          public.member_has_permission('recognition.read')
          and (
            award_row.visibility = 'organisation'
            or private.has_scoped_permission(
              target_organisation_id,
              'recognition.read',
              null,
              award_row.organisational_unit_id
            )
          )
        )
      )
  )
$$;

alter function private.can_read_recognition_award(uuid, uuid)
  owner to lean_hub_private_owner;
