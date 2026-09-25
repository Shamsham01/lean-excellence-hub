-- SEC-RPC-001: least-privilege anonymous EXECUTE and mutable search_path hygiene.
--
-- Confirmed against hosted + local catalogs on main @ ec42d8a (PR #148):
-- * 56 Security Advisor anon SECURITY DEFINER warnings
-- * 3 mutable search_path helpers in private
--
-- Keep intentional anonymous invitation bootstrap:
--   public.preview_organisation_invitation(bytea)
--   public.prepare_organisation_invitation_signup_binding(bytea)
--
-- Defer platform-managed public.rls_auto_enable() (event trigger, not LEH-owned).
-- Do not change leaked-password Auth or apply hosted mutations from this file.

-- ---------------------------------------------------------------------------
-- Privilege regression: workforce provision worker RPC
-- DROP/CREATE in 20260920120000 lost the original service-role-only grants.
-- ---------------------------------------------------------------------------

revoke all on function public.get_workforce_provision_intent_for_worker(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_workforce_provision_intent_for_worker(uuid, uuid)
  to service_role;

revoke all on function private.get_workforce_provision_intent_for_worker(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Unnecessarily exposed operational RPCs
-- Default PUBLIC EXECUTE remains on these SECURITY DEFINER entry points.
-- Private implementations already fail closed without a live session.
-- ---------------------------------------------------------------------------

revoke all on function public.add_benefit_source_link(uuid, uuid, text)
  from public, anon;
grant execute on function public.add_benefit_source_link(uuid, uuid, text)
  to authenticated;

revoke all on function public.add_benefit_to_overlap_group(uuid, uuid, numeric, text)
  from public, anon;
grant execute on function public.add_benefit_to_overlap_group(uuid, uuid, numeric, text)
  to authenticated;

revoke all on function public.add_five_s_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric
) from public, anon;
grant execute on function public.add_five_s_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb, boolean, jsonb, numeric
) to authenticated;

revoke all on function public.add_five_s_section(uuid, text, integer)
  from public, anon;
grant execute on function public.add_five_s_section(uuid, text, integer)
  to authenticated;

revoke all on function public.add_gemba_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) from public, anon;
grant execute on function public.add_gemba_question(
  uuid, uuid, text, text, integer, boolean, boolean, text, jsonb
) to authenticated;

revoke all on function public.add_gemba_section(uuid, text, integer)
  from public, anon;
grant execute on function public.add_gemba_section(uuid, text, integer)
  to authenticated;

revoke all on function public.add_suggestion_contributor(uuid, uuid, text)
  from public, anon;
grant execute on function public.add_suggestion_contributor(uuid, uuid, text)
  to authenticated;

revoke all on function public.assign_suggestion_reviewer(uuid, uuid)
  from public, anon;
grant execute on function public.assign_suggestion_reviewer(uuid, uuid)
  to authenticated;

revoke all on function public.award_recognition(
  uuid, text, text, uuid, text, uuid[], uuid, text[]
) from public, anon;
grant execute on function public.award_recognition(
  uuid, text, text, uuid, text, uuid[], uuid, text[]
) to authenticated;

revoke all on function public.begin_suggestion_implementation(uuid)
  from public, anon;
grant execute on function public.begin_suggestion_implementation(uuid)
  to authenticated;

revoke all on function public.begin_suggestion_review(uuid)
  from public, anon;
grant execute on function public.begin_suggestion_review(uuid)
  to authenticated;

revoke all on function public.complete_five_s_audit(uuid)
  from public, anon;
grant execute on function public.complete_five_s_audit(uuid)
  to authenticated;

revoke all on function public.complete_gemba_walk(uuid, text)
  from public, anon;
grant execute on function public.complete_gemba_walk(uuid, text)
  to authenticated;

revoke all on function public.create_benefit_draft(
  text, uuid, text, text, text, text, uuid, uuid, boolean, uuid
) from public, anon;
grant execute on function public.create_benefit_draft(
  text, uuid, text, text, text, text, uuid, uuid, boolean, uuid
) to authenticated;

revoke all on function public.create_benefit_from_ci_project(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) from public, anon;
grant execute on function public.create_benefit_from_ci_project(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) to authenticated;

revoke all on function public.create_benefit_from_suggestion(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) from public, anon;
grant execute on function public.create_benefit_from_suggestion(
  uuid, text, text, text, text, text, uuid, uuid, uuid
) to authenticated;

revoke all on function public.create_benefit_overlap_group(text, text)
  from public, anon;
grant execute on function public.create_benefit_overlap_group(text, text)
  to authenticated;

revoke all on function public.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) from public, anon;
grant execute on function public.create_five_s_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) to authenticated;

revoke all on function public.create_five_s_finding(
  uuid, text, uuid, uuid, text, text, boolean
) from public, anon;
grant execute on function public.create_five_s_finding(
  uuid, text, uuid, uuid, text, text, boolean
) to authenticated;

revoke all on function public.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) from public, anon;
grant execute on function public.create_gemba_action(
  text, uuid, uuid, uuid, uuid, text, text, timestamptz
) to authenticated;

revoke all on function public.create_improvement_project(
  text, uuid, text, text, text, uuid
) from public, anon;
grant execute on function public.create_improvement_project(
  text, uuid, text, text, text, uuid
) to authenticated;

revoke all on function public.create_improvement_project_from_suggestion(uuid)
  from public, anon;
grant execute on function public.create_improvement_project_from_suggestion(uuid)
  to authenticated;

revoke all on function public.create_recognition_type(text, text, text)
  from public, anon;
grant execute on function public.create_recognition_type(text, text, text)
  to authenticated;

revoke all on function public.create_suggestion_action(
  uuid, text, text, text, timestamptz, text
) from public, anon;
grant execute on function public.create_suggestion_action(
  uuid, text, text, text, timestamptz, text
) to authenticated;

revoke all on function public.create_suggestion_category(text, text, text, integer)
  from public, anon;
grant execute on function public.create_suggestion_category(text, text, text, integer)
  to authenticated;

revoke all on function public.create_suggestion_draft(
  uuid, uuid, text, text, text, text, uuid, uuid
) from public, anon;
grant execute on function public.create_suggestion_draft(
  uuid, uuid, text, text, text, text, uuid, uuid
) to authenticated;

revoke all on function public.create_suggestion_programme_draft(text, text, text)
  from public, anon;
grant execute on function public.create_suggestion_programme_draft(text, text, text)
  to authenticated;

revoke all on function public.create_suggestion_programme_successor_version(uuid)
  from public, anon;
grant execute on function public.create_suggestion_programme_successor_version(uuid)
  to authenticated;

revoke all on function public.get_membership_improvement_contribution(uuid)
  from public, anon;
grant execute on function public.get_membership_improvement_contribution(uuid)
  to authenticated;

revoke all on function public.get_membership_recognition(uuid)
  from public, anon;
grant execute on function public.get_membership_recognition(uuid)
  to authenticated;

revoke all on function public.get_recognition_feed(integer, integer)
  from public, anon;
grant execute on function public.get_recognition_feed(integer, integer)
  to authenticated;

revoke all on function public.get_suggestion_review_queue()
  from public, anon;
grant execute on function public.get_suggestion_review_queue()
  to authenticated;

revoke all on function public.get_suggestions_list(text, text, integer, integer)
  from public, anon;
grant execute on function public.get_suggestions_list(text, text, integer, integer)
  to authenticated;

revoke all on function public.get_suggestions_overview()
  from public, anon;
grant execute on function public.get_suggestions_overview()
  to authenticated;

revoke all on function public.link_five_s_evidence(uuid, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.link_five_s_evidence(uuid, uuid, uuid, uuid, uuid)
  to authenticated;

revoke all on function public.member_has_permission(text)
  from public, anon;
grant execute on function public.member_has_permission(text)
  to authenticated, lean_hub_private_owner;

revoke all on function public.publish_five_s_standard_version(uuid)
  from public, anon;
grant execute on function public.publish_five_s_standard_version(uuid)
  to authenticated;

revoke all on function public.publish_gemba_definition_version(uuid)
  from public, anon;
grant execute on function public.publish_gemba_definition_version(uuid)
  to authenticated;

revoke all on function public.publish_suggestion_programme_version(uuid)
  from public, anon;
grant execute on function public.publish_suggestion_programme_version(uuid)
  to authenticated;

revoke all on function public.remove_benefit_from_overlap_group(uuid, uuid, text)
  from public, anon;
grant execute on function public.remove_benefit_from_overlap_group(uuid, uuid, text)
  to authenticated;

revoke all on function public.remove_benefit_source_link(uuid, uuid)
  from public, anon;
grant execute on function public.remove_benefit_source_link(uuid, uuid)
  to authenticated;

revoke all on function public.revoke_recognition(uuid, text)
  from public, anon;
grant execute on function public.revoke_recognition(uuid, text)
  to authenticated;

revoke all on function public.start_five_s_audit(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.start_five_s_audit(uuid, uuid, uuid)
  to authenticated;

revoke all on function public.start_gemba_walk(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.start_gemba_walk(uuid, uuid, uuid)
  to authenticated;

revoke all on function public.submit_ci_project_charter(uuid)
  from public, anon;
grant execute on function public.submit_ci_project_charter(uuid)
  to authenticated;

revoke all on function public.submit_suggestion(uuid)
  from public, anon;
grant execute on function public.submit_suggestion(uuid)
  to authenticated;

revoke all on function public.update_benefit_draft(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, date, date, numeric, text, numeric, date, date, boolean
) from public, anon;
grant execute on function public.update_benefit_draft(
  uuid, text, text, text, text, text, uuid, uuid, uuid, text, date, date, numeric, text, numeric, date, date, boolean
) to authenticated;

revoke all on function public.update_benefit_overlap_allocation(uuid, uuid, numeric, text)
  from public, anon;
grant execute on function public.update_benefit_overlap_allocation(uuid, uuid, numeric, text)
  to authenticated;

revoke all on function public.update_suggestion_draft(
  uuid, text, text, text, text, uuid, uuid, uuid
) from public, anon;
grant execute on function public.update_suggestion_draft(
  uuid, text, text, text, text, uuid, uuid, uuid
) to authenticated;

revoke all on function public.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) from public, anon;
grant execute on function public.upsert_five_s_audit_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to authenticated;

revoke all on function public.upsert_gemba_walk_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) from public, anon;
grant execute on function public.upsert_gemba_walk_answer(
  uuid, uuid, boolean, text, numeric, date, jsonb
) to authenticated;

revoke all on function public.withdraw_suggestion(uuid, text)
  from public, anon;
grant execute on function public.withdraw_suggestion(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Mutable search_path: immutable private helpers with no relation lookups
-- ---------------------------------------------------------------------------

alter function private.invitation_default_ttl()
  set search_path = '';
alter function private.mask_invitation_email(text)
  set search_path = '';
alter function private.role_responsibility_kind(text, text, boolean)
  set search_path = '';
