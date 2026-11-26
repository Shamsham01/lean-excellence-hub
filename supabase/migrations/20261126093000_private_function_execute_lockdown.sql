-- 20261126093000_private_function_execute_lockdown.sql
--
-- Follow-up to #406 / #424 (private-function EXECUTE cleanup).
--
-- Goal: no function in schema private is executable by PUBLIC or anon. Each
-- role that genuinely needs EXECUTE gets an explicit grant instead.
--
-- Source of truth: SENTINEL read-only catalog baseline of hosted project
-- zsadfvjtknbbfomlmttv, taken 2026-11-26 (926 private functions, 343 with
-- PUBLIC EXECUTE). Grant list = required_grants.csv (action=GRANT), derived from:
--   * exposed-schema (public) INVOKER callers explicitly granted to a role
--   * SECURITY DEFINER chains (callee runs as the definer's owner)
--   * RLS policies referencing private.* (all TO authenticated)
--   * trigger bodies (run as the DML role), check constraints, pg_cron (postgres)
--
-- What this migration does NOT do:
--   * change owners, bodies, search_path or SECURITY mode
--   * touch default privileges (separate follow-up)
--   * revoke pre-existing explicit authenticated/service_role grants (kept;
--     listed in summary.md for a later pass)
--   * add the 6 grants whose role lacks EXECUTE today (pre-existing gaps,
--     listed in summary.md; fixing them widens access and needs its own review)
--
-- postgres keeps access to lean_hub_private_owner-owned functions through its
-- inherit=true membership in lean_hub_private_owner; postgres-owned functions
-- keep their owner entry. Idempotent: REVOKE/GRANT are no-ops on re-run.

-- 1. Revoke PUBLIC and anon EXECUTE on every function in schema private.
--    Deterministic loop (ordered by signature) so functions created between
--    baseline and apply are also covered. Extension members are skipped.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
    order by p.oid::regprocedure::text
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
  end loop;
end
$$;

-- 2. lean_hub_private_owner: 42 functions.
--    Reason: definer chains: called (directly or via INVOKER callees) from bodies running as lean_hub_private_owner; owner is postgres so lhpo needs an explicit grant.
grant execute on function private.add_five_s_section(uuid,text,integer) to lean_hub_private_owner;
grant execute on function private.add_gemba_question(uuid,uuid,text,text,integer,boolean,boolean,text,jsonb) to lean_hub_private_owner;
grant execute on function private.add_gemba_section(uuid,text,integer) to lean_hub_private_owner;
grant execute on function private.ai_credit_release_for_organisation(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.ai_credit_settle_from_run_usage(uuid,integer,integer,integer,integer) to lean_hub_private_owner;
grant execute on function private.allocate_organisation_document_number(uuid,text,text) to lean_hub_private_owner;
grant execute on function private.assign_planner_action_to_creator(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.attachment_is_active_for_resource(uuid,uuid,uuid) to lean_hub_private_owner;
grant execute on function private.attachment_is_active_in_organisation(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.auth_email_is_confirmed(uuid,text) to lean_hub_private_owner;
grant execute on function private.auth_jwt() to lean_hub_private_owner;
grant execute on function private.auth_revoke_user_sessions(uuid) to lean_hub_private_owner;
grant execute on function private.auth_session_belongs_to(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.auth_uid() to lean_hub_private_owner;
grant execute on function private.auth_user_exists(uuid) to lean_hub_private_owner;
grant execute on function private.can_access_attachment_target(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_access_comment_target(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_assign_action(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_edit_five_s_audit(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_edit_gemba_walk(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_manage_suggestion_programmes(uuid) to lean_hub_private_owner;
grant execute on function private.can_read_action(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_read_five_s_audit(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_read_gemba_walk(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_reference_schedule_activity_resource(uuid,uuid,uuid) to lean_hub_private_owner;
grant execute on function private.can_update_action(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.create_action(text,text,text,uuid,uuid,timestamp with time zone,text) to lean_hub_private_owner;
grant execute on function private.create_planner_context_action(text,text,text,uuid,uuid,timestamp with time zone,text,text) to lean_hub_private_owner;
grant execute on function private.derive_five_s_result_status(numeric,jsonb) to lean_hub_private_owner;
grant execute on function private.is_five_s_audit_template(uuid) to lean_hub_private_owner;
grant execute on function private.is_five_s_audit_template_version(uuid) to lean_hub_private_owner;
grant execute on function private.is_gemba_walk_template(uuid) to lean_hub_private_owner;
grant execute on function private.is_gemba_walk_template_version(uuid) to lean_hub_private_owner;
grant execute on function private.is_recognition_recipient(uuid,uuid,uuid) to lean_hub_private_owner;
grant execute on function private.is_schedule_activity_resource_type(text) to lean_hub_private_owner;
grant execute on function private.leanai_ai_run_try_reserve(uuid,uuid,text,text,text,text) to lean_hub_private_owner;
grant execute on function private.reconcile_organisation_ai_credit_period_allowance(uuid) to lean_hub_private_owner;
grant execute on function private.schedule_activity_resource_type(uuid,uuid) to lean_hub_private_owner;
grant execute on function private.schedule_calendar_state(schedule_definitions) to lean_hub_private_owner;
grant execute on function private.schedule_recurrence_matches_date(jsonb,date,date,date) to lean_hub_private_owner;
grant execute on function private.schedule_weekday_matches(date,text) to lean_hub_private_owner;
grant execute on function private.upsert_gemba_walk_answer(uuid,uuid,boolean,text,numeric,date,jsonb) to lean_hub_private_owner;

-- 3. authenticated: 157 functions.
--    Reason: RLS policy helpers (TO authenticated) and private callees of public INVOKER wrappers granted to authenticated.
grant execute on function private.accept_organisation_invitation(bytea) to authenticated;
grant execute on function private.action_visible_to_current_member(uuid,uuid) to authenticated;
grant execute on function private.add_maturity_criterion(uuid,text,integer,text,text,text,numeric) to authenticated;
grant execute on function private.add_maturity_level(uuid,integer,text,text,text,text) to authenticated;
grant execute on function private.add_maturity_pillar(uuid,text,integer,text,numeric,text,text) to authenticated;
grant execute on function private.add_maturity_question(uuid,uuid,text,text,integer,boolean,boolean,text,jsonb) to authenticated;
grant execute on function private.add_role_permission(uuid,uuid,text) to authenticated;
grant execute on function private.add_template_question(uuid,uuid,text,text,integer,boolean,boolean,text,jsonb) to authenticated;
grant execute on function private.add_template_section(uuid,text,integer) to authenticated;
grant execute on function private.approve_maturity_assessment(uuid) to authenticated;
grant execute on function private.approve_suggestion(uuid,text,text,text,text,text) to authenticated;
grant execute on function private.begin_assessor_review(uuid) to authenticated;
grant execute on function private.calculate_maturity_assessment_scores(uuid) to authenticated;
grant execute on function private.can_access_attachment_target(uuid,uuid) to authenticated;
grant execute on function private.can_access_resource(uuid,uuid) to authenticated;
grant execute on function private.can_manage_ai_settings(uuid) to authenticated;
grant execute on function private.can_manage_skill_requirements(uuid) to authenticated;
grant execute on function private.can_manage_skills_catalog(uuid) to authenticated;
grant execute on function private.can_manage_suggestion_programmes(uuid) to authenticated;
grant execute on function private.can_manage_training_catalog(uuid) to authenticated;
grant execute on function private.can_manage_training_curriculum(uuid) to authenticated;
grant execute on function private.can_read_action(uuid,uuid) to authenticated;
grant execute on function private.can_read_ai_session(uuid,uuid) to authenticated;
grant execute on function private.can_read_benefit_categories(uuid) to authenticated;
grant execute on function private.can_read_ci_project(uuid,uuid) to authenticated;
grant execute on function private.can_read_ci_project_methodology_catalog(uuid) to authenticated;
grant execute on function private.can_read_five_s_audit(uuid,uuid) to authenticated;
grant execute on function private.can_read_five_s_catalog(uuid) to authenticated;
grant execute on function private.can_read_gemba_action_evidence(uuid,uuid) to authenticated;
grant execute on function private.can_read_gemba_catalog(uuid) to authenticated;
grant execute on function private.can_read_gemba_walk(uuid,uuid) to authenticated;
grant execute on function private.can_read_improvement_benefit(uuid,uuid) to authenticated;
grant execute on function private.can_read_improvement_suggestion(uuid,uuid) to authenticated;
grant execute on function private.can_read_job_functions(uuid) to authenticated;
grant execute on function private.can_read_maturity_assessment(uuid,uuid) to authenticated;
grant execute on function private.can_read_maturity_catalog(uuid) to authenticated;
grant execute on function private.can_read_membership_job_function_assignment(uuid,uuid,uuid) to authenticated;
grant execute on function private.can_read_problem_solving_case(uuid,uuid) to authenticated;
grant execute on function private.can_read_problem_solving_method_catalog(uuid) to authenticated;
grant execute on function private.can_read_recognition_award(uuid,uuid) to authenticated;
grant execute on function private.can_read_schedule_definition(uuid,uuid) to authenticated;
grant execute on function private.can_read_schedule_occurrence(uuid,uuid) to authenticated;
grant execute on function private.can_read_skill_assessment(uuid,uuid) to authenticated;
grant execute on function private.can_read_skills_catalog(uuid) to authenticated;
grant execute on function private.can_read_suggestion_evidence(uuid,uuid) to authenticated;
grant execute on function private.can_read_template_catalog(uuid) to authenticated;
grant execute on function private.can_read_template_submission(uuid,uuid) to authenticated;
grant execute on function private.can_read_training_catalog(uuid) to authenticated;
grant execute on function private.can_read_training_completion(uuid,uuid) to authenticated;
grant execute on function private.can_read_training_session(uuid,uuid) to authenticated;
grant execute on function private.cancel_maturity_assessment(uuid,text) to authenticated;
grant execute on function private.complete_action(uuid,text,integer) to authenticated;
grant execute on function private.complete_organisation_onboarding() to authenticated;
grant execute on function private.complete_self_assessment(uuid) to authenticated;
grant execute on function private.complete_template_submission(uuid) to authenticated;
grant execute on function private.confirm_attachment_upload(uuid) to authenticated;
grant execute on function private.create_action(text,text,text,uuid,uuid,timestamp with time zone,text) to authenticated;
grant execute on function private.create_ai_coach_session(text,text,uuid,text,text) to authenticated;
grant execute on function private.create_comment(uuid,text) to authenticated;
grant execute on function private.create_five_s_standard_draft_from_definition(text,jsonb,uuid[]) to authenticated;
grant execute on function private.create_founding_organisation(text,text,text,text,text,text,integer,text,text) to authenticated;
grant execute on function private.create_gemba_definition_draft_from_definition(text,jsonb,uuid[]) to authenticated;
grant execute on function private.create_maturity_action(text,uuid,uuid,uuid,uuid,text,text,timestamp with time zone) to authenticated;
grant execute on function private.create_maturity_model_draft(text,text) to authenticated;
grant execute on function private.create_maturity_model_draft_from_definition(text,jsonb) to authenticated;
grant execute on function private.create_maturity_model_successor_version(uuid) to authenticated;
grant execute on function private.create_organisation_unit(uuid,uuid,text,text,text) to authenticated;
grant execute on function private.create_protected_role_draft(uuid,text,text,text) to authenticated;
grant execute on function private.create_role_draft(uuid,text,text,text) to authenticated;
grant execute on function private.create_skill_setup_draft(text,jsonb) to authenticated;
grant execute on function private.create_template_draft(text,text) to authenticated;
grant execute on function private.create_template_submission(uuid) to authenticated;
grant execute on function private.create_template_successor_version(uuid) to authenticated;
grant execute on function private.current_can_found_organisation() to authenticated;
grant execute on function private.current_can_manage_billing() to authenticated;
grant execute on function private.current_identity_is_active() to authenticated;
grant execute on function private.current_identity_state() to authenticated;
grant execute on function private.current_membership_id(uuid) to authenticated;
grant execute on function private.current_organisation_id() to authenticated;
grant execute on function private.current_workforce_login_identifier() to authenticated;
grant execute on function private.deactivate_maturity_model_version(uuid) to authenticated;
grant execute on function private.decline_suggestion(uuid,text,text,text,text) to authenticated;
grant execute on function private.delete_maturity_criterion(uuid) to authenticated;
grant execute on function private.delete_maturity_model_draft_version(uuid) to authenticated;
grant execute on function private.delete_maturity_question(uuid) to authenticated;
grant execute on function private.discard_five_s_standard_draft(uuid) to authenticated;
grant execute on function private.discard_skill_setup_bundle(uuid) to authenticated;
grant execute on function private.edit_comment(uuid,text) to authenticated;
grant execute on function private.evaluate_organisation_setup_readiness() to authenticated;
grant execute on function private.expire_organisation_security_state(uuid) to authenticated;
grant execute on function private.get_current_organisation_billing() to authenticated;
grant execute on function private.get_leanai_contextual_snapshot() to authenticated;
grant execute on function private.get_leanai_journey_context() to authenticated;
grant execute on function private.get_organisation_ownership() to authenticated;
grant execute on function private.get_skills_matrix(integer,integer,uuid) to authenticated;
grant execute on function private.get_training_matrix(integer,integer,uuid) to authenticated;
grant execute on function private.grant_role_version(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function private.has_scoped_permission(uuid,text,uuid,uuid) to authenticated;
grant execute on function private.initiate_attachment_upload(uuid,text,text,bigint) to authenticated;
grant execute on function private.issue_organisation_invitation(uuid,text,text,bytea,timestamp with time zone,uuid,text,uuid) to authenticated;
grant execute on function private.link_criterion_question(uuid,uuid,boolean,jsonb) to authenticated;
grant execute on function private.link_maturity_evidence(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function private.list_maturity_assessment_scope_entities(uuid,text) to authenticated;
grant execute on function private.list_my_eligible_organisations() to authenticated;
grant execute on function private.list_organisation_ownership_transfer_targets() to authenticated;
grant execute on function private.mark_suggestion_implemented(uuid,text,text,text,text) to authenticated;
grant execute on function private.membership_can_access_unit_site(uuid,uuid,uuid) to authenticated;
grant execute on function private.membership_has_scoped_permission(uuid,uuid,text,uuid,uuid) to authenticated;
grant execute on function private.move_maturity_criterion(uuid,uuid,integer) to authenticated;
grant execute on function private.move_maturity_question(uuid,uuid,integer) to authenticated;
grant execute on function private.move_organisation_unit(uuid,uuid,uuid) to authenticated;
grant execute on function private.normalise_organisation_unit_semantic_scope(text) to authenticated;
grant execute on function private.organisation_requires_site_boundary(uuid) to authenticated;
grant execute on function private.park_suggestion(uuid,text,text,text,text) to authenticated;
grant execute on function private.preauthorize_workforce_provision(text,text,uuid,text,uuid,text,text,text,uuid,uuid,text) to authenticated;
grant execute on function private.preview_skill_setup_bundle_discard(uuid) to authenticated;
grant execute on function private.publish_maturity_model_version(uuid) to authenticated;
grant execute on function private.publish_official_maturity_result(uuid) to authenticated;
grant execute on function private.publish_role_version(uuid,uuid) to authenticated;
grant execute on function private.publish_skill_setup_bundle(uuid) to authenticated;
grant execute on function private.publish_template_version(uuid) to authenticated;
grant execute on function private.record_leanai_semantic_event(text,integer,text,text,uuid,jsonb,timestamp with time zone) to authenticated;
grant execute on function private.record_suggestion_review(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function private.remove_five_s_question(uuid) to authenticated;
grant execute on function private.remove_five_s_section(uuid) to authenticated;
grant execute on function private.reopen_action(uuid,text,integer) to authenticated;
grant execute on function private.reorder_maturity_criterion(uuid,text) to authenticated;
grant execute on function private.reorder_maturity_pillar(uuid,text) to authenticated;
grant execute on function private.reorder_maturity_question(uuid,text) to authenticated;
grant execute on function private.return_maturity_assessment_for_correction(uuid,text) to authenticated;
grant execute on function private.revoke_access_grant(uuid,uuid,text) to authenticated;
grant execute on function private.revoke_organisation_invitation(uuid,uuid,text) to authenticated;
grant execute on function private.save_skill_setup_preparation(text,text,jsonb) to authenticated;
grant execute on function private.set_five_s_section_weight(uuid,uuid,numeric) to authenticated;
grant execute on function private.set_maturity_model_version_assessment_scopes(uuid,text[]) to authenticated;
grant execute on function private.set_membership_status(uuid,uuid,text,text) to authenticated;
grant execute on function private.set_organisation_multi_site_intent(text) to authenticated;
grant execute on function private.set_organisation_unit_status(uuid,uuid,text,text) to authenticated;
grant execute on function private.start_maturity_assessment(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function private.storage_path_allows_evidence_upload(text) to authenticated;
grant execute on function private.submit_maturity_assessment(uuid) to authenticated;
grant execute on function private.suspend_or_close_organisation(uuid,text,text) to authenticated;
grant execute on function private.switch_organisation(uuid) to authenticated;
grant execute on function private.transfer_organisation_ownership(uuid) to authenticated;
grant execute on function private.transition_action_status(uuid,text,text,integer) to authenticated;
grant execute on function private.update_action(uuid,text,text,text,timestamp with time zone,boolean,integer) to authenticated;
grant execute on function private.update_maturity_criterion(uuid,text,integer,text,text,text,numeric) to authenticated;
grant execute on function private.update_maturity_level(uuid,integer,text,text,text,text) to authenticated;
grant execute on function private.update_maturity_model_version_metadata(uuid,text,text) to authenticated;
grant execute on function private.update_maturity_pillar(uuid,text,integer,text,text,numeric) to authenticated;
grant execute on function private.update_maturity_question(uuid,text,integer,text) to authenticated;
grant execute on function private.update_organisation_unit(uuid,uuid,text,text) to authenticated;
grant execute on function private.upsert_maturity_assessment_answer(uuid,uuid,boolean,text,numeric,date,jsonb) to authenticated;
grant execute on function private.upsert_maturity_assessment_criterion_note(uuid,uuid,text) to authenticated;
grant execute on function private.upsert_maturity_assessment_question_note(uuid,uuid,text) to authenticated;
grant execute on function private.upsert_template_answer(uuid,uuid,boolean,text,numeric,date,jsonb) to authenticated;
grant execute on function private.withdraw_suggestion_evidence(uuid) to authenticated;

-- 4. service_role: 43 functions.
--    Reason: private callees of public INVOKER worker RPCs granted to service_role (edge functions).
grant execute on function private.authentication_rate_limit_allows(text,text,bytea,integer,integer) to service_role;
grant execute on function private.claim_domain_events_for_notification_projector(integer,integer) to service_role;
grant execute on function private.claim_notification_deliveries(integer,integer) to service_role;
grant execute on function private.claim_platform_notifications(integer,integer) to service_role;
grant execute on function private.complete_domain_event(uuid,uuid,uuid) to service_role;
grant execute on function private.complete_notification_delivery(uuid,uuid,uuid,text) to service_role;
grant execute on function private.complete_platform_notification(uuid,uuid,text) to service_role;
grant execute on function private.consume_authentication_rate_limit(text,text,bytea,integer,integer,integer) to service_role;
grant execute on function private.consume_platform_admin_rate_limit(text,integer,integer,integer) to service_role;
grant execute on function private.create_notification_delivery(uuid,uuid,uuid,text,text) to service_role;
grant execute on function private.disable_workforce_identity(uuid,text) to service_role;
grant execute on function private.fail_domain_event_retryable(uuid,uuid,uuid,text,text) to service_role;
grant execute on function private.fail_domain_event_terminal(uuid,uuid,uuid,text,text) to service_role;
grant execute on function private.fail_notification_delivery_retryable(uuid,uuid,uuid,text) to service_role;
grant execute on function private.fail_notification_delivery_terminal(uuid,uuid,uuid,text) to service_role;
grant execute on function private.fail_platform_notification_retryable(uuid,uuid,text) to service_role;
grant execute on function private.fail_platform_notification_terminal(uuid,uuid,text) to service_role;
grant execute on function private.fail_workforce_provision(uuid,text) to service_role;
grant execute on function private.finalise_identity_enrolment(uuid) to service_role;
grant execute on function private.finalize_workforce_provision(uuid,uuid) to service_role;
grant execute on function private.find_workforce_auth_user_for_intent(uuid) to service_role;
grant execute on function private.get_notification_delivery_context(uuid,uuid,uuid) to service_role;
grant execute on function private.get_notification_delivery_provider_envelope(uuid,uuid) to service_role;
grant execute on function private.lookup_suggestion_author_membership_id(uuid,uuid) to service_role;
grant execute on function private.mark_workforce_provision_needs_remediation(uuid,text) to service_role;
grant execute on function private.platform_admin_is_active(uuid) to service_role;
grant execute on function private.platform_admin_leanai_cost_governance(uuid,text,text,uuid,timestamp with time zone,timestamp with time zone) to service_role;
grant execute on function private.platform_admin_notification_history(uuid,text,text,integer,integer) to service_role;
grant execute on function private.platform_admin_organisation_detail(uuid,text,text,uuid) to service_role;
grant execute on function private.platform_admin_organisation_directory(uuid,text,text,text,text,integer,integer) to service_role;
grant execute on function private.platform_admin_overview(uuid,text,text) to service_role;
grant execute on function private.provision_organisation(uuid,text,text,text,text,text) to service_role;
grant execute on function private.provision_workforce_identity(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function private.record_authentication_rate_limit_failure(text,text,bytea,integer,integer,integer) to service_role;
grant execute on function private.record_authentication_security_event(text,text,uuid) to service_role;
grant execute on function private.record_platform_admin_access(uuid,text,text,text,uuid,jsonb) to service_role;
grant execute on function private.record_platform_stripe_mode(uuid,boolean,text) to service_role;
grant execute on function private.record_workforce_auth_created(uuid,uuid) to service_role;
grant execute on function private.release_authentication_rate_limit(text,text,bytea,integer,integer) to service_role;
grant execute on function private.resolve_workforce_login(text,text) to service_role;
grant execute on function private.restore_organisation(uuid,text) to service_role;
grant execute on function private.revoke_identity_sessions(uuid,text) to service_role;
grant execute on function private.store_notification_delivery_provider_envelope(uuid,uuid,text,text,text,text,text,text,text) to service_role;

-- 5. Guard: fail the migration if anything in private is still PUBLIC/anon executable.
do $$
declare
  leftover integer;
begin
  select count(*) into leftover
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and (
      pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      or exists (
        select 1
        from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    );
  if leftover > 0 then
    raise exception 'private function EXECUTE lockdown incomplete: % functions still executable by PUBLIC/anon', leftover;
  end if;
end
$$;
