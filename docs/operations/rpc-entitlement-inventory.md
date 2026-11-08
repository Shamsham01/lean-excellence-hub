# Public write RPCs — Professional module entitlement gates

Inventory: **160** authenticated write RPCs across Professional-only modules; **40** gated, **120** ungated.

| Function | Module | Gated | Migration (if gated) |
| --- | --- | --- | --- |
| `ack_workforce_import_credentials_exported` | people_hr | no |  |
| `activate_problem_solving_case` | problem_solving | yes | 20261108237500_billing_12_problem_solving_activate_restore.sql |
| `add_benefit_source_link` | benefits | no |  |
| `add_benefit_to_overlap_group` | benefits | no |  |
| `add_ci_project_methodology_phase` | projects | no |  |
| `add_problem_solving_participant` | problem_solving | no |  |
| `add_problem_solving_source_link` | problem_solving | no |  |
| `add_session_entry` | problem_solving | no |  |
| `add_skill_proficiency_level` | skills | no |  |
| `add_skill_requirement` | skills | no |  |
| `add_training_requirement` | training | no |  |
| `add_training_session_participant` | training | no |  |
| `approve_benefit_forecast` | benefits | no |  |
| `approve_project` | projects | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `archive_benefit_category` | benefits | no |  |
| `archive_workforce_import_job` | people_hr | no |  |
| `assert_workforce_import_credential_export_access` | people_hr | no |  |
| `assign_ci_project_team_member` | projects | no |  |
| `award_recognition` | recognition | yes | 20261108237000_billing_11_recognition_module_gates.sql |
| `begin_workforce_import_credential_export` | people_hr | no |  |
| `bulk_record_training_completions` | training | no |  |
| `cancel_benefit` | benefits | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `cancel_problem_solving_case` | problem_solving | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `cancel_project` | projects | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `claim_ai_run_execution` | ai | no |  |
| `claim_people_invitation_import_batch` | people_hr | no |  |
| `claim_workforce_import_batch` | people_hr | no |  |
| `close_problem_solving_case` | problem_solving | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `complete_hypothesis_test` | problem_solving | no |  |
| `complete_problem_solving_session` | problem_solving | no |  |
| `complete_project` | projects | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `complete_project_phase` | projects | no |  |
| `create_ai_coach_session` | ai | yes | 20261108236000_billing_10_ai_session_module_gates.sql |
| `create_ai_session` | ai | yes | 20261108236000_billing_10_ai_session_module_gates.sql |
| `create_analysis` | problem_solving | no |  |
| `create_benefit_category` | benefits | no |  |
| `create_benefit_draft` | benefits | yes | 20261108231000_billing_04_module_gates_and_wrapper_fix.sql |
| `create_benefit_forecast_draft` | benefits | no |  |
| `create_benefit_forecast_successor_version` | benefits | no |  |
| `create_benefit_from_ci_project` | benefits | no |  |
| `create_benefit_from_suggestion` | benefits | no |  |
| `create_benefit_overlap_group` | benefits | no |  |
| `create_benefit_realisation_adjustment` | benefits | no |  |
| `create_benefit_realisation_entry` | benefits | no |  |
| `create_capability_action` | training | no |  |
| `create_ci_project_methodology_draft` | projects | no |  |
| `create_ci_project_methodology_successor_version` | projects | no |  |
| `create_ci_project_metric` | projects | no |  |
| `create_containment` | problem_solving | no |  |
| `create_countermeasure` | problem_solving | no |  |
| `create_current_condition_item` | problem_solving | no |  |
| `create_effectiveness_check` | problem_solving | no |  |
| `create_hypothesis` | problem_solving | no |  |
| `create_hypothesis_test` | problem_solving | no |  |
| `create_improvement_project` | projects | yes | 20261108231000_billing_04_module_gates_and_wrapper_fix.sql |
| `create_improvement_project_from_suggestion` | projects | yes | 20261108231000_billing_04_module_gates_and_wrapper_fix.sql |
| `create_people_invitation_import_job` | people_hr | no |  |
| `create_problem_solving_action` | problem_solving | no |  |
| `create_problem_solving_case_draft` | problem_solving | yes | 20261108231000_billing_04_module_gates_and_wrapper_fix.sql |
| `create_problem_solving_lessons_learned` | problem_solving | no |  |
| `create_project_action` | projects | no |  |
| `create_recognition_type` | recognition | yes | 20261108237000_billing_11_recognition_module_gates.sql |
| `create_skill` | skills | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `create_skill_capability_set_draft` | skills | no |  |
| `create_skill_proficiency_scale_draft` | skills | no |  |
| `create_skill_setup_draft` | skills | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `create_training_course_draft` | training | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `create_training_course_successor_version` | training | no |  |
| `create_training_curriculum_draft` | training | no |  |
| `create_training_curriculum_successor_version` | training | no |  |
| `create_training_session` | training | no |  |
| `create_training_setup_draft` | training | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `create_workforce_import_job` | people_hr | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `discard_skill_setup_bundle` | skills | no |  |
| `discard_training_setup_bundle` | training | no |  |
| `ensure_problem_solving_methods_provisioned` | problem_solving | no |  |
| `fail_ai_run` | ai | no |  |
| `finalize_people_invitation_import_job` | people_hr | no |  |
| `finish_ai_run` | ai | no |  |
| `hold_project` | projects | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `link_benefit_evidence` | benefits | no |  |
| `link_ci_project_evidence` | projects | no |  |
| `link_countermeasure_causes` | problem_solving | no |  |
| `link_node_hypothesis` | problem_solving | no |  |
| `link_problem_solving_evidence` | problem_solving | no |  |
| `mark_benefit_realised` | benefits | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `mark_workforce_import_credentials_exported` | people_hr | no |  |
| `move_problem_solving_stage` | problem_solving | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `preauthorize_workforce_credential_reset` | people_hr | no |  |
| `preauthorize_workforce_provision` | people_hr | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `publish_ci_project_methodology_version` | projects | no |  |
| `publish_problem_solving_method_version` | problem_solving | no |  |
| `publish_skill_capability_set_version` | skills | no |  |
| `publish_skill_proficiency_scale_version` | skills | no |  |
| `publish_skill_setup_bundle` | skills | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `publish_training_course_version` | training | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `publish_training_curriculum_version` | training | no |  |
| `publish_training_setup_bundle` | training | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `record_ai_proposal_accepted` | ai | no |  |
| `record_ai_run_provider_dispatch` | ai | no |  |
| `record_benefit_validation` | benefits | no |  |
| `record_effectiveness_result` | problem_solving | no |  |
| `record_leanai_semantic_event` | ai | no |  |
| `record_metric_measurement` | projects | no |  |
| `record_skill_self_assessment` | skills | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `record_skill_validation` | skills | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `record_training_completion` | training | no |  |
| `recover_stale_ai_runs_for_problem_solving_case` | ai | no |  |
| `reject_ai_proposal` | ai | no |  |
| `reject_benefit_realisation_entry` | benefits | no |  |
| `reject_cause_hypothesis` | problem_solving | no |  |
| `reject_countermeasure` | problem_solving | no |  |
| `release_containment` | problem_solving | no |  |
| `remove_benefit_from_overlap_group` | benefits | no |  |
| `remove_benefit_source_link` | benefits | no |  |
| `remove_problem_solving_source_link` | problem_solving | no |  |
| `remove_training_requirement` | training | no |  |
| `remove_training_session_participant` | training | no |  |
| `replace_benefit_forecast_periods` | benefits | no |  |
| `resume_project` | projects | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `retry_workforce_import_failed_rows` | people_hr | no |  |
| `return_benefit_to_draft` | benefits | no |  |
| `return_project_to_draft` | projects | no |  |
| `revoke_recognition` | recognition | yes | 20261108237000_billing_11_recognition_module_gates.sql |
| `revoke_training_completion` | training | no |  |
| `save_skill_setup_preparation` | skills | no |  |
| `save_training_setup_preparation` | training | no |  |
| `select_countermeasure` | problem_solving | no |  |
| `start_ai_run` | ai | yes | 20261108231000_billing_04_module_gates_and_wrapper_fix.sql |
| `start_benefit_realisation` | benefits | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `start_people_invitation_import` | people_hr | no |  |
| `start_problem_solving_session` | problem_solving | no |  |
| `start_project` | projects | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `start_workforce_import_provisioning` | people_hr | no |  |
| `submit_benefit` | benefits | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `submit_benefit_forecast` | benefits | no |  |
| `submit_benefit_realisation_entry` | benefits | no |  |
| `submit_ci_project_charter` | projects | yes | 20261108235000_billing_09_extended_module_gates.sql |
| `submit_people_invitation_import_rows` | people_hr | no |  |
| `submit_project` | projects | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `submit_workforce_import_rows` | people_hr | no |  |
| `sync_leanai_operational_chase_notifications` | ai | no |  |
| `update_benefit_category` | benefits | no |  |
| `update_benefit_draft` | benefits | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `update_benefit_forecast_draft` | benefits | no |  |
| `update_benefit_overlap_allocation` | benefits | no |  |
| `update_ci_project_draft` | projects | yes | 20261108232000_billing_06_module_mutation_gates.sql |
| `update_containment` | problem_solving | no |  |
| `update_hypothesis_status` | problem_solving | no |  |
| `update_organisation_ai_settings` | ai | no |  |
| `update_problem_solving_case_draft` | problem_solving | no |  |
| `update_problem_solving_problem_statement` | problem_solving | no |  |
| `update_problem_solving_target_condition` | problem_solving | no |  |
| `upsert_benefit_reporting_settings` | benefits | no |  |
| `validate_benefit_realisation_entry` | benefits | no |  |
| `validate_people_invitation_import_job` | people_hr | no |  |
| `validate_workforce_import_job` | people_hr | no |  |
| `verify_cause_hypothesis` | problem_solving | no |  |
| `verify_current_condition_item` | problem_solving | no |  |
| `withdraw_benefit` | benefits | yes | 20261108235000_billing_09_extended_module_gates.sql |

## Ungated public write RPCs (priority)

### ai
- `claim_ai_run_execution`
- `fail_ai_run`
- `finish_ai_run`
- `record_ai_proposal_accepted`
- `record_ai_run_provider_dispatch`
- `record_leanai_semantic_event`
- `recover_stale_ai_runs_for_problem_solving_case`
- `reject_ai_proposal`
- `sync_leanai_operational_chase_notifications`
- `update_organisation_ai_settings`

### benefits
- `add_benefit_source_link`
- `add_benefit_to_overlap_group`
- `approve_benefit_forecast`
- `archive_benefit_category`
- `create_benefit_category`
- `create_benefit_forecast_draft`
- `create_benefit_forecast_successor_version`
- `create_benefit_from_ci_project`
- `create_benefit_from_suggestion`
- `create_benefit_overlap_group`
- `create_benefit_realisation_adjustment`
- `create_benefit_realisation_entry`
- `link_benefit_evidence`
- `record_benefit_validation`
- `reject_benefit_realisation_entry`
- `remove_benefit_from_overlap_group`
- `remove_benefit_source_link`
- `replace_benefit_forecast_periods`
- `return_benefit_to_draft`
- `submit_benefit_forecast`
- `submit_benefit_realisation_entry`
- `update_benefit_category`
- `update_benefit_forecast_draft`
- `update_benefit_overlap_allocation`
- `upsert_benefit_reporting_settings`
- `validate_benefit_realisation_entry`

### people_hr
- `ack_workforce_import_credentials_exported`
- `archive_workforce_import_job`
- `assert_workforce_import_credential_export_access`
- `begin_workforce_import_credential_export`
- `claim_people_invitation_import_batch`
- `claim_workforce_import_batch`
- `create_people_invitation_import_job`
- `finalize_people_invitation_import_job`
- `mark_workforce_import_credentials_exported`
- `preauthorize_workforce_credential_reset`
- `retry_workforce_import_failed_rows`
- `start_people_invitation_import`
- `start_workforce_import_provisioning`
- `submit_people_invitation_import_rows`
- `submit_workforce_import_rows`
- `validate_people_invitation_import_job`
- `validate_workforce_import_job`

### problem_solving
- `add_problem_solving_participant`
- `add_problem_solving_source_link`
- `add_session_entry`
- `complete_hypothesis_test`
- `complete_problem_solving_session`
- `create_analysis`
- `create_containment`
- `create_countermeasure`
- `create_current_condition_item`
- `create_effectiveness_check`
- `create_hypothesis`
- `create_hypothesis_test`
- `create_problem_solving_action`
- `create_problem_solving_lessons_learned`
- `ensure_problem_solving_methods_provisioned`
- `link_countermeasure_causes`
- `link_node_hypothesis`
- `link_problem_solving_evidence`
- `publish_problem_solving_method_version`
- `record_effectiveness_result`
- `reject_cause_hypothesis`
- `reject_countermeasure`
- `release_containment`
- `remove_problem_solving_source_link`
- `select_countermeasure`
- `start_problem_solving_session`
- `update_containment`
- `update_hypothesis_status`
- `update_problem_solving_case_draft`
- `update_problem_solving_problem_statement`
- `update_problem_solving_target_condition`
- `verify_cause_hypothesis`
- `verify_current_condition_item`

### projects
- `add_ci_project_methodology_phase`
- `assign_ci_project_team_member`
- `complete_project_phase`
- `create_ci_project_methodology_draft`
- `create_ci_project_methodology_successor_version`
- `create_ci_project_metric`
- `create_project_action`
- `link_ci_project_evidence`
- `publish_ci_project_methodology_version`
- `record_metric_measurement`
- `return_project_to_draft`

### skills
- `add_skill_proficiency_level`
- `add_skill_requirement`
- `create_skill_capability_set_draft`
- `create_skill_proficiency_scale_draft`
- `discard_skill_setup_bundle`
- `publish_skill_capability_set_version`
- `publish_skill_proficiency_scale_version`
- `save_skill_setup_preparation`

### training
- `add_training_requirement`
- `add_training_session_participant`
- `bulk_record_training_completions`
- `create_capability_action`
- `create_training_course_successor_version`
- `create_training_curriculum_draft`
- `create_training_curriculum_successor_version`
- `create_training_session`
- `discard_training_setup_bundle`
- `publish_training_curriculum_version`
- `record_training_completion`
- `remove_training_requirement`
- `remove_training_session_participant`
- `revoke_training_completion`
- `save_training_setup_preparation`
