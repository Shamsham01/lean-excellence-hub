-- Milestone 9: can_access_resource extension and CI project from suggestion.

create or replace function private.can_access_resource(
  target_organisation_id uuid,
  target_resource_id uuid
)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare resource_row public.resource_records%rowtype;
begin
  select resource_registry.* into resource_row from public.resource_records resource_registry
  where resource_registry.organisation_id = target_organisation_id
    and resource_registry.id = target_resource_id and resource_registry.retired_at is null;
  if not found then return false; end if;
  case resource_row.resource_type
    when 'action' then return private.can_read_action(target_organisation_id, target_resource_id);
    when 'template' then return private.has_scoped_permission(target_organisation_id, 'templates.read', null, null);
    when 'template_submission' then return private.can_read_template_submission(target_organisation_id, target_resource_id);
    when 'attachment' then return private.can_access_attachment_target(target_organisation_id, target_resource_id);
    when 'comment' then return private.can_access_comment_target(target_organisation_id, target_resource_id);
    when 'maturity_model' then return private.can_read_maturity_catalog(target_organisation_id);
    when 'maturity_assessment' then return private.can_read_maturity_assessment(target_organisation_id, target_resource_id);
    when 'schedule_definition' then return private.can_read_schedule_definition(target_organisation_id, target_resource_id);
    when 'five_s_standard' then return private.can_read_five_s_catalog(target_organisation_id);
    when 'five_s_audit' then return private.can_read_five_s_audit(target_organisation_id, target_resource_id);
    when 'gemba_definition' then return private.can_read_gemba_catalog(target_organisation_id);
    when 'gemba_walk' then return private.can_read_gemba_walk(target_organisation_id, target_resource_id);
    when 'training_course' then return private.can_read_training_catalog(target_organisation_id);
    when 'training_session' then return private.can_read_training_session(target_organisation_id, target_resource_id);
    when 'training_completion' then return private.can_read_training_completion(target_organisation_id, target_resource_id);
    when 'skill' then return private.can_read_skills_catalog(target_organisation_id);
    when 'skill_assessment' then return private.can_read_skill_assessment(target_organisation_id, target_resource_id);
    when 'ci_project' then return private.can_read_ci_project(target_organisation_id, target_resource_id);
    when 'improvement_suggestion' then return private.can_read_improvement_suggestion(target_organisation_id, target_resource_id);
    when 'recognition_award' then return private.can_read_recognition_award(target_organisation_id, target_resource_id);
    else return false;
  end case;
end; $$;

create or replace function private.create_improvement_project_from_suggestion(target_suggestion_id uuid)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  org_id uuid := private.current_organisation_id();
  actor_membership_id uuid := private.current_membership_id(org_id);
  suggestion_row public.improvement_suggestions%rowtype;
  new_project_id uuid;
begin
  if org_id is null or actor_membership_id is null then
    raise exception 'project creation from suggestion is not authorised' using errcode = '42501';
  end if;
  select suggestion_table.* into suggestion_row from public.improvement_suggestions suggestion_table
  where suggestion_table.organisation_id = org_id and suggestion_table.id = target_suggestion_id;
  if not found then raise exception 'suggestion not found' using errcode = 'P0002'; end if;
  if suggestion_row.status not in ('accepted', 'implementing') then
    raise exception 'suggestion is not eligible for project creation' using errcode = '55000';
  end if;
  if not private.can_read_improvement_suggestion(org_id, target_suggestion_id) then
    raise exception 'project creation from suggestion is not authorised' using errcode = '42501';
  end if;
  new_project_id := private.create_improvement_project(
    suggestion_row.title,
    suggestion_row.review_jurisdiction_unit_id,
    suggestion_row.problem_or_opportunity,
    suggestion_row.proposed_idea,
    suggestion_row.expected_benefit_summary,
    target_suggestion_id
  );
  insert into public.suggestion_implementation_links (
    organisation_id, suggestion_id, implementation_resource_id, implementation_role, created_by_membership_id
  ) values (org_id, target_suggestion_id, new_project_id, 'ci_project', actor_membership_id);
  perform private.enqueue_domain_event(org_id, target_suggestion_id, 'SuggestionProjectCreated', new_project_id::text, '{}'::jsonb);
  return new_project_id;
end; $$;

create or replace function public.create_improvement_project_from_suggestion(target_suggestion_id uuid)
returns uuid language sql volatile security definer set search_path = ''
as $$ select private.create_improvement_project_from_suggestion(target_suggestion_id) $$;

grant execute on function public.create_improvement_project_from_suggestion(uuid) to authenticated;
alter function private.create_improvement_project_from_suggestion(uuid) owner to lean_hub_private_owner;
alter function private.can_access_resource(uuid, uuid) owner to lean_hub_private_owner;
