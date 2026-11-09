-- Restore approved delegation authority semantics (20400): manager override is not blocked
-- by another active reviewer; competing attempts are serialized in delegate_suggestion_approval.

create or replace function private.can_delegate_suggestion_approval(
  target_organisation_id uuid,
  target_suggestion_id uuid,
  target_actor_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.improvement_suggestions suggestion_row
    where suggestion_row.organisation_id = target_organisation_id
      and suggestion_row.id = target_suggestion_id
      and suggestion_row.status in ('submitted', 'under_review', 'parked')
      and (
        private.actor_has_suggestion_manager_override(
          target_organisation_id,
          target_suggestion_id,
          target_actor_membership_id
        )
        or (
          private.is_active_suggestion_reviewer(
            target_organisation_id,
            target_suggestion_id,
            target_actor_membership_id
          )
          and private.membership_can_act_on_suggestion_approval_jurisdiction(
            target_organisation_id,
            target_actor_membership_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
        or (
          not private.suggestion_has_active_reviewer(
            target_organisation_id,
            target_suggestion_id
          )
          and private.is_suggestion_primary_approver(
            target_organisation_id,
            target_suggestion_id,
            target_actor_membership_id
          )
          and private.membership_can_act_on_suggestion_approval_jurisdiction(
            target_organisation_id,
            target_actor_membership_id,
            suggestion_row.review_jurisdiction_unit_id
          )
        )
      )
  )
$$;

alter function private.can_delegate_suggestion_approval(uuid, uuid, uuid) owner to lean_hub_private_owner;
