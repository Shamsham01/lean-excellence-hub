-- AUTO-GENERATED: python3 scripts/audit-private-write-grants.py
-- Revoke default PUBLIC execute on reachable private write RPCs.
-- Skips when a public SECURITY INVOKER wrapper with the EXACT same identity
-- arguments remains granted to authenticated.

do $$
declare
  proc_row record;
begin
  for proc_row in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('ack_workforce_import_credentials_exported', 'activate_problem_solving_case', 'add_benefit_source_link', 'add_benefit_to_overlap_group', 'add_ci_project_methodology_phase', 'add_problem_solving_participant', 'add_problem_solving_source_link', 'add_session_entry', 'add_skill_proficiency_level', 'add_skill_requirement', 'add_training_requirement', 'add_training_session_participant', 'approve_benefit_forecast', 'approve_project', 'archive_benefit_category', 'archive_workforce_import_job', 'assert_workforce_import_credential_export_access', 'assign_ci_project_team_member', 'award_recognition', 'begin_workforce_import_credential_export', 'bulk_record_training_completions', 'cancel_benefit', 'cancel_problem_solving_case', 'cancel_project', 'claim_ai_run_execution', 'claim_people_invitation_import_batch', 'claim_workforce_import_batch', 'close_problem_solving_case', 'complete_hypothesis_test', 'complete_problem_solving_session', 'complete_project', 'complete_project_phase', 'create_ai_coach_session', 'create_ai_session', 'create_analysis', 'create_benefit_category', 'create_benefit_draft', 'create_benefit_forecast_draft', 'create_benefit_forecast_successor_version', 'create_benefit_from_ci_project', 'create_benefit_from_suggestion', 'create_benefit_overlap_group', 'create_benefit_realisation_adjustment', 'create_benefit_realisation_entry', 'create_capability_action', 'create_ci_project_methodology_draft', 'create_ci_project_methodology_successor_version', 'create_ci_project_metric', 'create_containment', 'create_countermeasure', 'create_current_condition_item', 'create_effectiveness_check', 'create_hypothesis', 'create_hypothesis_test', 'create_improvement_project', 'create_improvement_project_from_suggestion', 'create_people_invitation_import_job', 'create_problem_solving_action', 'create_problem_solving_case_draft', 'create_problem_solving_lessons_learned', 'create_project_action', 'create_recognition_type', 'create_skill', 'create_skill_capability_set_draft', 'create_skill_proficiency_scale_draft', 'create_skill_setup_draft', 'create_training_course_draft', 'create_training_course_successor_version', 'create_training_curriculum_draft', 'create_training_curriculum_successor_version', 'create_training_session', 'create_training_setup_draft', 'create_workforce_import_job', 'discard_skill_setup_bundle', 'discard_training_setup_bundle', 'ensure_problem_solving_methods_provisioned', 'fail_ai_run', 'finalize_people_invitation_import_job', 'finish_ai_run', 'hold_project', 'link_benefit_evidence', 'link_ci_project_evidence', 'link_countermeasure_causes', 'link_node_hypothesis', 'link_problem_solving_evidence', 'mark_benefit_realised', 'mark_workforce_import_credentials_exported', 'move_problem_solving_stage', 'preauthorize_workforce_credential_reset', 'preauthorize_workforce_provision', 'publish_ci_project_methodology_version', 'publish_problem_solving_method_version', 'publish_skill_capability_set_version', 'publish_skill_proficiency_scale_version', 'publish_skill_setup_bundle', 'publish_training_course_version', 'publish_training_curriculum_version', 'publish_training_setup_bundle', 'record_ai_proposal_accepted', 'record_ai_run_provider_dispatch', 'record_benefit_validation', 'record_effectiveness_result', 'record_metric_measurement', 'record_skill_self_assessment', 'record_skill_validation', 'record_training_completion', 'recover_stale_ai_runs_for_problem_solving_case', 'reject_ai_proposal', 'reject_benefit_realisation_entry', 'reject_cause_hypothesis', 'reject_countermeasure', 'release_containment', 'remove_benefit_from_overlap_group', 'remove_benefit_source_link', 'remove_problem_solving_source_link', 'remove_training_requirement', 'remove_training_session_participant', 'replace_benefit_forecast_periods', 'resume_project', 'retry_workforce_import_failed_rows', 'return_benefit_to_draft', 'return_project_to_draft', 'revoke_recognition', 'revoke_training_completion', 'save_skill_setup_preparation', 'save_training_setup_preparation', 'select_countermeasure', 'start_ai_run', 'start_benefit_realisation', 'start_people_invitation_import', 'start_problem_solving_session', 'start_project', 'start_workforce_import_provisioning', 'submit_benefit', 'submit_benefit_forecast', 'submit_benefit_realisation_entry', 'submit_ci_project_charter', 'submit_people_invitation_import_rows', 'submit_project', 'submit_workforce_import_rows', 'sync_leanai_operational_chase_notifications', 'update_benefit_category', 'update_benefit_draft', 'update_benefit_forecast_draft', 'update_benefit_overlap_allocation', 'update_ci_project_draft', 'update_containment', 'update_hypothesis_status', 'update_organisation_ai_settings', 'update_problem_solving_case_draft', 'update_problem_solving_problem_statement', 'update_problem_solving_target_condition', 'upsert_benefit_reporting_settings', 'validate_benefit_realisation_entry', 'validate_people_invitation_import_job', 'validate_workforce_import_job', 'verify_cause_hypothesis', 'verify_current_condition_item', 'withdraw_benefit')
  loop
    if exists (
      select 1
      from pg_catalog.pg_proc pub
      join pg_catalog.pg_namespace pub_ns on pub_ns.oid = pub.pronamespace
      where pub_ns.nspname = 'public'
        and pub.proname = proc_row.function_name
        and pub.prosecdef = false
        and pg_catalog.pg_get_function_identity_arguments(pub.oid) = proc_row.args
        and pg_catalog.has_function_privilege('authenticated', pub.oid, 'EXECUTE')
    ) then
      continue;
    end if;
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      proc_row.schema_name,
      proc_row.function_name,
      proc_row.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to lean_hub_private_owner',
      proc_row.schema_name,
      proc_row.function_name,
      proc_row.args
    );
  end loop;
end $$;
