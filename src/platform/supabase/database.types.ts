export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_grants: {
        Row: {
          expires_at: string | null
          granted_at: string
          grantee_membership_id: string
          grantor_membership_id: string
          id: string
          organisation_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_membership_id: string | null
          role_version_id: string
          scope_type: string
          scope_unit_id: string | null
          status: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          grantee_membership_id: string
          grantor_membership_id: string
          id?: string
          organisation_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          role_version_id: string
          scope_type: string
          scope_unit_id?: string | null
          status?: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          grantee_membership_id?: string
          grantor_membership_id?: string
          id?: string
          organisation_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          role_version_id?: string
          scope_type?: string
          scope_unit_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_grantee_fkey"
            columns: ["organisation_id", "grantee_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "access_grants_grantor_fkey"
            columns: ["organisation_id", "grantor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "access_grants_revoker_fkey"
            columns: ["organisation_id", "revoked_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "access_grants_role_version_fkey"
            columns: ["organisation_id", "role_version_id"]
            isOneToOne: false
            referencedRelation: "role_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "access_grants_scope_unit_fkey"
            columns: ["organisation_id", "scope_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      action_assignees: {
        Row: {
          action_id: string
          assigned_at: string
          assigned_by_membership_id: string
          id: string
          membership_id: string
          organisation_id: string
        }
        Insert: {
          action_id: string
          assigned_at?: string
          assigned_by_membership_id: string
          id?: string
          membership_id: string
          organisation_id: string
        }
        Update: {
          action_id?: string
          assigned_at?: string
          assigned_by_membership_id?: string
          id?: string
          membership_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_assignees_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "action_assignees_assigner_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "action_assignees_member_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      action_status_transitions: {
        Row: {
          action_id: string
          actor_membership_id: string
          created_at: string
          from_status: string
          id: string
          organisation_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          action_id: string
          actor_membership_id: string
          created_at?: string
          from_status: string
          id?: string
          organisation_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          action_id?: string
          actor_membership_id?: string
          created_at?: string
          from_status?: string
          id?: string
          organisation_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_status_transitions_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "action_status_transitions_actor_fkey"
            columns: ["organisation_id", "actor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      actions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          description: string | null
          due_at: string | null
          id: string
          idempotency_key: string | null
          organisation_id: string
          priority: string
          source_resource_id: string | null
          status: string
          title: string
          unit_id: string | null
          updated_at: string
          verified_at: string | null
          version: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          due_at?: string | null
          id: string
          idempotency_key?: string | null
          organisation_id: string
          priority?: string
          source_resource_id?: string | null
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
          verified_at?: string | null
          version?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          organisation_id?: string
          priority?: string
          source_resource_id?: string | null
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
          verified_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "actions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "actions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "actions_source_resource_fkey"
            columns: ["organisation_id", "source_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "actions_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_acceptance_provenance: {
        Row: {
          accepted_at: string
          accepted_by_membership_id: string
          action_id: string | null
          ai_proposal_id: string
          ai_run_id: string
          containment_id: string | null
          countermeasure_id: string | null
          current_condition_item_id: string | null
          effectiveness_check_id: string | null
          hypothesis_id: string | null
          hypothesis_test_id: string | null
          id: string
          lesson_learned_id: string | null
          organisation_id: string
          problem_solving_session_id: string | null
          session_entry_id: string | null
          sustainment_item_id: string | null
        }
        Insert: {
          accepted_at?: string
          accepted_by_membership_id: string
          action_id?: string | null
          ai_proposal_id: string
          ai_run_id: string
          containment_id?: string | null
          countermeasure_id?: string | null
          current_condition_item_id?: string | null
          effectiveness_check_id?: string | null
          hypothesis_id?: string | null
          hypothesis_test_id?: string | null
          id?: string
          lesson_learned_id?: string | null
          organisation_id: string
          problem_solving_session_id?: string | null
          session_entry_id?: string | null
          sustainment_item_id?: string | null
        }
        Update: {
          accepted_at?: string
          accepted_by_membership_id?: string
          action_id?: string | null
          ai_proposal_id?: string
          ai_run_id?: string
          containment_id?: string | null
          countermeasure_id?: string | null
          current_condition_item_id?: string | null
          effectiveness_check_id?: string | null
          hypothesis_id?: string | null
          hypothesis_test_id?: string | null
          id?: string
          lesson_learned_id?: string | null
          organisation_id?: string
          problem_solving_session_id?: string | null
          session_entry_id?: string | null
          sustainment_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_acceptance_provenance_accepter_fkey"
            columns: ["organisation_id", "accepted_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_cc_item_fkey"
            columns: ["organisation_id", "current_condition_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_current_condition_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_containment_fkey"
            columns: ["organisation_id", "containment_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_containments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_countermeasure_fkey"
            columns: ["organisation_id", "countermeasure_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_countermeasures"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_effectiveness_fkey"
            columns: ["organisation_id", "effectiveness_check_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_effectiveness_checks"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_hypothesis_fkey"
            columns: ["organisation_id", "hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_hypothesis_test_fkey"
            columns: ["organisation_id", "hypothesis_test_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypothesis_tests"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_lesson_fkey"
            columns: ["organisation_id", "lesson_learned_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_lessons_learned"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_proposal_fkey"
            columns: ["organisation_id", "ai_proposal_id"]
            isOneToOne: true
            referencedRelation: "ai_proposals"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_ps_session_fkey"
            columns: ["organisation_id", "problem_solving_session_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_session_entry_fkey"
            columns: ["organisation_id", "session_entry_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_session_entries"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_acceptance_provenance_sustainment_fkey"
            columns: ["organisation_id", "sustainment_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sustainment_items"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          ai_run_id: string | null
          ai_session_id: string
          content: string
          created_at: string
          id: string
          organisation_id: string
          role: string
          structured_payload: Json | null
        }
        Insert: {
          ai_run_id?: string | null
          ai_session_id: string
          content: string
          created_at?: string
          id?: string
          organisation_id: string
          role: string
          structured_payload?: Json | null
        }
        Update: {
          ai_run_id?: string | null
          ai_session_id?: string
          content?: string
          created_at?: string
          id?: string
          organisation_id?: string
          role?: string
          structured_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_messages_session_fkey"
            columns: ["organisation_id", "ai_session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_proposals: {
        Row: {
          ai_message_id: string | null
          ai_run_id: string
          ai_session_id: string
          created_at: string
          display_permission_key: string | null
          human_explanation: string
          id: string
          organisation_id: string
          payload_json: Json
          problem_solving_case_id: string
          proposal_type: string
          rejection_reason: string | null
          resolved_at: string | null
          resolved_by_membership_id: string | null
          status: string
        }
        Insert: {
          ai_message_id?: string | null
          ai_run_id: string
          ai_session_id: string
          created_at?: string
          display_permission_key?: string | null
          human_explanation: string
          id?: string
          organisation_id: string
          payload_json: Json
          problem_solving_case_id: string
          proposal_type: string
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
        }
        Update: {
          ai_message_id?: string | null
          ai_run_id?: string
          ai_session_id?: string
          created_at?: string
          display_permission_key?: string | null
          human_explanation?: string
          id?: string
          organisation_id?: string
          payload_json?: Json
          problem_solving_case_id?: string
          proposal_type?: string
          rejection_reason?: string | null
          resolved_at?: string | null
          resolved_by_membership_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_proposals_message_fkey"
            columns: ["organisation_id", "ai_message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_proposals_resolver_fkey"
            columns: ["organisation_id", "resolved_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_proposals_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_proposals_session_fkey"
            columns: ["organisation_id", "ai_session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_run_context_manifest: {
        Row: {
          ai_run_id: string
          created_at: string
          manifest_hash: string
          manifest_json: Json
          manifest_version: string
          organisation_id: string
        }
        Insert: {
          ai_run_id: string
          created_at?: string
          manifest_hash: string
          manifest_json: Json
          manifest_version: string
          organisation_id: string
        }
        Update: {
          ai_run_id?: string
          created_at?: string
          manifest_hash?: string
          manifest_json?: Json
          manifest_version?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_run_context_manifest_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          ai_session_id: string
          cached_input_token_count: number
          completed_at: string | null
          error_category: string | null
          final_output: string | null
          id: string
          idempotency_key: string | null
          input_token_count: number
          model: string
          organisation_id: string
          output_token_count: number
          prompt_hash: string
          prompt_key: string
          prompt_version: string
          provider: string
          provider_request_id: string | null
          reasoning_token_count: number
          requested_by_membership_id: string
          started_at: string
          status: string
          tool_call_count: number
        }
        Insert: {
          ai_session_id: string
          cached_input_token_count?: number
          completed_at?: string | null
          error_category?: string | null
          final_output?: string | null
          id?: string
          idempotency_key?: string | null
          input_token_count?: number
          model: string
          organisation_id: string
          output_token_count?: number
          prompt_hash: string
          prompt_key: string
          prompt_version: string
          provider: string
          provider_request_id?: string | null
          reasoning_token_count?: number
          requested_by_membership_id: string
          started_at?: string
          status?: string
          tool_call_count?: number
        }
        Update: {
          ai_session_id?: string
          cached_input_token_count?: number
          completed_at?: string | null
          error_category?: string | null
          final_output?: string | null
          id?: string
          idempotency_key?: string | null
          input_token_count?: number
          model?: string
          organisation_id?: string
          output_token_count?: number
          prompt_hash?: string
          prompt_key?: string
          prompt_version?: string
          provider?: string
          provider_request_id?: string | null
          reasoning_token_count?: number
          requested_by_membership_id?: string
          started_at?: string
          status?: string
          tool_call_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_requester_fkey"
            columns: ["organisation_id", "requested_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_runs_session_fkey"
            columns: ["organisation_id", "ai_session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          mode: string
          organisation_id: string
          problem_solving_case_id: string
          problem_solving_session_id: string | null
          status: string
          title: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          mode: string
          organisation_id: string
          problem_solving_case_id: string
          problem_solving_session_id?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          mode?: string
          organisation_id?: string
          problem_solving_case_id?: string
          problem_solving_session_id?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_sessions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_sessions_ps_session_fkey"
            columns: ["organisation_id", "problem_solving_session_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_source_references: {
        Row: {
          action_id: string | null
          ai_message_id: string | null
          ai_proposal_id: string | null
          ai_run_id: string | null
          containment_id: string | null
          countermeasure_id: string | null
          created_at: string
          current_condition_item_id: string | null
          effectiveness_check_id: string | null
          hypothesis_id: string | null
          hypothesis_test_id: string | null
          id: string
          lesson_learned_id: string | null
          organisation_id: string
          problem_solving_case_id: string | null
          problem_solving_session_id: string | null
          sustainment_item_id: string | null
        }
        Insert: {
          action_id?: string | null
          ai_message_id?: string | null
          ai_proposal_id?: string | null
          ai_run_id?: string | null
          containment_id?: string | null
          countermeasure_id?: string | null
          created_at?: string
          current_condition_item_id?: string | null
          effectiveness_check_id?: string | null
          hypothesis_id?: string | null
          hypothesis_test_id?: string | null
          id?: string
          lesson_learned_id?: string | null
          organisation_id: string
          problem_solving_case_id?: string | null
          problem_solving_session_id?: string | null
          sustainment_item_id?: string | null
        }
        Update: {
          action_id?: string | null
          ai_message_id?: string | null
          ai_proposal_id?: string | null
          ai_run_id?: string | null
          containment_id?: string | null
          countermeasure_id?: string | null
          created_at?: string
          current_condition_item_id?: string | null
          effectiveness_check_id?: string | null
          hypothesis_id?: string | null
          hypothesis_test_id?: string | null
          id?: string
          lesson_learned_id?: string | null
          organisation_id?: string
          problem_solving_case_id?: string | null
          problem_solving_session_id?: string | null
          sustainment_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_source_references_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_cc_item_fkey"
            columns: ["organisation_id", "current_condition_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_current_condition_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_containment_fkey"
            columns: ["organisation_id", "containment_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_containments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_countermeasure_fkey"
            columns: ["organisation_id", "countermeasure_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_countermeasures"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_effectiveness_fkey"
            columns: ["organisation_id", "effectiveness_check_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_effectiveness_checks"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_hypothesis_fkey"
            columns: ["organisation_id", "hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_hypothesis_test_fkey"
            columns: ["organisation_id", "hypothesis_test_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypothesis_tests"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_lesson_fkey"
            columns: ["organisation_id", "lesson_learned_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_lessons_learned"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_message_fkey"
            columns: ["organisation_id", "ai_message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_proposal_fkey"
            columns: ["organisation_id", "ai_proposal_id"]
            isOneToOne: false
            referencedRelation: "ai_proposals"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_ps_session_fkey"
            columns: ["organisation_id", "problem_solving_session_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_source_references_sustainment_fkey"
            columns: ["organisation_id", "sustainment_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sustainment_items"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_tool_calls: {
        Row: {
          ai_run_id: string
          arguments_hash: string
          arguments_json: Json
          created_at: string
          denial_reason: string | null
          duration_ms: number
          id: string
          organisation_id: string
          result_metadata_json: Json | null
          sequence_number: number
          status: string
          tool_name: string
        }
        Insert: {
          ai_run_id: string
          arguments_hash: string
          arguments_json: Json
          created_at?: string
          denial_reason?: string | null
          duration_ms?: number
          id?: string
          organisation_id: string
          result_metadata_json?: Json | null
          sequence_number: number
          status: string
          tool_name: string
        }
        Update: {
          ai_run_id?: string
          arguments_hash?: string
          arguments_json?: Json
          created_at?: string
          denial_reason?: string | null
          duration_ms?: number
          id?: string
          organisation_id?: string
          result_metadata_json?: Json | null
          sequence_number?: number
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_calls_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          ai_run_id: string
          ai_session_id: string
          cached_input_tokens: number
          created_at: string
          duration_ms: number
          id: string
          input_tokens: number
          membership_id: string
          model: string
          organisation_id: string
          output_tokens: number
          provider: string
          reasoning_tokens: number
          tool_call_count: number
        }
        Insert: {
          ai_run_id: string
          ai_session_id: string
          cached_input_tokens?: number
          created_at?: string
          duration_ms?: number
          id?: string
          input_tokens?: number
          membership_id: string
          model: string
          organisation_id: string
          output_tokens?: number
          provider: string
          reasoning_tokens?: number
          tool_call_count?: number
        }
        Update: {
          ai_run_id?: string
          ai_session_id?: string
          cached_input_tokens?: number
          created_at?: string
          duration_ms?: number
          id?: string
          input_tokens?: number
          membership_id?: string
          model?: string
          organisation_id?: string
          output_tokens?: number
          provider?: string
          reasoning_tokens?: number
          tool_call_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_usage_events_run_fkey"
            columns: ["organisation_id", "ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ai_usage_events_session_fkey"
            columns: ["organisation_id", "ai_session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      attachments: {
        Row: {
          byte_size: number | null
          created_at: string
          filename: string
          id: string
          lifecycle: string
          mime_type: string
          organisation_id: string
          scan_state: string
          storage_object_path: string
          target_resource_id: string
          updated_at: string
          upload_expires_at: string | null
          uploaded_by_membership_id: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          filename: string
          id: string
          lifecycle?: string
          mime_type: string
          organisation_id: string
          scan_state?: string
          storage_object_path: string
          target_resource_id: string
          updated_at?: string
          upload_expires_at?: string | null
          uploaded_by_membership_id: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          filename?: string
          id?: string
          lifecycle?: string
          mime_type?: string
          organisation_id?: string
          scan_state?: string
          storage_object_path?: string
          target_resource_id?: string
          updated_at?: string
          upload_expires_at?: string | null
          uploaded_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "attachments_target_resource_fkey"
            columns: ["organisation_id", "target_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "attachments_uploader_fkey"
            columns: ["organisation_id", "uploaded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_categories_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_evidence_links: {
        Row: {
          attachment_id: string
          benefit_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
        }
        Insert: {
          attachment_id: string
          benefit_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
        }
        Update: {
          attachment_id?: string
          benefit_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_evidence_links_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_forecast_periods: {
        Row: {
          created_at: string
          display_order: number
          forecast_amount: number
          forecast_version_id: string
          id: string
          organisation_id: string
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          display_order: number
          forecast_amount: number
          forecast_version_id: string
          id?: string
          organisation_id: string
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          display_order?: number
          forecast_amount?: number
          forecast_version_id?: string
          id?: string
          organisation_id?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_forecast_periods_version_fkey"
            columns: ["organisation_id", "forecast_version_id"]
            isOneToOne: false
            referencedRelation: "benefit_forecast_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_forecast_versions: {
        Row: {
          approved_at: string | null
          approved_by_membership_id: string | null
          assumptions: string | null
          benefit_id: string
          calculation_basis: string | null
          created_at: string
          created_by_membership_id: string
          forecast_end_date: string
          forecast_start_date: string
          forecast_total_amount: number | null
          id: string
          lifecycle: string
          organisation_id: string
          realisation_pattern: string
          submitted_at: string | null
          target_date: string | null
          target_measure_unit: string | null
          target_measure_value: number | null
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_membership_id?: string | null
          assumptions?: string | null
          benefit_id: string
          calculation_basis?: string | null
          created_at?: string
          created_by_membership_id: string
          forecast_end_date: string
          forecast_start_date: string
          forecast_total_amount?: number | null
          id?: string
          lifecycle?: string
          organisation_id: string
          realisation_pattern: string
          submitted_at?: string | null
          target_date?: string | null
          target_measure_unit?: string | null
          target_measure_value?: number | null
          version_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by_membership_id?: string | null
          assumptions?: string | null
          benefit_id?: string
          calculation_basis?: string | null
          created_at?: string
          created_by_membership_id?: string
          forecast_end_date?: string
          forecast_start_date?: string
          forecast_total_amount?: number | null
          id?: string
          lifecycle?: string
          organisation_id?: string
          realisation_pattern?: string
          submitted_at?: string | null
          target_date?: string | null
          target_measure_unit?: string | null
          target_measure_value?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "benefit_forecast_versions_approver_fkey"
            columns: ["organisation_id", "approved_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_forecast_versions_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_forecast_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_overlap_allocation_history: {
        Row: {
          allocation_percentage: number
          assigned_by_membership_id: string
          benefit_id: string
          effective_from: string
          id: string
          organisation_id: string
          overlap_group_id: string
          reason: string | null
          superseded_at: string | null
        }
        Insert: {
          allocation_percentage: number
          assigned_by_membership_id: string
          benefit_id: string
          effective_from?: string
          id?: string
          organisation_id: string
          overlap_group_id: string
          reason?: string | null
          superseded_at?: string | null
        }
        Update: {
          allocation_percentage?: number
          assigned_by_membership_id?: string
          benefit_id?: string
          effective_from?: string
          id?: string
          organisation_id?: string
          overlap_group_id?: string
          reason?: string | null
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_overlap_allocation_history_assigner_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_overlap_allocation_history_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_overlap_allocation_history_group_fkey"
            columns: ["organisation_id", "overlap_group_id"]
            isOneToOne: false
            referencedRelation: "benefit_overlap_groups"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_overlap_groups: {
        Row: {
          created_at: string
          created_by_membership_id: string
          id: string
          name: string
          organisation_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          id?: string
          name: string
          organisation_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          id?: string
          name?: string
          organisation_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_overlap_groups_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_overlap_groups_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_realisation_entries: {
        Row: {
          adjustment_of_entry_id: string | null
          benefit_id: string
          data_source: string | null
          entry_kind: string
          financial_amount: number | null
          id: string
          is_correction: boolean
          measure_unit: string | null
          measure_value: number | null
          notes: string | null
          organisation_id: string
          period_end: string
          period_start: string
          recorded_at: string
          recorded_by_membership_id: string
          status: string
          submitted_at: string | null
          validated_at: string | null
          validated_by_membership_id: string | null
        }
        Insert: {
          adjustment_of_entry_id?: string | null
          benefit_id: string
          data_source?: string | null
          entry_kind?: string
          financial_amount?: number | null
          id: string
          is_correction?: boolean
          measure_unit?: string | null
          measure_value?: number | null
          notes?: string | null
          organisation_id: string
          period_end: string
          period_start: string
          recorded_at?: string
          recorded_by_membership_id: string
          status?: string
          submitted_at?: string | null
          validated_at?: string | null
          validated_by_membership_id?: string | null
        }
        Update: {
          adjustment_of_entry_id?: string | null
          benefit_id?: string
          data_source?: string | null
          entry_kind?: string
          financial_amount?: number | null
          id?: string
          is_correction?: boolean
          measure_unit?: string | null
          measure_value?: number | null
          notes?: string | null
          organisation_id?: string
          period_end?: string
          period_start?: string
          recorded_at?: string
          recorded_by_membership_id?: string
          status?: string
          submitted_at?: string | null
          validated_at?: string | null
          validated_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_realisation_entries_adjustment_parent_fkey"
            columns: ["organisation_id", "adjustment_of_entry_id"]
            isOneToOne: false
            referencedRelation: "benefit_realisation_entries"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_realisation_entries_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_realisation_entries_recorder_fkey"
            columns: ["organisation_id", "recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_realisation_entries_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_realisation_entries_validator_fkey"
            columns: ["organisation_id", "validated_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_reporting_settings: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          fiscal_year_start_month: number
          organisation_id: string
          updated_at: string
          updated_by_membership_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          fiscal_year_start_month?: number
          organisation_id: string
          updated_at?: string
          updated_by_membership_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          fiscal_year_start_month?: number
          organisation_id?: string
          updated_at?: string
          updated_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_reporting_settings_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_reporting_settings_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_reporting_settings_updater_fkey"
            columns: ["organisation_id", "updated_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_source_links: {
        Row: {
          benefit_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          relationship_role: string
          source_resource_id: string
        }
        Insert: {
          benefit_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          relationship_role: string
          source_resource_id: string
        }
        Update: {
          benefit_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          relationship_role?: string
          source_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_source_links_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_source_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_source_links_source_fkey"
            columns: ["organisation_id", "source_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_status_history: {
        Row: {
          benefit_id: string
          changed_at: string
          changed_by_membership_id: string
          from_status: string
          id: string
          organisation_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          benefit_id: string
          changed_at?: string
          changed_by_membership_id: string
          from_status: string
          id?: string
          organisation_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          benefit_id?: string
          changed_at?: string
          changed_by_membership_id?: string
          from_status?: string
          id?: string
          organisation_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_status_history_actor_fkey"
            columns: ["organisation_id", "changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_status_history_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_submission_snapshots: {
        Row: {
          baseline_description: string | null
          baseline_financial_value: number | null
          baseline_measure_unit: string | null
          baseline_measure_value: number | null
          baseline_period_end: string | null
          baseline_period_start: string | null
          benefit_class: string
          benefit_id: string
          benefit_number: string
          category_code_snapshot: string | null
          category_id: string | null
          category_name_snapshot: string | null
          description: string | null
          financial_type: string | null
          forecast_total_amount: number | null
          forecast_version_id: string | null
          id: string
          is_standalone_initiative: boolean
          non_financial_type: string | null
          organisation_id: string
          organisational_unit_id: string
          owner_display_name_snapshot: string | null
          owner_membership_id: string
          planned_realisation_end: string | null
          planned_realisation_start: string | null
          reporting_currency_snapshot: string | null
          source_links_summary: Json
          submitted_at: string
          submitted_by_membership_id: string
          target_date: string | null
          target_measure_unit: string | null
          target_measure_value: number | null
          title: string
          unit_code_snapshot: string
          unit_name_snapshot: string
        }
        Insert: {
          baseline_description?: string | null
          baseline_financial_value?: number | null
          baseline_measure_unit?: string | null
          baseline_measure_value?: number | null
          baseline_period_end?: string | null
          baseline_period_start?: string | null
          benefit_class: string
          benefit_id: string
          benefit_number: string
          category_code_snapshot?: string | null
          category_id?: string | null
          category_name_snapshot?: string | null
          description?: string | null
          financial_type?: string | null
          forecast_total_amount?: number | null
          forecast_version_id?: string | null
          id?: string
          is_standalone_initiative?: boolean
          non_financial_type?: string | null
          organisation_id: string
          organisational_unit_id: string
          owner_display_name_snapshot?: string | null
          owner_membership_id: string
          planned_realisation_end?: string | null
          planned_realisation_start?: string | null
          reporting_currency_snapshot?: string | null
          source_links_summary?: Json
          submitted_at?: string
          submitted_by_membership_id: string
          target_date?: string | null
          target_measure_unit?: string | null
          target_measure_value?: number | null
          title: string
          unit_code_snapshot: string
          unit_name_snapshot: string
        }
        Update: {
          baseline_description?: string | null
          baseline_financial_value?: number | null
          baseline_measure_unit?: string | null
          baseline_measure_value?: number | null
          baseline_period_end?: string | null
          baseline_period_start?: string | null
          benefit_class?: string
          benefit_id?: string
          benefit_number?: string
          category_code_snapshot?: string | null
          category_id?: string | null
          category_name_snapshot?: string | null
          description?: string | null
          financial_type?: string | null
          forecast_total_amount?: number | null
          forecast_version_id?: string | null
          id?: string
          is_standalone_initiative?: boolean
          non_financial_type?: string | null
          organisation_id?: string
          organisational_unit_id?: string
          owner_display_name_snapshot?: string | null
          owner_membership_id?: string
          planned_realisation_end?: string | null
          planned_realisation_start?: string | null
          reporting_currency_snapshot?: string | null
          source_links_summary?: Json
          submitted_at?: string
          submitted_by_membership_id?: string
          target_date?: string | null
          target_measure_unit?: string | null
          target_measure_value?: number | null
          title?: string
          unit_code_snapshot?: string
          unit_name_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_submission_snapshots_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_submission_snapshots_submitter_fkey"
            columns: ["organisation_id", "submitted_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_validation_assignments: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          benefit_id: string
          completed_at: string | null
          id: string
          organisation_id: string
          status: string
          validation_role: string
          validator_membership_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          benefit_id: string
          completed_at?: string | null
          id?: string
          organisation_id: string
          status?: string
          validation_role: string
          validator_membership_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          benefit_id?: string
          completed_at?: string | null
          id?: string
          organisation_id?: string
          status?: string
          validation_role?: string
          validator_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_validation_assignments_assigner_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_validation_assignments_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_validation_assignments_validator_fkey"
            columns: ["organisation_id", "validator_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      benefit_validations: {
        Row: {
          benefit_id: string
          created_at: string
          decision: string
          forecast_version_id: string
          id: string
          organisation_id: string
          rationale: string
          submission_snapshot_id: string
          validation_role: string
          validator_membership_id: string
        }
        Insert: {
          benefit_id: string
          created_at?: string
          decision: string
          forecast_version_id: string
          id?: string
          organisation_id: string
          rationale: string
          submission_snapshot_id: string
          validation_role: string
          validator_membership_id: string
        }
        Update: {
          benefit_id?: string
          created_at?: string
          decision?: string
          forecast_version_id?: string
          id?: string
          organisation_id?: string
          rationale?: string
          submission_snapshot_id?: string
          validation_role?: string
          validator_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_validations_benefit_fkey"
            columns: ["organisation_id", "benefit_id"]
            isOneToOne: false
            referencedRelation: "improvement_benefits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_validations_forecast_version_fkey"
            columns: ["organisation_id", "forecast_version_id"]
            isOneToOne: false
            referencedRelation: "benefit_forecast_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_validations_submission_snapshot_fkey"
            columns: ["organisation_id", "submission_snapshot_id"]
            isOneToOne: false
            referencedRelation: "benefit_submission_snapshots"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "benefit_validations_validator_fkey"
            columns: ["organisation_id", "validator_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      business_audit_events: {
        Row: {
          actor_membership_id: string | null
          created_at: string
          event_action: string
          event_outcome: string
          id: string
          metadata: Json
          organisation_id: string
          request_correlation_id: string
          resource_record_id: string | null
        }
        Insert: {
          actor_membership_id?: string | null
          created_at?: string
          event_action: string
          event_outcome: string
          id?: string
          metadata?: Json
          organisation_id: string
          request_correlation_id: string
          resource_record_id?: string | null
        }
        Update: {
          actor_membership_id?: string | null
          created_at?: string
          event_action?: string
          event_outcome?: string
          id?: string
          metadata?: Json
          organisation_id?: string
          request_correlation_id?: string
          resource_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_audit_events_actor_fkey"
            columns: ["organisation_id", "actor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "business_audit_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_audit_events_resource_fkey"
            columns: ["organisation_id", "resource_record_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      capability_action_context: {
        Row: {
          action_id: string
          course_id: string | null
          created_at: string
          created_by_membership_id: string
          gap_type: string
          id: string
          membership_id: string
          notes: string | null
          organisation_id: string
          skill_assessment_id: string | null
          skill_id: string | null
          training_completion_id: string | null
        }
        Insert: {
          action_id: string
          course_id?: string | null
          created_at?: string
          created_by_membership_id: string
          gap_type: string
          id?: string
          membership_id: string
          notes?: string | null
          organisation_id: string
          skill_assessment_id?: string | null
          skill_id?: string | null
          training_completion_id?: string | null
        }
        Update: {
          action_id?: string
          course_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          gap_type?: string
          id?: string
          membership_id?: string
          notes?: string | null
          organisation_id?: string
          skill_assessment_id?: string | null
          skill_id?: string | null
          training_completion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "capability_action_context_course_fkey"
            columns: ["organisation_id", "course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "capability_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "capability_action_context_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "capability_action_context_skill_assessment_fkey"
            columns: ["organisation_id", "skill_assessment_id"]
            isOneToOne: false
            referencedRelation: "membership_skill_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "capability_action_context_skill_fkey"
            columns: ["organisation_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "capability_action_context_training_completion_fkey"
            columns: ["organisation_id", "training_completion_id"]
            isOneToOne: false
            referencedRelation: "training_completions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_action_context: {
        Row: {
          action_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          project_id: string
          project_phase_id: string | null
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          project_id: string
          project_phase_id?: string | null
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          project_id?: string
          project_phase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_action_context_phase_fkey"
            columns: ["organisation_id", "project_phase_id"]
            isOneToOne: false
            referencedRelation: "ci_project_phases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_action_context_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_completion_snapshots: {
        Row: {
          captured_at: string
          captured_by_membership_id: string
          id: string
          lessons_learned: string | null
          organisation_id: string
          outcome_summary: string
          project_id: string
          sustainment_summary: string | null
        }
        Insert: {
          captured_at?: string
          captured_by_membership_id: string
          id?: string
          lessons_learned?: string | null
          organisation_id: string
          outcome_summary: string
          project_id: string
          sustainment_summary?: string | null
        }
        Update: {
          captured_at?: string
          captured_by_membership_id?: string
          id?: string
          lessons_learned?: string | null
          organisation_id?: string
          outcome_summary?: string
          project_id?: string
          sustainment_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_completion_snapshots_capturer_fkey"
            columns: ["organisation_id", "captured_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_completion_snapshots_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: true
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_evidence_links: {
        Row: {
          attachment_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          project_id: string
          project_phase_id: string | null
        }
        Insert: {
          attachment_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          project_id: string
          project_phase_id?: string | null
        }
        Update: {
          attachment_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          project_id?: string
          project_phase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_evidence_links_phase_fkey"
            columns: ["organisation_id", "project_phase_id"]
            isOneToOne: false
            referencedRelation: "ci_project_phases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_evidence_links_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_methodologies: {
        Row: {
          code: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_methodologies_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_methodologies_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_project_methodology_phases: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          methodology_version_id: string
          organisation_id: string
          phase_key: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order: number
          id?: string
          methodology_version_id: string
          organisation_id: string
          phase_key: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          methodology_version_id?: string
          organisation_id?: string
          phase_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_methodology_phases_version_fkey"
            columns: ["organisation_id", "methodology_version_id"]
            isOneToOne: false
            referencedRelation: "ci_project_methodology_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_methodology_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          methodology_id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          template_version_id: string | null
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          methodology_id: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_version_id?: string | null
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          methodology_id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_methodology_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_methodology_versions_methodology_fkey"
            columns: ["organisation_id", "methodology_id"]
            isOneToOne: false
            referencedRelation: "ci_project_methodologies"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_methodology_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_methodology_versions_template_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: true
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_metric_measurements: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          measured_value: number
          metric_id: string
          note: string | null
          organisation_id: string
          recorded_by_membership_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          measured_value: number
          metric_id: string
          note?: string | null
          organisation_id: string
          recorded_by_membership_id: string
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          measured_value?: number
          metric_id?: string
          note?: string | null
          organisation_id?: string
          recorded_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_metric_measurements_metric_fkey"
            columns: ["organisation_id", "metric_id"]
            isOneToOne: false
            referencedRelation: "ci_project_metrics"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_metric_measurements_recorder_fkey"
            columns: ["organisation_id", "recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_metrics: {
        Row: {
          baseline_value: number | null
          created_at: string
          created_by_membership_id: string
          display_name: string
          id: string
          is_locked: boolean
          metric_key: string
          organisation_id: string
          project_id: string
          target_value: number | null
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          baseline_value?: number | null
          created_at?: string
          created_by_membership_id: string
          display_name: string
          id?: string
          is_locked?: boolean
          metric_key: string
          organisation_id: string
          project_id: string
          target_value?: number | null
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          baseline_value?: number | null
          created_at?: string
          created_by_membership_id?: string
          display_name?: string
          id?: string
          is_locked?: boolean
          metric_key?: string
          organisation_id?: string
          project_id?: string
          target_value?: number | null
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_metrics_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_metrics_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          description_snapshot: string | null
          display_order: number
          id: string
          methodology_phase_id: string | null
          organisation_id: string
          phase_key_snapshot: string
          project_id: string
          started_at: string | null
          status: string
          title_snapshot: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description_snapshot?: string | null
          display_order: number
          id?: string
          methodology_phase_id?: string | null
          organisation_id: string
          phase_key_snapshot: string
          project_id: string
          started_at?: string | null
          status?: string
          title_snapshot: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description_snapshot?: string | null
          display_order?: number
          id?: string
          methodology_phase_id?: string | null
          organisation_id?: string
          phase_key_snapshot?: string
          project_id?: string
          started_at?: string | null
          status?: string
          title_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_phases_methodology_phase_fkey"
            columns: ["organisation_id", "methodology_phase_id"]
            isOneToOne: false
            referencedRelation: "ci_project_methodology_phases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_phases_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_source_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          project_id: string
          source_resource_id: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          project_id: string
          source_resource_id: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          project_id?: string
          source_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_source_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_source_links_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_source_links_source_fkey"
            columns: ["organisation_id", "source_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_status_history: {
        Row: {
          changed_at: string
          changed_by_membership_id: string
          from_status: string
          id: string
          organisation_id: string
          project_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by_membership_id: string
          from_status: string
          id?: string
          organisation_id: string
          project_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by_membership_id?: string
          from_status?: string
          id?: string
          organisation_id?: string
          project_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_status_history_actor_fkey"
            columns: ["organisation_id", "changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_status_history_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_project_team_assignments: {
        Row: {
          assigned_by_membership_id: string
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          project_id: string
          team_role: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          assigned_by_membership_id: string
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          project_id: string
          team_role: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          assigned_by_membership_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          project_id?: string
          team_role?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_project_team_assignments_assigner_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_team_assignments_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_project_team_assignments_project_fkey"
            columns: ["organisation_id", "project_id"]
            isOneToOne: false
            referencedRelation: "ci_projects"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      ci_projects: {
        Row: {
          actual_end_at: string | null
          actual_start_at: string | null
          baseline_summary: string | null
          charter_submitted_at: string | null
          charter_submitted_by_membership_id: string | null
          constraints_risks: string | null
          created_at: string
          created_by_membership_id: string
          expected_impact_summary: string | null
          id: string
          methodology_version_id: string | null
          objective: string | null
          organisation_id: string
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string
          problem_statement: string | null
          project_number: string
          scope_in: string | null
          scope_out: string | null
          status: string
          sustainment_expectation: string | null
          target_summary: string | null
          title: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          baseline_summary?: string | null
          charter_submitted_at?: string | null
          charter_submitted_by_membership_id?: string | null
          constraints_risks?: string | null
          created_at?: string
          created_by_membership_id: string
          expected_impact_summary?: string | null
          id: string
          methodology_version_id?: string | null
          objective?: string | null
          organisation_id: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string
          problem_statement?: string | null
          project_number: string
          scope_in?: string | null
          scope_out?: string | null
          status?: string
          sustainment_expectation?: string | null
          target_summary?: string | null
          title: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          baseline_summary?: string | null
          charter_submitted_at?: string | null
          charter_submitted_by_membership_id?: string | null
          constraints_risks?: string | null
          created_at?: string
          created_by_membership_id?: string
          expected_impact_summary?: string | null
          id?: string
          methodology_version_id?: string | null
          objective?: string | null
          organisation_id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string
          problem_statement?: string | null
          project_number?: string
          scope_in?: string | null
          scope_out?: string | null
          status?: string
          sustainment_expectation?: string | null
          target_summary?: string | null
          title?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_projects_charter_submitter_fkey"
            columns: ["organisation_id", "charter_submitted_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_projects_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_projects_methodology_version_fkey"
            columns: ["organisation_id", "methodology_version_id"]
            isOneToOne: false
            referencedRelation: "ci_project_methodology_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_projects_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ci_projects_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      comments: {
        Row: {
          author_membership_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          organisation_id: string
          target_resource_id: string
        }
        Insert: {
          author_membership_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id: string
          organisation_id: string
          target_resource_id: string
        }
        Update: {
          author_membership_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          organisation_id?: string
          target_resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_fkey"
            columns: ["organisation_id", "author_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "comments_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "comments_target_resource_fkey"
            columns: ["organisation_id", "target_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_action_context: {
        Row: {
          action_id: string
          audit_id: string
          created_at: string
          created_by_membership_id: string
          finding_id: string | null
          id: string
          organisation_id: string
          question_id: string | null
          section_id: string | null
        }
        Insert: {
          action_id: string
          audit_id: string
          created_at?: string
          created_by_membership_id: string
          finding_id?: string | null
          id?: string
          organisation_id: string
          question_id?: string | null
          section_id?: string | null
        }
        Update: {
          action_id?: string
          audit_id?: string
          created_at?: string
          created_by_membership_id?: string
          finding_id?: string | null
          id?: string
          organisation_id?: string
          question_id?: string | null
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "five_s_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_action_context_audit_fkey"
            columns: ["organisation_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "five_s_audits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_action_context_finding_fkey"
            columns: ["organisation_id", "finding_id"]
            isOneToOne: false
            referencedRelation: "five_s_audit_findings"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_action_context_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_action_context_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_audit_findings: {
        Row: {
          action_required: boolean
          audit_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          observation: string
          organisation_id: string
          priority: string | null
          question_id: string | null
          section_id: string | null
          severity: string | null
        }
        Insert: {
          action_required?: boolean
          audit_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          observation: string
          organisation_id: string
          priority?: string | null
          question_id?: string | null
          section_id?: string | null
          severity?: string | null
        }
        Update: {
          action_required?: boolean
          audit_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          observation?: string
          organisation_id?: string
          priority?: string | null
          question_id?: string | null
          section_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "five_s_audit_findings_audit_fkey"
            columns: ["organisation_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "five_s_audits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audit_findings_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audit_findings_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audit_findings_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_audit_participants: {
        Row: {
          audit_id: string
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_audit_participants_audit_fkey"
            columns: ["organisation_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "five_s_audits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audit_participants_member_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_audit_score_snapshots: {
        Row: {
          audit_id: string
          created_at: string
          id: string
          organisation_id: string
          score_percent: number
          section_id: string
          section_name_snapshot: string
          weight: number
        }
        Insert: {
          audit_id: string
          created_at?: string
          id?: string
          organisation_id: string
          score_percent: number
          section_id: string
          section_name_snapshot: string
          weight: number
        }
        Update: {
          audit_id?: string
          created_at?: string
          id?: string
          organisation_id?: string
          score_percent?: number
          section_id?: string
          section_name_snapshot?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "five_s_audit_score_snapshots_audit_fkey"
            columns: ["organisation_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "five_s_audits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audit_score_snapshots_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_audits: {
        Row: {
          auditor_membership_id: string
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          overall_score_percent: number | null
          result_status: string | null
          schedule_occurrence_id: string | null
          standard_name_snapshot: string | null
          standard_version_id: string
          started_at: string | null
          status: string
          submission_id: string
          target_percent: number | null
          template_version_number_snapshot: number | null
          unit_code_snapshot: string | null
          unit_id: string
          unit_name_snapshot: string | null
          updated_at: string
        }
        Insert: {
          auditor_membership_id: string
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          overall_score_percent?: number | null
          result_status?: string | null
          schedule_occurrence_id?: string | null
          standard_name_snapshot?: string | null
          standard_version_id: string
          started_at?: string | null
          status?: string
          submission_id: string
          target_percent?: number | null
          template_version_number_snapshot?: number | null
          unit_code_snapshot?: string | null
          unit_id: string
          unit_name_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          auditor_membership_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          overall_score_percent?: number | null
          result_status?: string | null
          schedule_occurrence_id?: string | null
          standard_name_snapshot?: string | null
          standard_version_id?: string
          started_at?: string | null
          status?: string
          submission_id?: string
          target_percent?: number | null
          template_version_number_snapshot?: number | null
          unit_code_snapshot?: string | null
          unit_id?: string
          unit_name_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_audits_auditor_fkey"
            columns: ["organisation_id", "auditor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audits_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audits_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audits_schedule_occurrence_fkey"
            columns: ["organisation_id", "schedule_occurrence_id"]
            isOneToOne: false
            referencedRelation: "schedule_occurrences"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audits_standard_version_fkey"
            columns: ["organisation_id", "standard_version_id"]
            isOneToOne: false
            referencedRelation: "five_s_standard_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audits_submission_fkey"
            columns: ["organisation_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "template_submissions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_audits_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_evidence_links: {
        Row: {
          attachment_id: string
          audit_id: string
          created_at: string
          created_by_membership_id: string
          finding_id: string | null
          id: string
          organisation_id: string
          question_id: string | null
          section_id: string | null
        }
        Insert: {
          attachment_id: string
          audit_id: string
          created_at?: string
          created_by_membership_id: string
          finding_id?: string | null
          id?: string
          organisation_id: string
          question_id?: string | null
          section_id?: string | null
        }
        Update: {
          attachment_id?: string
          audit_id?: string
          created_at?: string
          created_by_membership_id?: string
          finding_id?: string | null
          id?: string
          organisation_id?: string
          question_id?: string | null
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "five_s_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_evidence_links_audit_fkey"
            columns: ["organisation_id", "audit_id"]
            isOneToOne: false
            referencedRelation: "five_s_audits"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_evidence_links_finding_fkey"
            columns: ["organisation_id", "finding_id"]
            isOneToOne: false
            referencedRelation: "five_s_audit_findings"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_evidence_links_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_evidence_links_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_question_scoring: {
        Row: {
          contributes_to_score: boolean
          created_at: string
          id: string
          organisation_id: string
          question_id: string
          scoring_metadata: Json | null
          standard_version_id: string
          weight: number
        }
        Insert: {
          contributes_to_score?: boolean
          created_at?: string
          id?: string
          organisation_id: string
          question_id: string
          scoring_metadata?: Json | null
          standard_version_id: string
          weight?: number
        }
        Update: {
          contributes_to_score?: boolean
          created_at?: string
          id?: string
          organisation_id?: string
          question_id?: string
          scoring_metadata?: Json | null
          standard_version_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "five_s_question_scoring_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_question_scoring_version_fkey"
            columns: ["organisation_id", "standard_version_id"]
            isOneToOne: false
            referencedRelation: "five_s_standard_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_section_weights: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          section_id: string
          standard_version_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          section_id: string
          standard_version_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          section_id?: string
          standard_version_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "five_s_section_weights_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_section_weights_version_fkey"
            columns: ["organisation_id", "standard_version_id"]
            isOneToOne: false
            referencedRelation: "five_s_standard_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_standard_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          result_status_mappings: Json
          standard_id: string
          status: string
          target_threshold_percent: number
          template_version_id: string
          version_number: number
          weighting_enabled: boolean
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          result_status_mappings?: Json
          standard_id: string
          status?: string
          target_threshold_percent?: number
          template_version_id: string
          version_number: number
          weighting_enabled?: boolean
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          result_status_mappings?: Json
          standard_id?: string
          status?: string
          target_threshold_percent?: number
          template_version_id?: string
          version_number?: number
          weighting_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "five_s_standard_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_standard_versions_standard_fkey"
            columns: ["organisation_id", "standard_id"]
            isOneToOne: false
            referencedRelation: "five_s_standards"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_standard_versions_template_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: true
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      five_s_standards: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string | null
          display_name: string
          id: string
          organisation_id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          display_name: string
          id: string
          organisation_id: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          display_name?: string
          id?: string
          organisation_id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_s_standards_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_standards_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "five_s_standards_template_fkey"
            columns: ["organisation_id", "template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_action_context: {
        Row: {
          action_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          observation_id: string | null
          organisation_id: string
          question_id: string | null
          section_id: string | null
          walk_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          observation_id?: string | null
          organisation_id: string
          question_id?: string | null
          section_id?: string | null
          walk_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          observation_id?: string | null
          organisation_id?: string
          question_id?: string | null
          section_id?: string | null
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_action_context_observation_fkey"
            columns: ["organisation_id", "observation_id"]
            isOneToOne: false
            referencedRelation: "gemba_walk_observations"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_action_context_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_action_context_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_action_context_walk_fkey"
            columns: ["organisation_id", "walk_id"]
            isOneToOne: false
            referencedRelation: "gemba_walks"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_definition_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          definition_id: string
          expected_duration_minutes: number | null
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          template_version_id: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          definition_id: string
          expected_duration_minutes?: number | null
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_version_id: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          definition_id?: string
          expected_duration_minutes?: number | null
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_version_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "gemba_definition_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_definition_versions_definition_fkey"
            columns: ["organisation_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "gemba_definitions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_definition_versions_template_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: true
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_definitions: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string | null
          display_name: string
          id: string
          organisation_id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          display_name: string
          id: string
          organisation_id: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          display_name?: string
          id?: string
          organisation_id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_definitions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_definitions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_definitions_template_fkey"
            columns: ["organisation_id", "template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_evidence_links: {
        Row: {
          attachment_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          observation_id: string | null
          organisation_id: string
          question_id: string | null
          section_id: string | null
          walk_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          observation_id?: string | null
          organisation_id: string
          question_id?: string | null
          section_id?: string | null
          walk_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          observation_id?: string | null
          organisation_id?: string
          question_id?: string | null
          section_id?: string | null
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_evidence_links_observation_fkey"
            columns: ["organisation_id", "observation_id"]
            isOneToOne: false
            referencedRelation: "gemba_walk_observations"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_evidence_links_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_evidence_links_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_evidence_links_walk_fkey"
            columns: ["organisation_id", "walk_id"]
            isOneToOne: false
            referencedRelation: "gemba_walks"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_walk_observations: {
        Row: {
          created_at: string
          created_by_membership_id: string
          id: string
          observation_text: string
          observation_type: string
          organisation_id: string
          priority: string | null
          question_id: string | null
          section_id: string | null
          severity: string | null
          walk_id: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          id?: string
          observation_text: string
          observation_type: string
          organisation_id: string
          priority?: string | null
          question_id?: string | null
          section_id?: string | null
          severity?: string | null
          walk_id: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          id?: string
          observation_text?: string
          observation_type?: string
          organisation_id?: string
          priority?: string | null
          question_id?: string | null
          section_id?: string | null
          severity?: string | null
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_walk_observations_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walk_observations_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walk_observations_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walk_observations_walk_fkey"
            columns: ["organisation_id", "walk_id"]
            isOneToOne: false
            referencedRelation: "gemba_walks"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_walk_participants: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          walk_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          walk_id: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_walk_participants_member_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walk_participants_walk_fkey"
            columns: ["organisation_id", "walk_id"]
            isOneToOne: false
            referencedRelation: "gemba_walks"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      gemba_walks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          definition_name_snapshot: string | null
          definition_version_id: string
          id: string
          leader_membership_id: string
          organisation_id: string
          schedule_occurrence_id: string | null
          started_at: string | null
          status: string
          submission_id: string
          summary_notes: string | null
          template_version_number_snapshot: number | null
          unit_code_snapshot: string | null
          unit_id: string
          unit_name_snapshot: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          definition_name_snapshot?: string | null
          definition_version_id: string
          id: string
          leader_membership_id: string
          organisation_id: string
          schedule_occurrence_id?: string | null
          started_at?: string | null
          status?: string
          submission_id: string
          summary_notes?: string | null
          template_version_number_snapshot?: number | null
          unit_code_snapshot?: string | null
          unit_id: string
          unit_name_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          definition_name_snapshot?: string | null
          definition_version_id?: string
          id?: string
          leader_membership_id?: string
          organisation_id?: string
          schedule_occurrence_id?: string | null
          started_at?: string | null
          status?: string
          submission_id?: string
          summary_notes?: string | null
          template_version_number_snapshot?: number | null
          unit_code_snapshot?: string | null
          unit_id?: string
          unit_name_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gemba_walks_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walks_definition_version_fkey"
            columns: ["organisation_id", "definition_version_id"]
            isOneToOne: false
            referencedRelation: "gemba_definition_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walks_leader_fkey"
            columns: ["organisation_id", "leader_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walks_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walks_schedule_occurrence_fkey"
            columns: ["organisation_id", "schedule_occurrence_id"]
            isOneToOne: false
            referencedRelation: "schedule_occurrences"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walks_submission_fkey"
            columns: ["organisation_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "template_submissions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "gemba_walks_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      improvement_benefits: {
        Row: {
          baseline_description: string | null
          baseline_financial_value: number | null
          baseline_measure_unit: string | null
          baseline_measure_value: number | null
          baseline_period_end: string | null
          baseline_period_start: string | null
          benefit_class: string
          benefit_number: string | null
          category_id: string | null
          created_at: string
          created_by_membership_id: string
          current_forecast_version_id: string | null
          description: string | null
          financial_type: string | null
          id: string
          is_standalone_initiative: boolean
          non_financial_type: string | null
          organisation_id: string
          organisational_unit_id: string
          owner_membership_id: string
          planned_realisation_end: string | null
          planned_realisation_start: string | null
          reporting_currency_snapshot: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          baseline_description?: string | null
          baseline_financial_value?: number | null
          baseline_measure_unit?: string | null
          baseline_measure_value?: number | null
          baseline_period_end?: string | null
          baseline_period_start?: string | null
          benefit_class: string
          benefit_number?: string | null
          category_id?: string | null
          created_at?: string
          created_by_membership_id: string
          current_forecast_version_id?: string | null
          description?: string | null
          financial_type?: string | null
          id: string
          is_standalone_initiative?: boolean
          non_financial_type?: string | null
          organisation_id: string
          organisational_unit_id: string
          owner_membership_id: string
          planned_realisation_end?: string | null
          planned_realisation_start?: string | null
          reporting_currency_snapshot?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          baseline_description?: string | null
          baseline_financial_value?: number | null
          baseline_measure_unit?: string | null
          baseline_measure_value?: number | null
          baseline_period_end?: string | null
          baseline_period_start?: string | null
          benefit_class?: string
          benefit_number?: string | null
          category_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          current_forecast_version_id?: string | null
          description?: string | null
          financial_type?: string | null
          id?: string
          is_standalone_initiative?: boolean
          non_financial_type?: string | null
          organisation_id?: string
          organisational_unit_id?: string
          owner_membership_id?: string
          planned_realisation_end?: string | null
          planned_realisation_start?: string | null
          reporting_currency_snapshot?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "improvement_benefits_category_fkey"
            columns: ["organisation_id", "category_id"]
            isOneToOne: false
            referencedRelation: "benefit_categories"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_benefits_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_benefits_current_forecast_version_fkey"
            columns: ["organisation_id", "current_forecast_version_id"]
            isOneToOne: false
            referencedRelation: "benefit_forecast_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_benefits_owner_fkey"
            columns: ["organisation_id", "owner_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_benefits_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_benefits_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      improvement_suggestions: {
        Row: {
          accepted_at: string | null
          author_membership_id: string
          category_code_snapshot: string | null
          category_id: string
          category_name_snapshot: string | null
          created_at: string
          expected_benefit_summary: string | null
          id: string
          implementation_outcome: string | null
          implementation_started_at: string | null
          implementation_summary: string | null
          implemented_at: string | null
          implemented_by_membership_id: string | null
          organisation_id: string
          origin_unit_code_snapshot: string | null
          origin_unit_id: string
          origin_unit_name_snapshot: string | null
          problem_or_opportunity: string
          programme_code_snapshot: string | null
          programme_name_snapshot: string | null
          programme_version_id: string
          proposed_idea: string
          rejected_at: string | null
          review_jurisdiction_unit_id: string
          status: string
          submitted_at: string | null
          suggestion_number: string | null
          target_unit_code_snapshot: string | null
          target_unit_id: string | null
          target_unit_name_snapshot: string | null
          template_submission_id: string | null
          title: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          author_membership_id: string
          category_code_snapshot?: string | null
          category_id: string
          category_name_snapshot?: string | null
          created_at?: string
          expected_benefit_summary?: string | null
          id: string
          implementation_outcome?: string | null
          implementation_started_at?: string | null
          implementation_summary?: string | null
          implemented_at?: string | null
          implemented_by_membership_id?: string | null
          organisation_id: string
          origin_unit_code_snapshot?: string | null
          origin_unit_id: string
          origin_unit_name_snapshot?: string | null
          problem_or_opportunity: string
          programme_code_snapshot?: string | null
          programme_name_snapshot?: string | null
          programme_version_id: string
          proposed_idea: string
          rejected_at?: string | null
          review_jurisdiction_unit_id: string
          status?: string
          submitted_at?: string | null
          suggestion_number?: string | null
          target_unit_code_snapshot?: string | null
          target_unit_id?: string | null
          target_unit_name_snapshot?: string | null
          template_submission_id?: string | null
          title: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          author_membership_id?: string
          category_code_snapshot?: string | null
          category_id?: string
          category_name_snapshot?: string | null
          created_at?: string
          expected_benefit_summary?: string | null
          id?: string
          implementation_outcome?: string | null
          implementation_started_at?: string | null
          implementation_summary?: string | null
          implemented_at?: string | null
          implemented_by_membership_id?: string | null
          organisation_id?: string
          origin_unit_code_snapshot?: string | null
          origin_unit_id?: string
          origin_unit_name_snapshot?: string | null
          problem_or_opportunity?: string
          programme_code_snapshot?: string | null
          programme_name_snapshot?: string | null
          programme_version_id?: string
          proposed_idea?: string
          rejected_at?: string | null
          review_jurisdiction_unit_id?: string
          status?: string
          submitted_at?: string | null
          suggestion_number?: string | null
          target_unit_code_snapshot?: string | null
          target_unit_id?: string | null
          target_unit_name_snapshot?: string | null
          template_submission_id?: string | null
          title?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "improvement_suggestions_author_fkey"
            columns: ["organisation_id", "author_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_category_fkey"
            columns: ["organisation_id", "category_id"]
            isOneToOne: false
            referencedRelation: "suggestion_categories"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_implemented_by_fkey"
            columns: ["organisation_id", "implemented_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_jurisdiction_unit_fkey"
            columns: ["organisation_id", "review_jurisdiction_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_origin_unit_fkey"
            columns: ["organisation_id", "origin_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_programme_version_fkey"
            columns: ["organisation_id", "programme_version_id"]
            isOneToOne: false
            referencedRelation: "suggestion_programme_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_target_unit_fkey"
            columns: ["organisation_id", "target_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "improvement_suggestions_template_submission_fkey"
            columns: ["organisation_id", "template_submission_id"]
            isOneToOne: false
            referencedRelation: "template_submissions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      job_functions: {
        Row: {
          code: string
          created_at: string
          created_by_membership_id: string
          deactivated_at: string | null
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by_membership_id: string
          deactivated_at?: string | null
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by_membership_id?: string
          deactivated_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_functions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "job_functions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      maturity_action_context: {
        Row: {
          action_id: string
          assessment_id: string
          created_at: string
          created_by_membership_id: string
          criterion_id: string
          id: string
          organisation_id: string
          pillar_id: string
          question_id: string | null
        }
        Insert: {
          action_id: string
          assessment_id: string
          created_at?: string
          created_by_membership_id: string
          criterion_id: string
          id?: string
          organisation_id: string
          pillar_id: string
          question_id?: string | null
        }
        Update: {
          action_id?: string
          assessment_id?: string
          created_at?: string
          created_by_membership_id?: string
          criterion_id?: string
          id?: string
          organisation_id?: string
          pillar_id?: string
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maturity_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_action_context_assessment_fkey"
            columns: ["organisation_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "maturity_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_action_context_criterion_fkey"
            columns: ["organisation_id", "criterion_id"]
            isOneToOne: false
            referencedRelation: "maturity_criteria"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_action_context_pillar_fkey"
            columns: ["organisation_id", "pillar_id"]
            isOneToOne: false
            referencedRelation: "maturity_pillars"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_action_context_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_assessment_participants: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          participant_role: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          participant_role?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          participant_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_assessment_participants_assessment_fkey"
            columns: ["organisation_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "maturity_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessment_participants_member_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_assessment_scores: {
        Row: {
          assessment_id: string
          created_at: string
          entity_id: string | null
          id: string
          organisation_id: string
          score: number
          score_level: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          entity_id?: string | null
          id?: string
          organisation_id: string
          score: number
          score_level: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          organisation_id?: string
          score?: number
          score_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_assessment_scores_assessment_fkey"
            columns: ["organisation_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "maturity_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_assessment_transitions: {
        Row: {
          actor_membership_id: string
          assessment_id: string
          created_at: string
          from_status: string
          id: string
          organisation_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_membership_id: string
          assessment_id: string
          created_at?: string
          from_status: string
          id?: string
          organisation_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_membership_id?: string
          assessment_id?: string
          created_at?: string
          from_status?: string
          id?: string
          organisation_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_assessment_transitions_actor_fkey"
            columns: ["organisation_id", "actor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessment_transitions_assessment_fkey"
            columns: ["organisation_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "maturity_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_assessments: {
        Row: {
          approved_at: string | null
          assessment_type: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          lead_assessor_membership_id: string | null
          model_version_id: string
          organisation_id: string
          published_at: string | null
          started_at: string | null
          status: string
          submission_id: string
          submitted_at: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          assessment_type: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id: string
          lead_assessor_membership_id?: string | null
          model_version_id: string
          organisation_id: string
          published_at?: string | null
          started_at?: string | null
          status?: string
          submission_id: string
          submitted_at?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          assessment_type?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          lead_assessor_membership_id?: string | null
          model_version_id?: string
          organisation_id?: string
          published_at?: string | null
          started_at?: string | null
          status?: string
          submission_id?: string
          submitted_at?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_assessments_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessments_lead_assessor_fkey"
            columns: ["organisation_id", "lead_assessor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessments_model_version_fkey"
            columns: ["organisation_id", "model_version_id"]
            isOneToOne: false
            referencedRelation: "maturity_model_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessments_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessments_submission_fkey"
            columns: ["organisation_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "template_submissions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_assessments_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_criteria: {
        Row: {
          created_at: string
          description: string | null
          expected_evidence: string | null
          guidance: string | null
          id: string
          name: string
          organisation_id: string
          pillar_id: string
          position: number
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_evidence?: string | null
          guidance?: string | null
          id?: string
          name: string
          organisation_id: string
          pillar_id: string
          position: number
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_evidence?: string | null
          guidance?: string | null
          id?: string
          name?: string
          organisation_id?: string
          pillar_id?: string
          position?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "maturity_criteria_pillar_fkey"
            columns: ["organisation_id", "pillar_id"]
            isOneToOne: false
            referencedRelation: "maturity_pillars"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_criterion_questions: {
        Row: {
          contributes_to_score: boolean
          created_at: string
          criterion_id: string
          id: string
          organisation_id: string
          question_id: string
          scoring_metadata: Json | null
        }
        Insert: {
          contributes_to_score?: boolean
          created_at?: string
          criterion_id: string
          id?: string
          organisation_id: string
          question_id: string
          scoring_metadata?: Json | null
        }
        Update: {
          contributes_to_score?: boolean
          created_at?: string
          criterion_id?: string
          id?: string
          organisation_id?: string
          question_id?: string
          scoring_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "maturity_criterion_questions_criterion_fkey"
            columns: ["organisation_id", "criterion_id"]
            isOneToOne: false
            referencedRelation: "maturity_criteria"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_criterion_questions_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_evidence_links: {
        Row: {
          assessment_id: string
          attachment_id: string
          created_at: string
          created_by_membership_id: string
          criterion_id: string
          id: string
          organisation_id: string
          question_id: string | null
        }
        Insert: {
          assessment_id: string
          attachment_id: string
          created_at?: string
          created_by_membership_id: string
          criterion_id: string
          id?: string
          organisation_id: string
          question_id?: string | null
        }
        Update: {
          assessment_id?: string
          attachment_id?: string
          created_at?: string
          created_by_membership_id?: string
          criterion_id?: string
          id?: string
          organisation_id?: string
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maturity_evidence_links_assessment_fkey"
            columns: ["organisation_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "maturity_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_evidence_links_criterion_fkey"
            columns: ["organisation_id", "criterion_id"]
            isOneToOne: false
            referencedRelation: "maturity_criteria"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_evidence_links_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_levels: {
        Row: {
          color_token: string
          created_at: string
          description: string | null
          guidance: string | null
          id: string
          level_number: number
          model_version_id: string
          name: string
          organisation_id: string
        }
        Insert: {
          color_token: string
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          level_number: number
          model_version_id: string
          name: string
          organisation_id: string
        }
        Update: {
          color_token?: string
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          level_number?: number
          model_version_id?: string
          name?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_levels_version_fkey"
            columns: ["organisation_id", "model_version_id"]
            isOneToOne: false
            referencedRelation: "maturity_model_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_model_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          model_id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          template_version_id: string
          version_number: number
          weighting_enabled: boolean
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          model_id: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_version_id: string
          version_number: number
          weighting_enabled?: boolean
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          model_id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_version_id?: string
          version_number?: number
          weighting_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "maturity_model_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_model_versions_model_fkey"
            columns: ["organisation_id", "model_id"]
            isOneToOne: false
            referencedRelation: "maturity_models"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_model_versions_template_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: true
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_models: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string | null
          display_name: string
          id: string
          organisation_id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          display_name: string
          id: string
          organisation_id: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          display_name?: string
          id?: string
          organisation_id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_models_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_models_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_models_template_fkey"
            columns: ["organisation_id", "template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_official_result_levels: {
        Row: {
          color_token: string | null
          created_at: string
          description: string | null
          guidance: string | null
          id: string
          level_number: number
          name: string
          official_result_id: string
          organisation_id: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          level_number: number
          name: string
          official_result_id: string
          organisation_id: string
        }
        Update: {
          color_token?: string | null
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          level_number?: number
          name?: string
          official_result_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_official_result_levels_result_fkey"
            columns: ["organisation_id", "official_result_id"]
            isOneToOne: false
            referencedRelation: "maturity_official_results"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_official_result_pillars: {
        Row: {
          created_at: string
          id: string
          official_result_id: string
          organisation_id: string
          pillar_id: string
          pillar_name: string
          pillar_position: number
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          official_result_id: string
          organisation_id: string
          pillar_id: string
          pillar_name: string
          pillar_position: number
          score: number
        }
        Update: {
          created_at?: string
          id?: string
          official_result_id?: string
          organisation_id?: string
          pillar_id?: string
          pillar_name?: string
          pillar_position?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "maturity_official_result_pillars_pillar_fkey"
            columns: ["organisation_id", "pillar_id"]
            isOneToOne: false
            referencedRelation: "maturity_pillars"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_official_result_pillars_result_fkey"
            columns: ["organisation_id", "official_result_id"]
            isOneToOne: false
            referencedRelation: "maturity_official_results"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_official_results: {
        Row: {
          assessment_id: string
          assessment_type_snapshot: string | null
          created_at: string
          id: string
          model_name_snapshot: string | null
          model_version_id: string
          model_version_number_snapshot: number | null
          organisation_id: string
          overall_score: number
          published_at: string
          published_by_membership_id: string
          unit_code_snapshot: string | null
          unit_id_snapshot: string | null
          unit_name_snapshot: string | null
        }
        Insert: {
          assessment_id: string
          assessment_type_snapshot?: string | null
          created_at?: string
          id?: string
          model_name_snapshot?: string | null
          model_version_id: string
          model_version_number_snapshot?: number | null
          organisation_id: string
          overall_score: number
          published_at?: string
          published_by_membership_id: string
          unit_code_snapshot?: string | null
          unit_id_snapshot?: string | null
          unit_name_snapshot?: string | null
        }
        Update: {
          assessment_id?: string
          assessment_type_snapshot?: string | null
          created_at?: string
          id?: string
          model_name_snapshot?: string | null
          model_version_id?: string
          model_version_number_snapshot?: number | null
          organisation_id?: string
          overall_score?: number
          published_at?: string
          published_by_membership_id?: string
          unit_code_snapshot?: string | null
          unit_id_snapshot?: string | null
          unit_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maturity_official_results_assessment_fkey"
            columns: ["organisation_id", "assessment_id"]
            isOneToOne: true
            referencedRelation: "maturity_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_official_results_model_version_fkey"
            columns: ["organisation_id", "model_version_id"]
            isOneToOne: false
            referencedRelation: "maturity_model_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_official_results_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      maturity_pillars: {
        Row: {
          created_at: string
          description: string | null
          guidance: string | null
          id: string
          model_version_id: string
          name: string
          organisation_id: string
          position: number
          section_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          model_version_id: string
          name: string
          organisation_id: string
          position: number
          section_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          model_version_id?: string
          name?: string
          organisation_id?: string
          position?: number
          section_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "maturity_pillars_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "maturity_pillars_version_fkey"
            columns: ["organisation_id", "model_version_id"]
            isOneToOne: false
            referencedRelation: "maturity_model_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      membership_job_function_assignments: {
        Row: {
          assigned_by_membership_id: string
          assignment_reason: string | null
          created_at: string
          id: string
          is_primary: boolean
          job_function_code_snapshot: string
          job_function_id: string
          job_function_name_snapshot: string
          membership_id: string
          organisation_id: string
          organisational_unit_id: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          assigned_by_membership_id: string
          assignment_reason?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          job_function_code_snapshot: string
          job_function_id: string
          job_function_name_snapshot: string
          membership_id: string
          organisation_id: string
          organisational_unit_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          assigned_by_membership_id?: string
          assignment_reason?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          job_function_code_snapshot?: string
          job_function_id?: string
          job_function_name_snapshot?: string
          membership_id?: string
          organisation_id?: string
          organisational_unit_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_job_function_assignments_assigned_by_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_job_function_assignments_job_function_fkey"
            columns: ["organisation_id", "job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_job_function_assignments_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_job_function_assignments_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_job_function_assignments_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      membership_notification_contacts: {
        Row: {
          channel_type: string
          contact_address: string
          created_at: string
          membership_id: string
          organisation_id: string
          source: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          channel_type?: string
          contact_address: string
          created_at?: string
          membership_id: string
          organisation_id: string
          source?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          channel_type?: string
          contact_address?: string
          created_at?: string
          membership_id?: string
          organisation_id?: string
          source?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_notification_contacts_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_notification_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_skill_assessments: {
        Row: {
          assertion_type: string
          assessed_at: string
          assessment_method: string | null
          assessor_membership_id: string | null
          created_at: string
          id: string
          is_authoritative: boolean
          membership_id: string
          notes: string | null
          organisation_id: string
          organisational_unit_id: string | null
          proficiency_level_id: string
          proficiency_scale_version_id: string
          skill_id: string
          status: string
          supersedes_assessment_id: string | null
          valid_until: string | null
        }
        Insert: {
          assertion_type: string
          assessed_at: string
          assessment_method?: string | null
          assessor_membership_id?: string | null
          created_at?: string
          id: string
          is_authoritative?: boolean
          membership_id: string
          notes?: string | null
          organisation_id: string
          organisational_unit_id?: string | null
          proficiency_level_id: string
          proficiency_scale_version_id: string
          skill_id: string
          status?: string
          supersedes_assessment_id?: string | null
          valid_until?: string | null
        }
        Update: {
          assertion_type?: string
          assessed_at?: string
          assessment_method?: string | null
          assessor_membership_id?: string | null
          created_at?: string
          id?: string
          is_authoritative?: boolean
          membership_id?: string
          notes?: string | null
          organisation_id?: string
          organisational_unit_id?: string | null
          proficiency_level_id?: string
          proficiency_scale_version_id?: string
          skill_id?: string
          status?: string
          supersedes_assessment_id?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_skill_assessments_assessor_fkey"
            columns: ["organisation_id", "assessor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_level_fkey"
            columns: ["organisation_id", "proficiency_level_id"]
            isOneToOne: false
            referencedRelation: "skill_proficiency_levels"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_scale_version_fkey"
            columns: ["organisation_id", "proficiency_scale_version_id"]
            isOneToOne: false
            referencedRelation: "skill_proficiency_scale_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_skill_fkey"
            columns: ["organisation_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_supersedes_fkey"
            columns: ["organisation_id", "supersedes_assessment_id"]
            isOneToOne: false
            referencedRelation: "membership_skill_assessments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "membership_skill_assessments_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisation_ai_settings: {
        Row: {
          ai_enabled: boolean
          monthly_token_ceiling: number | null
          organisation_id: string
          updated_at: string
          updated_by_membership_id: string | null
        }
        Insert: {
          ai_enabled?: boolean
          monthly_token_ceiling?: number | null
          organisation_id: string
          updated_at?: string
          updated_by_membership_id?: string | null
        }
        Update: {
          ai_enabled?: boolean
          monthly_token_ceiling?: number | null
          organisation_id?: string
          updated_at?: string
          updated_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_ai_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_document_sequences: {
        Row: {
          last_value: number
          organisation_id: string
          sequence_key: string
          sequence_year: number
        }
        Insert: {
          last_value?: number
          organisation_id: string
          sequence_key: string
          sequence_year: number
        }
        Update: {
          last_value?: number
          organisation_id?: string
          sequence_key?: string
          sequence_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "organisation_document_sequences_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitation_grants: {
        Row: {
          created_at: string
          id: string
          invitation_id: string
          organisation_id: string
          role_version_id: string
          scope_type: string
          scope_unit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_id: string
          organisation_id: string
          role_version_id: string
          scope_type: string
          scope_unit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invitation_id?: string
          organisation_id?: string
          role_version_id?: string
          scope_type?: string
          scope_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitation_grants_invitation_fkey"
            columns: ["organisation_id", "invitation_id"]
            isOneToOne: false
            referencedRelation: "organisation_invitations"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_invitation_grants_role_version_fkey"
            columns: ["organisation_id", "role_version_id"]
            isOneToOne: false
            referencedRelation: "role_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_invitation_grants_scope_unit_fkey"
            columns: ["organisation_id", "scope_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisation_invitation_provisioning: {
        Row: {
          created_at: string
          intended_display_name: string | null
          intended_job_function_id: string | null
          intended_organisational_unit_id: string | null
          invitation_id: string
          organisation_id: string
        }
        Insert: {
          created_at?: string
          intended_display_name?: string | null
          intended_job_function_id?: string | null
          intended_organisational_unit_id?: string | null
          invitation_id: string
          organisation_id: string
        }
        Update: {
          created_at?: string
          intended_display_name?: string | null
          intended_job_function_id?: string | null
          intended_organisational_unit_id?: string | null
          invitation_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitation_provisioning_invitation_fkey"
            columns: ["organisation_id", "invitation_id"]
            isOneToOne: true
            referencedRelation: "organisation_invitations"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_invitation_provisioning_job_function_fkey"
            columns: ["organisation_id", "intended_job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_invitation_provisioning_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitation_provisioning_unit_fkey"
            columns: ["organisation_id", "intended_organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisation_invitation_signup_bindings: {
        Row: {
          auth_user_id: string | null
          canonical_recipient: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          invitation_id: string
        }
        Insert: {
          auth_user_id?: string | null
          canonical_recipient: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          invitation_id: string
        }
        Update: {
          auth_user_id?: string | null
          canonical_recipient?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          invitation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitation_signup_bindings_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "organisation_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitations: {
        Row: {
          accepted_at: string | null
          accepted_membership_id: string | null
          canonical_recipient: string
          created_at: string
          expired_at: string | null
          expires_at: string
          id: string
          inviter_membership_id: string
          offer_sealed_at: string | null
          organisation_id: string
          recipient_type: string
          revoked_at: string | null
          status: string
          status_changed_at: string
          status_changed_by_membership_id: string | null
          status_reason: string | null
          token_digest: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_membership_id?: string | null
          canonical_recipient: string
          created_at?: string
          expired_at?: string | null
          expires_at: string
          id?: string
          inviter_membership_id: string
          offer_sealed_at?: string | null
          organisation_id: string
          recipient_type: string
          revoked_at?: string | null
          status?: string
          status_changed_at?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          token_digest: string
        }
        Update: {
          accepted_at?: string | null
          accepted_membership_id?: string | null
          canonical_recipient?: string
          created_at?: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          inviter_membership_id?: string
          offer_sealed_at?: string | null
          organisation_id?: string
          recipient_type?: string
          revoked_at?: string | null
          status?: string
          status_changed_at?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          token_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitations_accepted_membership_fkey"
            columns: ["organisation_id", "accepted_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_invitations_inviter_fkey"
            columns: ["organisation_id", "inviter_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_status_actor_fkey"
            columns: ["organisation_id", "status_changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisation_memberships: {
        Row: {
          activated_at: string | null
          created_at: string
          display_name: string | null
          id: string
          inactivated_at: string | null
          job_title: string | null
          organisation_id: string
          status: string
          status_changed_at: string
          status_changed_by_membership_id: string | null
          status_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          inactivated_at?: string | null
          job_title?: string | null
          organisation_id: string
          status?: string
          status_changed_at?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          inactivated_at?: string | null
          job_title?: string | null
          organisation_id?: string
          status?: string
          status_changed_at?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_memberships_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_memberships_status_actor_fkey"
            columns: ["organisation_id", "status_changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisation_unit_closure: {
        Row: {
          ancestor_unit_id: string
          created_at: string
          depth: number
          descendant_unit_id: string
          organisation_id: string
        }
        Insert: {
          ancestor_unit_id: string
          created_at?: string
          depth: number
          descendant_unit_id: string
          organisation_id: string
        }
        Update: {
          ancestor_unit_id?: string
          created_at?: string
          depth?: number
          descendant_unit_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_unit_closure_ancestor_fkey"
            columns: ["organisation_id", "ancestor_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_unit_closure_descendant_fkey"
            columns: ["organisation_id", "descendant_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_unit_closure_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_units: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          organisation_id: string
          parent_unit_id: string | null
          restored_at: string | null
          retired_at: string | null
          status: string
          status_changed_by_membership_id: string | null
          status_reason: string | null
          unit_type: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          organisation_id: string
          parent_unit_id?: string | null
          restored_at?: string | null
          retired_at?: string | null
          status?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          unit_type: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          parent_unit_id?: string | null
          restored_at?: string | null
          retired_at?: string | null
          status?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          unit_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organisation_units_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_units_parent_fkey"
            columns: ["organisation_id", "parent_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "organisation_units_status_actor_fkey"
            columns: ["organisation_id", "status_changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      organisations: {
        Row: {
          code: string
          created_at: string
          id: string
          locale: string
          name: string
          reporting_currency: string
          status: string
          status_changed_at: string
          status_changed_by_user_id: string | null
          status_reason: string | null
          time_zone: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          locale?: string
          name: string
          reporting_currency?: string
          status?: string
          status_changed_at?: string
          status_changed_by_user_id?: string | null
          status_reason?: string | null
          time_zone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          locale?: string
          name?: string
          reporting_currency?: string
          status?: string
          status_changed_at?: string
          status_changed_by_user_id?: string | null
          status_reason?: string | null
          time_zone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      permission_definitions: {
        Row: {
          created_at: string
          description: string
          is_protected: boolean
          permission_key: string
        }
        Insert: {
          created_at?: string
          description: string
          is_protected?: boolean
          permission_key: string
        }
        Update: {
          created_at?: string
          description?: string
          is_protected?: boolean
          permission_key?: string
        }
        Relationships: []
      }
      problem_solving_action_context: {
        Row: {
          action_id: string
          containment_id: string | null
          context_role: string
          countermeasure_id: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          problem_solving_case_id: string
          sustainment_item_id: string | null
        }
        Insert: {
          action_id: string
          containment_id?: string | null
          context_role: string
          countermeasure_id?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          problem_solving_case_id: string
          sustainment_item_id?: string | null
        }
        Update: {
          action_id?: string
          containment_id?: string | null
          context_role?: string
          countermeasure_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          problem_solving_case_id?: string
          sustainment_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_action_context_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_action_context_containment_fkey"
            columns: ["organisation_id", "containment_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_containments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_action_context_countermeasure_fkey"
            columns: ["organisation_id", "countermeasure_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_countermeasures"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_action_context_sustainment_item_fkey"
            columns: ["organisation_id", "sustainment_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sustainment_items"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_analyses: {
        Row: {
          analysis_type: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          problem_solving_case_id: string
          title: string
          updated_at: string
        }
        Insert: {
          analysis_type: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          problem_solving_case_id: string
          title: string
          updated_at?: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          problem_solving_case_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_analyses_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_analyses_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_analysis_nodes: {
        Row: {
          analysis_id: string
          category: string | null
          created_at: string
          created_by_membership_id: string
          display_metadata: Json
          id: string
          label: string
          linked_hypothesis_id: string | null
          organisation_id: string
          parent_node_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          analysis_id: string
          category?: string | null
          created_at?: string
          created_by_membership_id: string
          display_metadata?: Json
          id?: string
          label: string
          linked_hypothesis_id?: string | null
          organisation_id: string
          parent_node_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          category?: string | null
          created_at?: string
          created_by_membership_id?: string
          display_metadata?: Json
          id?: string
          label?: string
          linked_hypothesis_id?: string | null
          organisation_id?: string
          parent_node_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_analysis_nodes_analysis_fkey"
            columns: ["organisation_id", "analysis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_analyses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_analysis_nodes_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_analysis_nodes_hypothesis_fkey"
            columns: ["organisation_id", "linked_hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_analysis_nodes_parent_fkey"
            columns: ["organisation_id", "parent_node_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_analysis_nodes"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_cases: {
        Row: {
          activated_at: string | null
          background: string | null
          business_impact: string | null
          cancellation_rationale: string | null
          cancelled_at: string | null
          cancelled_by_membership_id: string | null
          case_number: string | null
          closed_at: string | null
          closed_by_membership_id: string | null
          closure_outcome: string | null
          closure_rationale: string | null
          created_at: string
          created_by_membership_id: string
          current_method_stage_id: string | null
          detected_at: string | null
          facilitator_membership_id: string | null
          id: string
          method_version_id: string | null
          organisation_id: string
          organisation_unit_id: string
          owner_membership_id: string
          priority: string | null
          problem_statement: string | null
          scope_in: string | null
          scope_out: string | null
          severity: string | null
          status: string
          target_condition: string | null
          target_due_at: string | null
          title: string
          transferred_to_reference: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          background?: string | null
          business_impact?: string | null
          cancellation_rationale?: string | null
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          case_number?: string | null
          closed_at?: string | null
          closed_by_membership_id?: string | null
          closure_outcome?: string | null
          closure_rationale?: string | null
          created_at?: string
          created_by_membership_id: string
          current_method_stage_id?: string | null
          detected_at?: string | null
          facilitator_membership_id?: string | null
          id: string
          method_version_id?: string | null
          organisation_id: string
          organisation_unit_id: string
          owner_membership_id: string
          priority?: string | null
          problem_statement?: string | null
          scope_in?: string | null
          scope_out?: string | null
          severity?: string | null
          status?: string
          target_condition?: string | null
          target_due_at?: string | null
          title: string
          transferred_to_reference?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          background?: string | null
          business_impact?: string | null
          cancellation_rationale?: string | null
          cancelled_at?: string | null
          cancelled_by_membership_id?: string | null
          case_number?: string | null
          closed_at?: string | null
          closed_by_membership_id?: string | null
          closure_outcome?: string | null
          closure_rationale?: string | null
          created_at?: string
          created_by_membership_id?: string
          current_method_stage_id?: string | null
          detected_at?: string | null
          facilitator_membership_id?: string | null
          id?: string
          method_version_id?: string | null
          organisation_id?: string
          organisation_unit_id?: string
          owner_membership_id?: string
          priority?: string | null
          problem_statement?: string | null
          scope_in?: string | null
          scope_out?: string | null
          severity?: string | null
          status?: string
          target_condition?: string | null
          target_due_at?: string | null
          title?: string
          transferred_to_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_cases_cancelled_by_fkey"
            columns: ["organisation_id", "cancelled_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_closed_by_fkey"
            columns: ["organisation_id", "closed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_current_stage_fkey"
            columns: ["organisation_id", "current_method_stage_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_method_stages"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_facilitator_fkey"
            columns: ["organisation_id", "facilitator_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_method_version_fkey"
            columns: ["organisation_id", "method_version_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_method_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_owner_fkey"
            columns: ["organisation_id", "owner_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_cases_unit_fkey"
            columns: ["organisation_id", "organisation_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_containments: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string
          id: string
          implemented_at: string | null
          is_still_required: boolean
          organisation_id: string
          problem_solving_case_id: string
          rationale: string | null
          release_rationale: string | null
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description: string
          id?: string
          implemented_at?: string | null
          is_still_required?: boolean
          organisation_id: string
          problem_solving_case_id: string
          rationale?: string | null
          release_rationale?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string
          id?: string
          implemented_at?: string | null
          is_still_required?: boolean
          organisation_id?: string
          problem_solving_case_id?: string
          rationale?: string | null
          release_rationale?: string | null
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_containments_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_containments_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_countermeasure_cause_links: {
        Row: {
          countermeasure_id: string
          created_at: string
          created_by_membership_id: string
          hypothesis_id: string
          id: string
          organisation_id: string
        }
        Insert: {
          countermeasure_id: string
          created_at?: string
          created_by_membership_id: string
          hypothesis_id: string
          id?: string
          organisation_id: string
        }
        Update: {
          countermeasure_id?: string
          created_at?: string
          created_by_membership_id?: string
          hypothesis_id?: string
          id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_cm_cause_links_countermeasure_fkey"
            columns: ["organisation_id", "countermeasure_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_countermeasures"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_cm_cause_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_cm_cause_links_hypothesis_fkey"
            columns: ["organisation_id", "hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_countermeasures: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organisation_id: string
          problem_solving_case_id: string
          proposed_by_membership_id: string
          rationale: string | null
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejected_rationale: string | null
          selected_at: string | null
          selected_by_membership_id: string | null
          selected_rationale: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organisation_id: string
          problem_solving_case_id: string
          proposed_by_membership_id: string
          rationale?: string | null
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejected_rationale?: string | null
          selected_at?: string | null
          selected_by_membership_id?: string | null
          selected_rationale?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organisation_id?: string
          problem_solving_case_id?: string
          proposed_by_membership_id?: string
          rationale?: string | null
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejected_rationale?: string | null
          selected_at?: string | null
          selected_by_membership_id?: string | null
          selected_rationale?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_countermeasures_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_countermeasures_proposer_fkey"
            columns: ["organisation_id", "proposed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_countermeasures_rejector_fkey"
            columns: ["organisation_id", "rejected_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_countermeasures_selector_fkey"
            columns: ["organisation_id", "selected_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_current_condition_items: {
        Row: {
          case_id: string
          category: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          statement: string
          status: string
          superseded_at: string | null
          supersedes_item_id: string | null
          verification_rationale: string | null
          verified_at: string | null
          verified_by_membership_id: string | null
        }
        Insert: {
          case_id: string
          category: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          statement: string
          status?: string
          superseded_at?: string | null
          supersedes_item_id?: string | null
          verification_rationale?: string | null
          verified_at?: string | null
          verified_by_membership_id?: string | null
        }
        Update: {
          case_id?: string
          category?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          statement?: string
          status?: string
          superseded_at?: string | null
          supersedes_item_id?: string | null
          verification_rationale?: string | null
          verified_at?: string | null
          verified_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_current_condition_items_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_current_condition_items_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_current_condition_items_supersedes_fkey"
            columns: ["organisation_id", "supersedes_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_current_condition_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_current_condition_items_verified_by_fkey"
            columns: ["organisation_id", "verified_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_effectiveness_checks: {
        Row: {
          actual_numeric: number | null
          baseline_description: string | null
          baseline_numeric: number | null
          case_id: string
          created_at: string
          created_by_membership_id: string
          criterion: string
          due_date: string | null
          id: string
          observation_window_end: string | null
          observation_window_start: string | null
          organisation_id: string
          result: string | null
          target_description: string | null
          target_numeric: number | null
          unit: string | null
          updated_at: string
          verified_at: string | null
          verified_by_membership_id: string | null
        }
        Insert: {
          actual_numeric?: number | null
          baseline_description?: string | null
          baseline_numeric?: number | null
          case_id: string
          created_at?: string
          created_by_membership_id: string
          criterion: string
          due_date?: string | null
          id?: string
          observation_window_end?: string | null
          observation_window_start?: string | null
          organisation_id: string
          result?: string | null
          target_description?: string | null
          target_numeric?: number | null
          unit?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by_membership_id?: string | null
        }
        Update: {
          actual_numeric?: number | null
          baseline_description?: string | null
          baseline_numeric?: number | null
          case_id?: string
          created_at?: string
          created_by_membership_id?: string
          criterion?: string
          due_date?: string | null
          id?: string
          observation_window_end?: string | null
          observation_window_start?: string | null
          organisation_id?: string
          result?: string | null
          target_description?: string | null
          target_numeric?: number | null
          unit?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ps_effectiveness_checks_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_effectiveness_checks_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_effectiveness_checks_verifier_fkey"
            columns: ["organisation_id", "verified_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_effectiveness_evidence_links: {
        Row: {
          attachment_id: string
          created_at: string
          created_by_membership_id: string
          effectiveness_check_id: string
          id: string
          organisation_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          created_by_membership_id: string
          effectiveness_check_id: string
          id?: string
          organisation_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          created_by_membership_id?: string
          effectiveness_check_id?: string
          id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_eff_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_eff_evidence_links_check_fkey"
            columns: ["organisation_id", "effectiveness_check_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_effectiveness_checks"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_eff_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_evidence_links: {
        Row: {
          attachment_id: string
          containment_id: string | null
          countermeasure_id: string | null
          created_at: string
          created_by_membership_id: string
          current_condition_item_id: string | null
          effectiveness_check_id: string | null
          hypothesis_id: string | null
          hypothesis_test_id: string | null
          id: string
          is_case_level: boolean
          link_rationale: string | null
          organisation_id: string
          problem_solving_case_id: string
          session_entry_id: string | null
          session_id: string | null
          sustainment_item_id: string | null
        }
        Insert: {
          attachment_id: string
          containment_id?: string | null
          countermeasure_id?: string | null
          created_at?: string
          created_by_membership_id: string
          current_condition_item_id?: string | null
          effectiveness_check_id?: string | null
          hypothesis_id?: string | null
          hypothesis_test_id?: string | null
          id?: string
          is_case_level?: boolean
          link_rationale?: string | null
          organisation_id: string
          problem_solving_case_id: string
          session_entry_id?: string | null
          session_id?: string | null
          sustainment_item_id?: string | null
        }
        Update: {
          attachment_id?: string
          containment_id?: string | null
          countermeasure_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          current_condition_item_id?: string | null
          effectiveness_check_id?: string | null
          hypothesis_id?: string | null
          hypothesis_test_id?: string | null
          id?: string
          is_case_level?: boolean
          link_rationale?: string | null
          organisation_id?: string
          problem_solving_case_id?: string
          session_entry_id?: string | null
          session_id?: string | null
          sustainment_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_evidence_links_attachment_fkey"
            columns: ["organisation_id", "attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_condition_item_fkey"
            columns: ["organisation_id", "current_condition_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_current_condition_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_containment_fkey"
            columns: ["organisation_id", "containment_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_containments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_countermeasure_fkey"
            columns: ["organisation_id", "countermeasure_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_countermeasures"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_effectiveness_check_fkey"
            columns: ["organisation_id", "effectiveness_check_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_effectiveness_checks"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_hypothesis_fkey"
            columns: ["organisation_id", "hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_hypothesis_test_fkey"
            columns: ["organisation_id", "hypothesis_test_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypothesis_tests"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_session_entry_fkey"
            columns: ["organisation_id", "session_entry_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_session_entries"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_session_fkey"
            columns: ["organisation_id", "session_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_evidence_links_sustainment_item_fkey"
            columns: ["organisation_id", "sustainment_item_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sustainment_items"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_hypotheses: {
        Row: {
          category: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          parent_hypothesis_id: string | null
          problem_solving_case_id: string
          rationale: string | null
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejection_rationale: string | null
          statement: string
          status: string
          updated_at: string
          verification_rationale: string | null
          verified_at: string | null
          verified_by_membership_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          parent_hypothesis_id?: string | null
          problem_solving_case_id: string
          rationale?: string | null
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejection_rationale?: string | null
          statement: string
          status?: string
          updated_at?: string
          verification_rationale?: string | null
          verified_at?: string | null
          verified_by_membership_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          parent_hypothesis_id?: string | null
          problem_solving_case_id?: string
          rationale?: string | null
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejection_rationale?: string | null
          statement?: string
          status?: string
          updated_at?: string
          verification_rationale?: string | null
          verified_at?: string | null
          verified_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_hypotheses_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypotheses_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypotheses_parent_fkey"
            columns: ["organisation_id", "parent_hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypotheses_rejected_by_fkey"
            columns: ["organisation_id", "rejected_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypotheses_verified_by_fkey"
            columns: ["organisation_id", "verified_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_hypothesis_status_history: {
        Row: {
          changed_at: string
          changed_by_membership_id: string
          from_status: string
          hypothesis_id: string
          id: string
          organisation_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by_membership_id: string
          from_status: string
          hypothesis_id: string
          id?: string
          organisation_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by_membership_id?: string
          from_status?: string
          hypothesis_id?: string
          id?: string
          organisation_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_hypothesis_status_history_actor_fkey"
            columns: ["organisation_id", "changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_hypothesis_status_history_hypothesis_fkey"
            columns: ["organisation_id", "hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_hypothesis_tests: {
        Row: {
          actual_result: string | null
          completed_date: string | null
          conclusion: string | null
          created_at: string
          created_by_membership_id: string
          expected_result: string
          hypothesis_id: string
          id: string
          method: string | null
          organisation_id: string
          owner_membership_id: string
          planned_date: string | null
          problem_solving_case_id: string
          test_question: string
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          completed_date?: string | null
          conclusion?: string | null
          created_at?: string
          created_by_membership_id: string
          expected_result: string
          hypothesis_id: string
          id?: string
          method?: string | null
          organisation_id: string
          owner_membership_id: string
          planned_date?: string | null
          problem_solving_case_id: string
          test_question: string
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          completed_date?: string | null
          conclusion?: string | null
          created_at?: string
          created_by_membership_id?: string
          expected_result?: string
          hypothesis_id?: string
          id?: string
          method?: string | null
          organisation_id?: string
          owner_membership_id?: string
          planned_date?: string | null
          problem_solving_case_id?: string
          test_question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_hypothesis_tests_case_fkey"
            columns: ["organisation_id", "problem_solving_case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypothesis_tests_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypothesis_tests_hypothesis_fkey"
            columns: ["organisation_id", "hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_hypothesis_tests_owner_fkey"
            columns: ["organisation_id", "owner_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_lessons_learned: {
        Row: {
          apply_elsewhere: string | null
          case_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          notes: string | null
          organisation_id: string
          standardise: string | null
          updated_at: string
          what_happened: string
          what_learned: string
        }
        Insert: {
          apply_elsewhere?: string | null
          case_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          notes?: string | null
          organisation_id: string
          standardise?: string | null
          updated_at?: string
          what_happened: string
          what_learned: string
        }
        Update: {
          apply_elsewhere?: string | null
          case_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          standardise?: string | null
          updated_at?: string
          what_happened?: string
          what_learned?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_lessons_learned_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_lessons_learned_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_method_stages: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          method_version_id: string
          organisation_id: string
          semantic_stage_key: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order: number
          id?: string
          method_version_id: string
          organisation_id: string
          semantic_stage_key: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          method_version_id?: string
          organisation_id?: string
          semantic_stage_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_method_stages_version_fkey"
            columns: ["organisation_id", "method_version_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_method_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_method_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          method_id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          method_id: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          method_id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_method_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_method_versions_method_fkey"
            columns: ["organisation_id", "method_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_methods"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_method_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_methods: {
        Row: {
          builtin_code: string | null
          code: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          id: string
          is_builtin: boolean
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          builtin_code?: string | null
          code: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          builtin_code?: string | null
          code?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_methods_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_methods_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_solving_participants: {
        Row: {
          added_at: string
          added_by_membership_id: string
          case_id: string
          id: string
          membership_id: string
          organisation_id: string
          participant_role: string
          removed_at: string | null
        }
        Insert: {
          added_at?: string
          added_by_membership_id: string
          case_id: string
          id?: string
          membership_id: string
          organisation_id: string
          participant_role: string
          removed_at?: string | null
        }
        Update: {
          added_at?: string
          added_by_membership_id?: string
          case_id?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          participant_role?: string
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_participants_added_by_fkey"
            columns: ["organisation_id", "added_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_participants_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_participants_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_session_entries: {
        Row: {
          body: string
          created_at: string
          created_by_membership_id: string
          entry_type: string
          id: string
          organisation_id: string
          reference_action_id: string | null
          reference_attachment_id: string | null
          reference_hypothesis_id: string | null
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by_membership_id: string
          entry_type: string
          id?: string
          organisation_id: string
          reference_action_id?: string | null
          reference_attachment_id?: string | null
          reference_hypothesis_id?: string | null
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by_membership_id?: string
          entry_type?: string
          id?: string
          organisation_id?: string
          reference_action_id?: string | null
          reference_attachment_id?: string | null
          reference_hypothesis_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_session_entries_action_fkey"
            columns: ["organisation_id", "reference_action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_session_entries_attachment_fkey"
            columns: ["organisation_id", "reference_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_session_entries_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_session_entries_hypothesis_fkey"
            columns: ["organisation_id", "reference_hypothesis_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_hypotheses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_session_entries_session_fkey"
            columns: ["organisation_id", "session_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_session_participants: {
        Row: {
          added_at: string
          added_by_membership_id: string
          id: string
          membership_id: string
          organisation_id: string
          session_id: string
        }
        Insert: {
          added_at?: string
          added_by_membership_id: string
          id?: string
          membership_id: string
          organisation_id: string
          session_id: string
        }
        Update: {
          added_at?: string
          added_by_membership_id?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_session_participants_adder_fkey"
            columns: ["organisation_id", "added_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_session_participants_member_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_session_participants_session_fkey"
            columns: ["organisation_id", "session_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_sessions: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          facilitator_membership_id: string
          id: string
          organisation_id: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          facilitator_membership_id: string
          id?: string
          organisation_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          facilitator_membership_id?: string
          id?: string
          organisation_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_sessions_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_sessions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_sessions_facilitator_fkey"
            columns: ["organisation_id", "facilitator_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_source_links: {
        Row: {
          case_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          link_role: string
          organisation_id: string
          source_resource_id: string
          source_resource_type: string | null
          source_title_snapshot: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          link_role?: string
          organisation_id: string
          source_resource_id: string
          source_resource_type?: string | null
          source_title_snapshot?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          link_role?: string
          organisation_id?: string
          source_resource_id?: string
          source_resource_type?: string | null
          source_title_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_source_links_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_source_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_source_links_source_fkey"
            columns: ["organisation_id", "source_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_stage_history: {
        Row: {
          case_id: string
          changed_at: string
          changed_by_membership_id: string
          from_stage_id: string | null
          id: string
          notes: string | null
          organisation_id: string
          to_stage_id: string
        }
        Insert: {
          case_id: string
          changed_at?: string
          changed_by_membership_id: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          to_stage_id: string
        }
        Update: {
          case_id?: string
          changed_at?: string
          changed_by_membership_id?: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_stage_history_actor_fkey"
            columns: ["organisation_id", "changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_stage_history_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_stage_history_from_stage_fkey"
            columns: ["organisation_id", "from_stage_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_method_stages"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_stage_history_to_stage_fkey"
            columns: ["organisation_id", "to_stage_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_method_stages"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_status_history: {
        Row: {
          case_id: string
          changed_at: string
          changed_by_membership_id: string
          from_status: string
          id: string
          organisation_id: string
          rationale: string | null
          to_status: string
        }
        Insert: {
          case_id: string
          changed_at?: string
          changed_by_membership_id: string
          from_status: string
          id?: string
          organisation_id: string
          rationale?: string | null
          to_status: string
        }
        Update: {
          case_id?: string
          changed_at?: string
          changed_by_membership_id?: string
          from_status?: string
          id?: string
          organisation_id?: string
          rationale?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_solving_status_history_actor_fkey"
            columns: ["organisation_id", "changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "problem_solving_status_history_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      problem_solving_sustainment_items: {
        Row: {
          case_id: string
          check_method: string | null
          created_at: string
          created_by_membership_id: string
          evidence: string | null
          follow_up_date: string | null
          id: string
          organisation_id: string
          owner_membership_id: string | null
          result: string | null
          schedule_definition_id: string | null
          training_session_id: string | null
          updated_at: string
          what: string
        }
        Insert: {
          case_id: string
          check_method?: string | null
          created_at?: string
          created_by_membership_id: string
          evidence?: string | null
          follow_up_date?: string | null
          id?: string
          organisation_id: string
          owner_membership_id?: string | null
          result?: string | null
          schedule_definition_id?: string | null
          training_session_id?: string | null
          updated_at?: string
          what: string
        }
        Update: {
          case_id?: string
          check_method?: string | null
          created_at?: string
          created_by_membership_id?: string
          evidence?: string | null
          follow_up_date?: string | null
          id?: string
          organisation_id?: string
          owner_membership_id?: string | null
          result?: string | null
          schedule_definition_id?: string | null
          training_session_id?: string | null
          updated_at?: string
          what?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_sustainment_items_case_fkey"
            columns: ["organisation_id", "case_id"]
            isOneToOne: false
            referencedRelation: "problem_solving_cases"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_sustainment_items_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_sustainment_items_owner_fkey"
            columns: ["organisation_id", "owner_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_sustainment_items_schedule_fkey"
            columns: ["organisation_id", "schedule_definition_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "ps_sustainment_items_training_fkey"
            columns: ["organisation_id", "training_session_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recognition_awards: {
        Row: {
          awarded_at: string
          awarded_by_membership_id: string
          created_at: string
          id: string
          message: string
          organisation_id: string
          organisational_unit_id: string
          recognition_type_id: string
          recognition_type_name_snapshot: string
          source_resource_id: string | null
          status: string
          title: string
          visibility: string
        }
        Insert: {
          awarded_at?: string
          awarded_by_membership_id: string
          created_at?: string
          id: string
          message: string
          organisation_id: string
          organisational_unit_id: string
          recognition_type_id: string
          recognition_type_name_snapshot: string
          source_resource_id?: string | null
          status?: string
          title: string
          visibility?: string
        }
        Update: {
          awarded_at?: string
          awarded_by_membership_id?: string
          created_at?: string
          id?: string
          message?: string
          organisation_id?: string
          organisational_unit_id?: string
          recognition_type_id?: string
          recognition_type_name_snapshot?: string
          source_resource_id?: string | null
          status?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_awards_awarder_fkey"
            columns: ["organisation_id", "awarded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_awards_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_awards_source_fkey"
            columns: ["organisation_id", "source_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_awards_type_fkey"
            columns: ["organisation_id", "recognition_type_id"]
            isOneToOne: false
            referencedRelation: "recognition_types"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_awards_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      recognition_recipients: {
        Row: {
          contribution_summary: string | null
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          recognition_award_id: string
        }
        Insert: {
          contribution_summary?: string | null
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          recognition_award_id: string
        }
        Update: {
          contribution_summary?: string | null
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          recognition_award_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_recipients_award_fkey"
            columns: ["organisation_id", "recognition_award_id"]
            isOneToOne: false
            referencedRelation: "recognition_awards"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_recipients_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      recognition_revocations: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          reason: string
          recognition_award_id: string
          revoked_at: string
          revoked_by_membership_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          reason: string
          recognition_award_id: string
          revoked_at?: string
          revoked_by_membership_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          reason?: string
          recognition_award_id?: string
          revoked_at?: string
          revoked_by_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_revocations_award_fkey"
            columns: ["organisation_id", "recognition_award_id"]
            isOneToOne: true
            referencedRelation: "recognition_awards"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_revocations_revoker_fkey"
            columns: ["organisation_id", "revoked_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      recognition_types: {
        Row: {
          code: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          display_metadata: Json | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          display_metadata?: Json | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          display_metadata?: Json | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recognition_types_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "recognition_types_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_records: {
        Row: {
          created_at: string
          created_by_membership_id: string | null
          id: string
          organisation_id: string
          resource_type: string
          retired_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_membership_id?: string | null
          id?: string
          organisation_id: string
          resource_type: string
          retired_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string | null
          id?: string
          organisation_id?: string
          resource_type?: string
          retired_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_records_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "resource_records_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_grant_scope_policies: {
        Row: {
          organisation_id: string
          role_id: string
          scope_type: string
        }
        Insert: {
          organisation_id: string
          role_id: string
          scope_type: string
        }
        Update: {
          organisation_id?: string
          role_id?: string
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_grant_scope_policies_role_fkey"
            columns: ["organisation_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          permission_key: string
          role_version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          permission_key: string
          role_version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          permission_key?: string
          role_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "role_permissions_role_version_fkey"
            columns: ["organisation_id", "role_version_id"]
            isOneToOne: false
            referencedRelation: "role_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      role_versions: {
        Row: {
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          retired_at: string | null
          retired_by_membership_id: string | null
          role_id: string
          status: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          retired_at?: string | null
          retired_by_membership_id?: string | null
          role_id: string
          status?: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          retired_at?: string | null
          retired_by_membership_id?: string | null
          role_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "role_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "role_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "role_versions_retirer_fkey"
            columns: ["organisation_id", "retired_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "role_versions_role_fkey"
            columns: ["organisation_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      roles: {
        Row: {
          archived_at: string | null
          canonical_name: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_owner_role: boolean
          is_protected: boolean
          organisation_id: string
          status: string
          status_changed_by_membership_id: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          canonical_name: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_owner_role?: boolean
          is_protected?: boolean
          organisation_id: string
          status?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          canonical_name?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_owner_role?: boolean
          is_protected?: boolean
          organisation_id?: string
          status?: string
          status_changed_by_membership_id?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_status_actor_fkey"
            columns: ["organisation_id", "status_changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      schedule_definitions: {
        Row: {
          activity_resource_id: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          end_date: string | null
          id: string
          is_all_day: boolean
          local_time: string | null
          organisation_id: string
          owner_membership_id: string
          recurrence: Json
          start_date: string
          status: string
          timezone: string
          title: string
          unit_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          activity_resource_id: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          end_date?: string | null
          id: string
          is_all_day?: boolean
          local_time?: string | null
          organisation_id: string
          owner_membership_id: string
          recurrence: Json
          start_date: string
          status?: string
          timezone: string
          title: string
          unit_id: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          activity_resource_id?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_all_day?: boolean
          local_time?: string | null
          organisation_id?: string
          owner_membership_id?: string
          recurrence?: Json
          start_date?: string
          status?: string
          timezone?: string
          title?: string
          unit_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_definitions_activity_resource_fkey"
            columns: ["organisation_id", "activity_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_definitions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_definitions_owner_fkey"
            columns: ["organisation_id", "owner_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_definitions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_definitions_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      schedule_occurrences: {
        Row: {
          completed_at: string | null
          completion_resource_id: string | null
          created_at: string
          id: string
          is_all_day: boolean
          lifecycle_status: string
          local_time: string | null
          organisation_id: string
          owner_membership_id: string
          planned_at: string
          planned_local_date: string
          schedule_definition_id: string
          unit_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_resource_id?: string | null
          created_at?: string
          id?: string
          is_all_day: boolean
          lifecycle_status?: string
          local_time?: string | null
          organisation_id: string
          owner_membership_id: string
          planned_at: string
          planned_local_date: string
          schedule_definition_id: string
          unit_id: string
        }
        Update: {
          completed_at?: string | null
          completion_resource_id?: string | null
          created_at?: string
          id?: string
          is_all_day?: boolean
          lifecycle_status?: string
          local_time?: string | null
          organisation_id?: string
          owner_membership_id?: string
          planned_at?: string
          planned_local_date?: string
          schedule_definition_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_occurrences_completion_resource_fkey"
            columns: ["organisation_id", "completion_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_occurrences_owner_fkey"
            columns: ["organisation_id", "owner_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_occurrences_schedule_fkey"
            columns: ["organisation_id", "schedule_definition_id"]
            isOneToOne: false
            referencedRelation: "schedule_definitions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_occurrences_unit_fkey"
            columns: ["organisation_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      schedule_participants: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          schedule_definition_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          schedule_definition_id: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          schedule_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_participants_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "schedule_participants_schedule_fkey"
            columns: ["organisation_id", "schedule_definition_id"]
            isOneToOne: false
            referencedRelation: "schedule_definitions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      security_audit_events: {
        Row: {
          action: string
          actor_membership_id: string | null
          actor_session_id: string | null
          actor_user_id: string | null
          id: string
          metadata: Json
          occurred_at: string
          organisation_id: string | null
          outcome: string
          request_correlation_id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_membership_id?: string | null
          actor_session_id?: string | null
          actor_user_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          organisation_id?: string | null
          outcome: string
          request_correlation_id: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_membership_id?: string | null
          actor_session_id?: string | null
          actor_user_id?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          organisation_id?: string | null
          outcome?: string
          request_correlation_id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_events_actor_membership_fkey"
            columns: ["organisation_id", "actor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "security_audit_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_capability_set_versions: {
        Row: {
          archived_at: string | null
          capability_set_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          capability_set_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          capability_set_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_capability_set_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_capability_set_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_capability_set_versions_set_fkey"
            columns: ["organisation_id", "capability_set_id"]
            isOneToOne: false
            referencedRelation: "skill_capability_sets"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      skill_capability_sets: {
        Row: {
          code: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_capability_sets_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_capability_sets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_proficiency_levels: {
        Row: {
          created_at: string
          description: string | null
          guidance: string | null
          id: string
          label: string
          order_value: number
          organisation_id: string
          scale_version_id: string
          semantic_token: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          label: string
          order_value: number
          organisation_id: string
          scale_version_id: string
          semantic_token?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          guidance?: string | null
          id?: string
          label?: string
          order_value?: number
          organisation_id?: string
          scale_version_id?: string
          semantic_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_proficiency_levels_version_fkey"
            columns: ["organisation_id", "scale_version_id"]
            isOneToOne: false
            referencedRelation: "skill_proficiency_scale_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      skill_proficiency_scale_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          scale_id: string
          status: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          scale_id: string
          status?: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          scale_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_proficiency_scale_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_proficiency_scale_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_proficiency_scale_versions_scale_fkey"
            columns: ["organisation_id", "scale_id"]
            isOneToOne: false
            referencedRelation: "skill_proficiency_scales"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      skill_proficiency_scales: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_proficiency_scales_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_proficiency_scales_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_requirements: {
        Row: {
          capability_set_version_id: string
          created_at: string
          evidence_requirement: string | null
          id: string
          job_function_id: string | null
          mandatory: boolean
          notes: string | null
          organisation_id: string
          organisational_unit_id: string | null
          proficiency_scale_version_id: string
          skill_id: string
          target_proficiency_level_id: string
        }
        Insert: {
          capability_set_version_id: string
          created_at?: string
          evidence_requirement?: string | null
          id?: string
          job_function_id?: string | null
          mandatory?: boolean
          notes?: string | null
          organisation_id: string
          organisational_unit_id?: string | null
          proficiency_scale_version_id: string
          skill_id: string
          target_proficiency_level_id: string
        }
        Update: {
          capability_set_version_id?: string
          created_at?: string
          evidence_requirement?: string | null
          id?: string
          job_function_id?: string | null
          mandatory?: boolean
          notes?: string | null
          organisation_id?: string
          organisational_unit_id?: string | null
          proficiency_scale_version_id?: string
          skill_id?: string
          target_proficiency_level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_requirements_job_function_fkey"
            columns: ["organisation_id", "job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_requirements_scale_version_fkey"
            columns: ["organisation_id", "proficiency_scale_version_id"]
            isOneToOne: false
            referencedRelation: "skill_proficiency_scale_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_requirements_skill_fkey"
            columns: ["organisation_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_requirements_target_level_fkey"
            columns: ["organisation_id", "target_proficiency_level_id"]
            isOneToOne: false
            referencedRelation: "skill_proficiency_levels"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_requirements_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skill_requirements_version_fkey"
            columns: ["organisation_id", "capability_set_version_id"]
            isOneToOne: false
            referencedRelation: "skill_capability_set_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by_membership_id: string
          deactivated_at: string | null
          description: string | null
          evidence_expectations: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by_membership_id: string
          deactivated_at?: string | null
          description?: string | null
          evidence_expectations?: string | null
          id: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by_membership_id?: string
          deactivated_at?: string | null
          description?: string | null
          evidence_expectations?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "skills_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_action_context: {
        Row: {
          action_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          purpose: string | null
          suggestion_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          purpose?: string | null
          suggestion_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          purpose?: string | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_action_context_action_fkey"
            columns: ["organisation_id", "action_id"]
            isOneToOne: true
            referencedRelation: "actions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_action_context_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_action_context_suggestion_fkey"
            columns: ["organisation_id", "suggestion_id"]
            isOneToOne: false
            referencedRelation: "improvement_suggestions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_categories_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_contributor_assignments: {
        Row: {
          assigned_by_membership_id: string
          contribution_role: string
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          suggestion_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          assigned_by_membership_id: string
          contribution_role: string
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          suggestion_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          assigned_by_membership_id?: string
          contribution_role?: string
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          suggestion_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_contributor_assignments_assigner_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_contributor_assignments_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_contributor_assignments_suggestion_fkey"
            columns: ["organisation_id", "suggestion_id"]
            isOneToOne: false
            referencedRelation: "improvement_suggestions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_implementation_links: {
        Row: {
          created_at: string
          created_by_membership_id: string
          id: string
          implementation_resource_id: string
          implementation_role: string
          organisation_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          id?: string
          implementation_resource_id: string
          implementation_role: string
          organisation_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          id?: string
          implementation_resource_id?: string
          implementation_role?: string
          organisation_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_implementation_links_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_implementation_links_resource_fkey"
            columns: ["organisation_id", "implementation_resource_id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_implementation_links_suggestion_fkey"
            columns: ["organisation_id", "suggestion_id"]
            isOneToOne: false
            referencedRelation: "improvement_suggestions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_programme_versions: {
        Row: {
          applicable_unit_id: string | null
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          lifecycle: string
          organisation_id: string
          programme_id: string
          published_at: string | null
          published_by_membership_id: string | null
          review_target_days: number | null
          submission_guidance: string | null
          template_version_id: string | null
          version_number: number
        }
        Insert: {
          applicable_unit_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          lifecycle?: string
          organisation_id: string
          programme_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          review_target_days?: number | null
          submission_guidance?: string | null
          template_version_id?: string | null
          version_number: number
        }
        Update: {
          applicable_unit_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          lifecycle?: string
          organisation_id?: string
          programme_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          review_target_days?: number | null
          submission_guidance?: string | null
          template_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_programme_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_programme_versions_programme_fkey"
            columns: ["organisation_id", "programme_id"]
            isOneToOne: false
            referencedRelation: "suggestion_programmes"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_programme_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_programme_versions_template_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_programme_versions_unit_fkey"
            columns: ["organisation_id", "applicable_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_programmes: {
        Row: {
          code: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_programmes_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_programmes_organisation_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_review_assignments: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          completed_at: string | null
          id: string
          organisation_id: string
          reviewer_membership_id: string
          status: string
          suggestion_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          completed_at?: string | null
          id?: string
          organisation_id: string
          reviewer_membership_id: string
          status?: string
          suggestion_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          completed_at?: string | null
          id?: string
          organisation_id?: string
          reviewer_membership_id?: string
          status?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_review_assignments_assigner_fkey"
            columns: ["organisation_id", "assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_review_assignments_reviewer_fkey"
            columns: ["organisation_id", "reviewer_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_review_assignments_suggestion_fkey"
            columns: ["organisation_id", "suggestion_id"]
            isOneToOne: false
            referencedRelation: "improvement_suggestions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_reviews: {
        Row: {
          created_at: string
          decision: string
          effort_level: string
          id: string
          impact_level: string
          implementation_recommendation: string | null
          organisation_id: string
          rationale: string
          review_date: string
          reviewer_membership_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          effort_level: string
          id?: string
          impact_level: string
          implementation_recommendation?: string | null
          organisation_id: string
          rationale: string
          review_date?: string
          reviewer_membership_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          effort_level?: string
          id?: string
          impact_level?: string
          implementation_recommendation?: string | null
          organisation_id?: string
          rationale?: string
          review_date?: string
          reviewer_membership_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_reviews_reviewer_fkey"
            columns: ["organisation_id", "reviewer_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_reviews_suggestion_fkey"
            columns: ["organisation_id", "suggestion_id"]
            isOneToOne: false
            referencedRelation: "improvement_suggestions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      suggestion_status_history: {
        Row: {
          changed_at: string
          changed_by_membership_id: string
          from_status: string
          id: string
          organisation_id: string
          reason: string | null
          suggestion_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by_membership_id: string
          from_status: string
          id?: string
          organisation_id: string
          reason?: string | null
          suggestion_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by_membership_id?: string
          from_status?: string
          id?: string
          organisation_id?: string
          reason?: string | null
          suggestion_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_status_history_actor_fkey"
            columns: ["organisation_id", "changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "suggestion_status_history_suggestion_fkey"
            columns: ["organisation_id", "suggestion_id"]
            isOneToOne: false
            referencedRelation: "improvement_suggestions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      template_answer_people: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          question_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          question_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          question_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_answer_people_member_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_answer_people_question_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_answer_people_submission_fkey"
            columns: ["organisation_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "template_submissions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      template_answers: {
        Row: {
          created_at: string
          date_value: string | null
          id: string
          is_not_applicable: boolean
          json_value: Json | null
          number_value: number | null
          organisation_id: string
          question_id: string
          submission_id: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_value?: string | null
          id?: string
          is_not_applicable?: boolean
          json_value?: Json | null
          number_value?: number | null
          organisation_id: string
          question_id: string
          submission_id: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_value?: string | null
          id?: string
          is_not_applicable?: boolean
          json_value?: Json | null
          number_value?: number | null
          organisation_id?: string
          question_id?: string
          submission_id?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_answers_submission_fkey"
            columns: ["organisation_id", "submission_id"]
            isOneToOne: false
            referencedRelation: "template_submissions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_questions_answer_fkey"
            columns: ["organisation_id", "question_id"]
            isOneToOne: false
            referencedRelation: "template_questions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      template_questions: {
        Row: {
          allows_not_applicable: boolean
          created_at: string
          help_text: string | null
          id: string
          is_required: boolean
          options: Json | null
          organisation_id: string
          position: number
          prompt: string
          question_type: string
          section_id: string
          template_version_id: string
        }
        Insert: {
          allows_not_applicable?: boolean
          created_at?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          organisation_id: string
          position: number
          prompt: string
          question_type: string
          section_id: string
          template_version_id: string
        }
        Update: {
          allows_not_applicable?: boolean
          created_at?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          organisation_id?: string
          position?: number
          prompt?: string
          question_type?: string
          section_id?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_questions_section_fkey"
            columns: ["organisation_id", "section_id"]
            isOneToOne: false
            referencedRelation: "template_sections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_questions_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      template_sections: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          position: number
          template_version_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          position: number
          template_version_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          position?: number
          template_version_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_sections_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      template_submissions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          status: string
          template_version_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          status?: string
          template_version_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          status?: string
          template_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_submissions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_submissions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_submissions_version_fkey"
            columns: ["organisation_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      template_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          template_id: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_id: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "template_versions_template_fkey"
            columns: ["organisation_id", "template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          created_by_membership_id: string
          description: string | null
          display_name: string
          experience_type: string
          id: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          display_name: string
          experience_type?: string
          id: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          display_name?: string
          experience_type?: string
          id?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "templates_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_completions: {
        Row: {
          completed_at: string
          completion_method: string | null
          course_id: string
          course_version_id: string
          created_at: string
          expires_at: string | null
          external_certificate_reference: string | null
          id: string
          membership_id: string
          notes: string | null
          organisation_id: string
          recorded_by_membership_id: string
          session_id: string | null
          status: string
          superseded_by_completion_id: string | null
          trainer_membership_id: string | null
          trainer_name: string | null
          updated_at: string
          validity_days_applied: number | null
        }
        Insert: {
          completed_at: string
          completion_method?: string | null
          course_id: string
          course_version_id: string
          created_at?: string
          expires_at?: string | null
          external_certificate_reference?: string | null
          id: string
          membership_id: string
          notes?: string | null
          organisation_id: string
          recorded_by_membership_id: string
          session_id?: string | null
          status?: string
          superseded_by_completion_id?: string | null
          trainer_membership_id?: string | null
          trainer_name?: string | null
          updated_at?: string
          validity_days_applied?: number | null
        }
        Update: {
          completed_at?: string
          completion_method?: string | null
          course_id?: string
          course_version_id?: string
          created_at?: string
          expires_at?: string | null
          external_certificate_reference?: string | null
          id?: string
          membership_id?: string
          notes?: string | null
          organisation_id?: string
          recorded_by_membership_id?: string
          session_id?: string | null
          status?: string
          superseded_by_completion_id?: string | null
          trainer_membership_id?: string | null
          trainer_name?: string | null
          updated_at?: string
          validity_days_applied?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_course_fkey"
            columns: ["organisation_id", "course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_course_version_fkey"
            columns: ["organisation_id", "course_version_id"]
            isOneToOne: false
            referencedRelation: "training_course_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_recorded_by_fkey"
            columns: ["organisation_id", "recorded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_session_fkey"
            columns: ["organisation_id", "session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_superseded_fkey"
            columns: ["organisation_id", "superseded_by_completion_id"]
            isOneToOne: false
            referencedRelation: "training_completions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_completions_trainer_fkey"
            columns: ["organisation_id", "trainer_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_course_skill_links: {
        Row: {
          course_id: string
          created_at: string
          id: string
          notes: string | null
          organisation_id: string
          skill_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          notes?: string | null
          organisation_id: string
          skill_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_course_skill_links_course_fkey"
            columns: ["organisation_id", "course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_course_skill_links_skill_fkey"
            columns: ["organisation_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_course_versions: {
        Row: {
          archived_at: string | null
          course_id: string
          created_at: string
          created_by_membership_id: string
          delivery_method: string | null
          duration_minutes: number | null
          evidence_requirements: Json | null
          id: string
          learning_objectives: string | null
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          trainer_requirements: string | null
          validity_days: number | null
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          course_id: string
          created_at?: string
          created_by_membership_id: string
          delivery_method?: string | null
          duration_minutes?: number | null
          evidence_requirements?: Json | null
          id?: string
          learning_objectives?: string | null
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          trainer_requirements?: string | null
          validity_days?: number | null
          version_number: number
        }
        Update: {
          archived_at?: string | null
          course_id?: string
          created_at?: string
          created_by_membership_id?: string
          delivery_method?: string | null
          duration_minutes?: number | null
          evidence_requirements?: Json | null
          id?: string
          learning_objectives?: string | null
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          trainer_requirements?: string | null
          validity_days?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_course_versions_course_fkey"
            columns: ["organisation_id", "course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_course_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_course_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_courses: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by_membership_id: string
          deactivated_at: string | null
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by_membership_id: string
          deactivated_at?: string | null
          description?: string | null
          id: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by_membership_id?: string
          deactivated_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_courses_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_courses_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_curricula: {
        Row: {
          code: string
          created_at: string
          created_by_membership_id: string
          description: string | null
          id: string
          name: string
          organisation_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_membership_id: string
          description?: string | null
          id?: string
          name: string
          organisation_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_membership_id?: string
          description?: string | null
          id?: string
          name?: string
          organisation_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_curricula_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_curricula_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_curriculum_versions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_membership_id: string
          curriculum_id: string
          id: string
          organisation_id: string
          published_at: string | null
          published_by_membership_id: string | null
          status: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id: string
          curriculum_id: string
          id?: string
          organisation_id: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          version_number: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          curriculum_id?: string
          id?: string
          organisation_id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_curriculum_versions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_curriculum_versions_curriculum_fkey"
            columns: ["organisation_id", "curriculum_id"]
            isOneToOne: false
            referencedRelation: "training_curricula"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_curriculum_versions_publisher_fkey"
            columns: ["organisation_id", "published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_requirements: {
        Row: {
          applies_to_all_members: boolean
          course_id: string
          created_at: string
          curriculum_version_id: string
          grace_period_days: number | null
          id: string
          job_function_id: string | null
          mandatory: boolean
          notes: string | null
          organisation_id: string
          organisational_unit_id: string | null
          required_within_days: number | null
          validity_days_override: number | null
        }
        Insert: {
          applies_to_all_members?: boolean
          course_id: string
          created_at?: string
          curriculum_version_id: string
          grace_period_days?: number | null
          id?: string
          job_function_id?: string | null
          mandatory?: boolean
          notes?: string | null
          organisation_id: string
          organisational_unit_id?: string | null
          required_within_days?: number | null
          validity_days_override?: number | null
        }
        Update: {
          applies_to_all_members?: boolean
          course_id?: string
          created_at?: string
          curriculum_version_id?: string
          grace_period_days?: number | null
          id?: string
          job_function_id?: string | null
          mandatory?: boolean
          notes?: string | null
          organisation_id?: string
          organisational_unit_id?: string | null
          required_within_days?: number | null
          validity_days_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_requirements_course_fkey"
            columns: ["organisation_id", "course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_requirements_job_function_fkey"
            columns: ["organisation_id", "job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_requirements_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_requirements_version_fkey"
            columns: ["organisation_id", "curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "training_curriculum_versions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_session_participants: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          organisation_id: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          organisation_id: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          organisation_id?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_session_participants_membership_fkey"
            columns: ["organisation_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_session_participants_session_fkey"
            columns: ["organisation_id", "session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          capacity: number | null
          course_version_id: string
          created_at: string
          created_by_membership_id: string
          id: string
          location: string | null
          notes: string | null
          online_metadata: Json | null
          organisation_id: string
          organisational_unit_id: string | null
          schedule_occurrence_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          title: string
          trainer_membership_id: string | null
          trainer_name: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          course_version_id: string
          created_at?: string
          created_by_membership_id: string
          id: string
          location?: string | null
          notes?: string | null
          online_metadata?: Json | null
          organisation_id: string
          organisational_unit_id?: string | null
          schedule_occurrence_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          title: string
          trainer_membership_id?: string | null
          trainer_name?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          course_version_id?: string
          created_at?: string
          created_by_membership_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          online_metadata?: Json | null
          organisation_id?: string
          organisational_unit_id?: string | null
          schedule_occurrence_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          title?: string
          trainer_membership_id?: string | null
          trainer_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_course_version_fkey"
            columns: ["organisation_id", "course_version_id"]
            isOneToOne: false
            referencedRelation: "training_course_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_sessions_creator_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_sessions_resource_fkey"
            columns: ["organisation_id", "id"]
            isOneToOne: false
            referencedRelation: "resource_records"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_sessions_schedule_occurrence_fkey"
            columns: ["organisation_id", "schedule_occurrence_id"]
            isOneToOne: false
            referencedRelation: "schedule_occurrences"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_sessions_trainer_fkey"
            columns: ["organisation_id", "trainer_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "training_sessions_unit_fkey"
            columns: ["organisation_id", "organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      workforce_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_membership_id: string
          credential_expires_at: string | null
          credential_export_status: string
          error_rows: number
          failed_rows: number
          id: string
          organisation_id: string
          original_filename: string
          provisioned_rows: number
          remediation_rows: number
          started_at: string | null
          status: string
          total_rows: number
          updated_at: string
          valid_rows: number
          validation_completed_at: string | null
          warning_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id: string
          credential_expires_at?: string | null
          credential_export_status?: string
          error_rows?: number
          failed_rows?: number
          id?: string
          organisation_id: string
          original_filename: string
          provisioned_rows?: number
          remediation_rows?: number
          started_at?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validation_completed_at?: string | null
          warning_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_membership_id?: string
          credential_expires_at?: string | null
          credential_export_status?: string
          error_rows?: number
          failed_rows?: number
          id?: string
          organisation_id?: string
          original_filename?: string
          provisioned_rows?: number
          remediation_rows?: number
          started_at?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validation_completed_at?: string | null
          warning_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_import_jobs_actor_fkey"
            columns: ["organisation_id", "created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "workforce_import_jobs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_import_row_credentials: {
        Row: {
          created_at: string
          credential_ciphertext: string
          credential_nonce: string
          expires_at: string
          import_job_id: string
          import_row_id: string
          organisation_id: string
        }
        Insert: {
          created_at?: string
          credential_ciphertext: string
          credential_nonce: string
          expires_at: string
          import_job_id: string
          import_row_id: string
          organisation_id: string
        }
        Update: {
          created_at?: string
          credential_ciphertext?: string
          credential_nonce?: string
          expires_at?: string
          import_job_id?: string
          import_row_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_import_row_credentials_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: true
            referencedRelation: "workforce_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_import_row_credentials_job_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "workforce_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_import_rows: {
        Row: {
          created_at: string
          created_membership_id: string | null
          error_code: string | null
          error_message: string | null
          field_errors: Json | null
          id: string
          import_job_id: string
          input_payload: Json
          organisation_id: string
          provisioning_intent_id: string | null
          resolved_payload: Json | null
          row_number: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_membership_id?: string | null
          error_code?: string | null
          error_message?: string | null
          field_errors?: Json | null
          id?: string
          import_job_id: string
          input_payload: Json
          organisation_id: string
          provisioning_intent_id?: string | null
          resolved_payload?: Json | null
          row_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_membership_id?: string | null
          error_code?: string | null
          error_message?: string | null
          field_errors?: Json | null
          id?: string
          import_job_id?: string
          input_payload?: Json
          organisation_id?: string
          provisioning_intent_id?: string | null
          resolved_payload?: Json | null
          row_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_import_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "workforce_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_import_rows_job_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "workforce_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_import_rows_membership_fkey"
            columns: ["organisation_id", "created_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "workforce_import_rows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_import_rows_provisioning_intent_id_fkey"
            columns: ["provisioning_intent_id"]
            isOneToOne: false
            referencedRelation: "workforce_provision_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_provision_intents: {
        Row: {
          actor_membership_id: string
          consumed_at: string | null
          created_at: string
          created_auth_user_id: string | null
          created_membership_id: string | null
          expires_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          intent_kind: string
          organisation_id: string
          sealed_internal_login_identifier: string
          source_import_job_id: string | null
          source_import_row_id: string | null
          status: string
          target_alias_type: string
          target_canonical_alias: string
          target_display_name: string
          target_job_function_id: string | null
          target_job_title: string | null
          target_notification_email: string | null
          target_organisational_unit_id: string | null
          target_role_version_id: string
          target_scope_type: string
          target_scope_unit_id: string | null
          updated_at: string
        }
        Insert: {
          actor_membership_id: string
          consumed_at?: string | null
          created_at?: string
          created_auth_user_id?: string | null
          created_membership_id?: string | null
          expires_at: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          intent_kind: string
          organisation_id: string
          sealed_internal_login_identifier: string
          source_import_job_id?: string | null
          source_import_row_id?: string | null
          status?: string
          target_alias_type?: string
          target_canonical_alias: string
          target_display_name: string
          target_job_function_id?: string | null
          target_job_title?: string | null
          target_notification_email?: string | null
          target_organisational_unit_id?: string | null
          target_role_version_id: string
          target_scope_type: string
          target_scope_unit_id?: string | null
          updated_at?: string
        }
        Update: {
          actor_membership_id?: string
          consumed_at?: string | null
          created_at?: string
          created_auth_user_id?: string | null
          created_membership_id?: string | null
          expires_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          intent_kind?: string
          organisation_id?: string
          sealed_internal_login_identifier?: string
          source_import_job_id?: string | null
          source_import_row_id?: string | null
          status?: string
          target_alias_type?: string
          target_canonical_alias?: string
          target_display_name?: string
          target_job_function_id?: string | null
          target_job_title?: string | null
          target_notification_email?: string | null
          target_organisational_unit_id?: string | null
          target_role_version_id?: string
          target_scope_type?: string
          target_scope_unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_provision_intents_actor_fkey"
            columns: ["organisation_id", "actor_membership_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "workforce_provision_intents_job_function_fkey"
            columns: ["organisation_id", "target_job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "workforce_provision_intents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_provision_intents_role_version_fkey"
            columns: ["organisation_id", "target_role_version_id"]
            isOneToOne: false
            referencedRelation: "role_versions"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "workforce_provision_intents_scope_unit_fkey"
            columns: ["organisation_id", "target_scope_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "workforce_provision_intents_unit_fkey"
            columns: ["organisation_id", "target_organisational_unit_id"]
            isOneToOne: false
            referencedRelation: "organisation_units"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organisation_invitation: {
        Args: { invitation_token_digest: string }
        Returns: string
      }
      accept_organisation_invitation_signup_binding: {
        Args: { target_binding_id: string }
        Returns: string
      }
      activate_problem_solving_case: {
        Args: { target_case_id: string; target_method_id: string }
        Returns: boolean
      }
      add_analysis_node: {
        Args: {
          target_analysis_id: string
          target_category?: string
          target_display_metadata?: Json
          target_label: string
          target_parent_node_id?: string
          target_sort_order?: number
        }
        Returns: string
      }
      add_benefit_source_link: {
        Args: {
          target_benefit_id: string
          target_relationship_role?: string
          target_source_resource_id: string
        }
        Returns: string
      }
      add_benefit_to_overlap_group: {
        Args: {
          target_allocation_percentage: number
          target_benefit_id: string
          target_overlap_group_id: string
          target_reason?: string
        }
        Returns: string
      }
      add_ci_project_methodology_phase: {
        Args: {
          target_description?: string
          target_display_order: number
          target_methodology_version_id: string
          target_phase_key: string
          target_title: string
        }
        Returns: string
      }
      add_five_s_question: {
        Args: {
          target_allows_not_applicable?: boolean
          target_contributes_to_score?: boolean
          target_help_text?: string
          target_is_required?: boolean
          target_options?: Json
          target_position: number
          target_prompt: string
          target_question_type: string
          target_scoring_metadata?: Json
          target_section_id: string
          target_standard_version_id: string
          target_weight?: number
        }
        Returns: string
      }
      add_five_s_section: {
        Args: {
          target_position: number
          target_standard_version_id: string
          target_title: string
        }
        Returns: string
      }
      add_gemba_question: {
        Args: {
          target_allows_not_applicable?: boolean
          target_definition_version_id: string
          target_help_text?: string
          target_is_required?: boolean
          target_options?: Json
          target_position: number
          target_prompt: string
          target_question_type: string
          target_section_id: string
        }
        Returns: string
      }
      add_gemba_section: {
        Args: {
          target_definition_version_id: string
          target_position: number
          target_title: string
        }
        Returns: string
      }
      add_maturity_criterion: {
        Args: {
          target_description?: string
          target_expected_evidence?: string
          target_guidance?: string
          target_name: string
          target_pillar_id: string
          target_position: number
          target_weight?: number
        }
        Returns: string
      }
      add_maturity_level: {
        Args: {
          target_color_token: string
          target_description?: string
          target_guidance?: string
          target_level_number: number
          target_model_version_id: string
          target_name: string
        }
        Returns: string
      }
      add_maturity_pillar: {
        Args: {
          target_description?: string
          target_guidance?: string
          target_model_version_id: string
          target_name: string
          target_position: number
          target_section_title?: string
          target_weight?: number
        }
        Returns: string
      }
      add_maturity_question: {
        Args: {
          target_allows_not_applicable?: boolean
          target_help_text?: string
          target_is_required?: boolean
          target_model_version_id: string
          target_options?: Json
          target_position: number
          target_prompt: string
          target_question_type: string
          target_section_id: string
        }
        Returns: string
      }
      add_problem_solving_participant: {
        Args: {
          target_case_id: string
          target_membership_id: string
          target_participant_role: string
        }
        Returns: string
      }
      add_problem_solving_source_link: {
        Args: {
          target_case_id: string
          target_link_role?: string
          target_source_resource_id: string
        }
        Returns: string
      }
      add_role_permission: {
        Args: {
          target_organisation_id: string
          target_permission_key: string
          target_role_version_id: string
        }
        Returns: boolean
      }
      add_session_entry: {
        Args: {
          target_body: string
          target_entry_type: string
          target_reference_action_id?: string
          target_reference_attachment_id?: string
          target_reference_hypothesis_id?: string
          target_session_id: string
        }
        Returns: string
      }
      add_skill_proficiency_level: {
        Args: {
          target_description?: string
          target_guidance?: string
          target_label: string
          target_order_value: number
          target_scale_version_id: string
          target_semantic_token?: string
        }
        Returns: string
      }
      add_skill_requirement: {
        Args: {
          target_capability_set_version_id: string
          target_evidence_requirement?: string
          target_job_function_id: string
          target_mandatory?: boolean
          target_notes?: string
          target_organisational_unit_id?: string
          target_proficiency_scale_version_id: string
          target_skill_id: string
          target_target_proficiency_level_id: string
        }
        Returns: string
      }
      add_suggestion_contributor: {
        Args: {
          target_contribution_role: string
          target_membership_id: string
          target_suggestion_id: string
        }
        Returns: string
      }
      add_template_question: {
        Args: {
          target_allows_not_applicable?: boolean
          target_help_text?: string
          target_is_required?: boolean
          target_options?: Json
          target_position: number
          target_prompt: string
          target_question_type: string
          target_section_id: string
          target_template_version_id: string
        }
        Returns: string
      }
      add_template_section: {
        Args: {
          target_position: number
          target_template_version_id: string
          target_title: string
        }
        Returns: string
      }
      add_training_requirement: {
        Args: {
          target_applies_to_all_members?: boolean
          target_course_id: string
          target_curriculum_version_id: string
          target_grace_period_days?: number
          target_job_function_id?: string
          target_mandatory?: boolean
          target_notes?: string
          target_organisational_unit_id?: string
          target_required_within_days?: number
          target_validity_days_override?: number
        }
        Returns: string
      }
      add_training_session_participant: {
        Args: { target_membership_id: string; target_session_id: string }
        Returns: string
      }
      approve_benefit_forecast: {
        Args: { target_forecast_version_id: string }
        Returns: boolean
      }
      approve_maturity_assessment: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      approve_project: { Args: { target_project_id: string }; Returns: boolean }
      archive_benefit_category: {
        Args: { target_category_id: string }
        Returns: boolean
      }
      assign_ci_project_team_member: {
        Args: {
          target_membership_id: string
          target_project_id: string
          target_team_role: string
        }
        Returns: string
      }
      assign_membership_job_function: {
        Args: {
          target_assignment_reason?: string
          target_job_function_id: string
          target_membership_id: string
          target_organisational_unit_id?: string
          target_primary?: boolean
          target_valid_from?: string
          target_valid_to?: string
        }
        Returns: string
      }
      assign_suggestion_reviewer: {
        Args: {
          target_reviewer_membership_id: string
          target_suggestion_id: string
        }
        Returns: string
      }
      authentication_rate_limit_allows: {
        Args: {
          limiter_dimension: string
          limiter_key_hash: string
          limiter_purpose: string
          maximum_attempts: number
          window_seconds: number
        }
        Returns: boolean
      }
      award_recognition: {
        Args: {
          target_contribution_summaries?: string[]
          target_message: string
          target_organisational_unit_id: string
          target_recipient_membership_ids: string[]
          target_recognition_type_id: string
          target_source_resource_id?: string
          target_title: string
          target_visibility: string
        }
        Returns: string
      }
      begin_assessor_review: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      begin_suggestion_implementation: {
        Args: { target_suggestion_id: string }
        Returns: boolean
      }
      begin_suggestion_review: {
        Args: { target_suggestion_id: string }
        Returns: boolean
      }
      bulk_record_training_completions: {
        Args: {
          target_completed_at?: string
          target_completion_method?: string
          target_course_version_id: string
          target_membership_ids: string[]
          target_notes?: string
          target_session_id?: string
          target_trainer_membership_id?: string
          target_trainer_name?: string
          target_validity_days_override?: number
        }
        Returns: string[]
      }
      calculate_maturity_assessment_scores: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      can_read_maturity_assessment: {
        Args: { target_assessment_id: string; target_organisation_id: string }
        Returns: boolean
      }
      cancel_benefit: {
        Args: { target_benefit_id: string; target_reason?: string }
        Returns: boolean
      }
      cancel_maturity_assessment: {
        Args: { target_assessment_id: string; target_reason?: string }
        Returns: boolean
      }
      cancel_problem_solving_case: {
        Args: { target_cancellation_rationale: string; target_case_id: string }
        Returns: boolean
      }
      cancel_project: {
        Args: { target_project_id: string; target_reason?: string }
        Returns: boolean
      }
      claim_domain_events_for_worker: {
        Args: { batch_size?: number; lease_seconds?: number }
        Returns: {
          attempt_count: number
          event_id: string
          event_type: string
          lease_token: string
          organisation_id: string
          payload: Json
          resource_record_id: string
        }[]
      }
      claim_notification_deliveries_for_worker: {
        Args: { batch_size?: number; lease_seconds?: number }
        Returns: {
          attempt_count: number
          delivery_id: string
          delivery_key: string
          lease_token: string
          notification_kind: string
          organisation_id: string
          recipient_membership_id: string
          source_domain_event_id: string
        }[]
      }
      claim_workforce_import_batch: {
        Args: { target_batch_size?: number; target_import_job_id: string }
        Returns: {
          import_row_id: string
          provisioning_intent_id: string
        }[]
      }
      close_problem_solving_case: {
        Args: {
          target_case_id: string
          target_closure_outcome: string
          target_closure_rationale?: string
        }
        Returns: boolean
      }
      complete_domain_event_for_worker: {
        Args: {
          expected_lease_token: string
          target_event_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      complete_five_s_audit: {
        Args: { target_audit_id: string }
        Returns: boolean
      }
      complete_gemba_walk: {
        Args: { target_summary_notes?: string; target_walk_id: string }
        Returns: boolean
      }
      complete_hypothesis_test: {
        Args: {
          target_actual_result: string
          target_conclusion: string
          target_hypothesis_test_id: string
        }
        Returns: boolean
      }
      complete_notification_delivery_for_worker: {
        Args: {
          expected_lease_token: string
          target_delivery_id: string
          target_organisation_id: string
          target_provider_message_id?: string
        }
        Returns: boolean
      }
      complete_problem_solving_session: {
        Args: { target_session_id: string; target_summary?: string }
        Returns: boolean
      }
      complete_project:
        | { Args: { target_project_id: string }; Returns: boolean }
        | {
            Args: {
              target_lessons_learned?: string
              target_outcome_summary: string
              target_project_id: string
              target_sustainment_summary?: string
            }
            Returns: boolean
          }
      complete_project_phase: {
        Args: {
          target_mark_skipped?: boolean
          target_phase_id: string
          target_project_id: string
        }
        Returns: boolean
      }
      complete_self_assessment: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      complete_template_submission: {
        Args: { target_submission_id: string }
        Returns: boolean
      }
      confirm_attachment_upload: {
        Args: { target_attachment_id: string }
        Returns: boolean
      }
      consume_authentication_rate_limit: {
        Args: {
          block_seconds: number
          limiter_dimension: string
          limiter_key_hash: string
          limiter_purpose: string
          maximum_attempts: number
          window_seconds: number
        }
        Returns: boolean
      }
      create_action: {
        Args: {
          target_description?: string
          target_due_at?: string
          target_idempotency_key?: string
          target_priority?: string
          target_source_resource_id?: string
          target_title: string
          target_unit_id?: string
        }
        Returns: string
      }
      create_ai_session: {
        Args: {
          target_mode: string
          target_problem_solving_case_id: string
          target_problem_solving_session_id?: string
          target_title?: string
        }
        Returns: string
      }
      create_analysis: {
        Args: {
          target_analysis_type: string
          target_problem_solving_case_id: string
          target_title: string
        }
        Returns: string
      }
      create_benefit_category: {
        Args: {
          target_code: string
          target_description?: string
          target_display_order?: number
          target_name: string
        }
        Returns: string
      }
      create_benefit_draft: {
        Args: {
          target_benefit_class: string
          target_category_id?: string
          target_description?: string
          target_financial_type?: string
          target_is_standalone_initiative?: boolean
          target_non_financial_type?: string
          target_organisational_unit_id: string
          target_owner_membership_id?: string
          target_primary_source_resource_id?: string
          target_title: string
        }
        Returns: string
      }
      create_benefit_forecast_draft: {
        Args: {
          target_assumptions?: string
          target_benefit_id: string
          target_calculation_basis?: string
          target_forecast_end_date: string
          target_forecast_start_date: string
          target_forecast_total_amount?: number
          target_realisation_pattern: string
          target_target_date?: string
          target_target_measure_unit?: string
          target_target_measure_value?: number
        }
        Returns: string
      }
      create_benefit_forecast_successor_version: {
        Args: { target_benefit_id: string }
        Returns: string
      }
      create_benefit_from_ci_project: {
        Args: {
          target_benefit_class: string
          target_category_id?: string
          target_description?: string
          target_financial_type?: string
          target_non_financial_type?: string
          target_organisational_unit_id?: string
          target_owner_membership_id?: string
          target_project_id: string
          target_title?: string
        }
        Returns: string
      }
      create_benefit_from_suggestion: {
        Args: {
          target_benefit_class: string
          target_category_id?: string
          target_description?: string
          target_financial_type?: string
          target_non_financial_type?: string
          target_organisational_unit_id?: string
          target_owner_membership_id?: string
          target_suggestion_id: string
          target_title?: string
        }
        Returns: string
      }
      create_benefit_overlap_group: {
        Args: { target_name: string; target_reason?: string }
        Returns: string
      }
      create_benefit_realisation_adjustment: {
        Args: {
          target_data_source?: string
          target_financial_amount?: number
          target_is_correction?: boolean
          target_measure_unit?: string
          target_measure_value?: number
          target_notes?: string
          target_parent_entry_id: string
          target_period_end?: string
          target_period_start?: string
        }
        Returns: string
      }
      create_benefit_realisation_entry: {
        Args: {
          target_benefit_id: string
          target_data_source?: string
          target_financial_amount?: number
          target_measure_unit?: string
          target_measure_value?: number
          target_notes?: string
          target_period_end: string
          target_period_start: string
        }
        Returns: string
      }
      create_capability_action: {
        Args: {
          target_course_id?: string
          target_description?: string
          target_due_at?: string
          target_gap_type: string
          target_membership_id: string
          target_notes?: string
          target_priority?: string
          target_skill_assessment_id?: string
          target_skill_id?: string
          target_title: string
          target_training_completion_id?: string
        }
        Returns: string
      }
      create_ci_project_methodology_draft: {
        Args: {
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_ci_project_methodology_successor_version: {
        Args: { target_methodology_id: string }
        Returns: string
      }
      create_ci_project_metric: {
        Args: {
          target_baseline_value?: number
          target_display_name: string
          target_metric_key: string
          target_project_id: string
          target_target_value?: number
          target_unit_label?: string
        }
        Returns: string
      }
      create_comment: {
        Args: { target_body: string; target_resource_id: string }
        Returns: string
      }
      create_containment: {
        Args: {
          target_description: string
          target_problem_solving_case_id: string
          target_rationale?: string
        }
        Returns: string
      }
      create_countermeasure: {
        Args: {
          target_case_id: string
          target_description?: string
          target_rationale?: string
          target_title: string
        }
        Returns: string
      }
      create_current_condition_item: {
        Args: {
          target_case_id: string
          target_category: string
          target_statement: string
          target_supersedes_item_id?: string
        }
        Returns: string
      }
      create_effectiveness_check: {
        Args: {
          target_baseline_description?: string
          target_baseline_numeric?: number
          target_case_id: string
          target_criterion: string
          target_due_date?: string
          target_observation_window_end?: string
          target_observation_window_start?: string
          target_target_description?: string
          target_target_numeric?: number
          target_unit?: string
        }
        Returns: string
      }
      create_five_s_action: {
        Args: {
          target_audit_id: string
          target_description?: string
          target_due_at?: string
          target_finding_id?: string
          target_priority?: string
          target_question_id?: string
          target_section_id?: string
          target_title: string
        }
        Returns: string
      }
      create_five_s_finding: {
        Args: {
          target_action_required?: boolean
          target_audit_id: string
          target_observation: string
          target_priority?: string
          target_question_id?: string
          target_section_id?: string
          target_severity?: string
        }
        Returns: string
      }
      create_five_s_standard_draft: {
        Args: {
          target_description?: string
          target_display_name: string
          target_threshold_percent?: number
        }
        Returns: string
      }
      create_five_s_standard_successor_version: {
        Args: { target_standard_id: string }
        Returns: string
      }
      create_gemba_action: {
        Args: {
          target_description?: string
          target_due_at?: string
          target_observation_id?: string
          target_priority?: string
          target_question_id?: string
          target_section_id?: string
          target_title: string
          target_walk_id: string
        }
        Returns: string
      }
      create_gemba_definition_draft: {
        Args: {
          target_description?: string
          target_display_name: string
          target_expected_duration_minutes?: number
        }
        Returns: string
      }
      create_gemba_definition_successor_version: {
        Args: { target_definition_id: string }
        Returns: string
      }
      create_gemba_observation: {
        Args: {
          target_observation_text: string
          target_observation_type: string
          target_priority?: string
          target_question_id?: string
          target_section_id?: string
          target_severity?: string
          target_walk_id: string
        }
        Returns: string
      }
      create_hypothesis: {
        Args: {
          target_category?: string
          target_parent_hypothesis_id?: string
          target_problem_solving_case_id: string
          target_rationale?: string
          target_statement: string
        }
        Returns: string
      }
      create_hypothesis_test: {
        Args: {
          target_expected_result: string
          target_hypothesis_id: string
          target_method?: string
          target_owner_membership_id?: string
          target_planned_date?: string
          target_test_question: string
        }
        Returns: string
      }
      create_improvement_project: {
        Args: {
          target_expected_impact_summary?: string
          target_objective?: string
          target_problem_statement?: string
          target_source_resource_id?: string
          target_title: string
          target_unit_id: string
        }
        Returns: string
      }
      create_improvement_project_from_suggestion: {
        Args: { target_suggestion_id: string }
        Returns: string
      }
      create_job_function: {
        Args: {
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_maturity_action: {
        Args: {
          target_assessment_id: string
          target_criterion_id: string
          target_description?: string
          target_due_at?: string
          target_pillar_id: string
          target_priority?: string
          target_question_id?: string
          target_title: string
        }
        Returns: string
      }
      create_maturity_model_draft: {
        Args: { target_description?: string; target_display_name: string }
        Returns: string
      }
      create_maturity_model_successor_version: {
        Args: { target_model_id: string }
        Returns: string
      }
      create_notification_delivery_for_worker: {
        Args: {
          notification_kind: string
          recipient_membership_id: string
          source_domain_event_id: string
          target_delivery_key: string
          target_organisation_id: string
        }
        Returns: string
      }
      create_organisation_unit: {
        Args: {
          target_organisation_id: string
          target_parent_unit_id: string
          unit_code: string
          unit_name: string
          unit_type: string
        }
        Returns: string
      }
      create_problem_solving_action: {
        Args: {
          target_containment_id?: string
          target_context_role: string
          target_countermeasure_id?: string
          target_description?: string
          target_due_at?: string
          target_priority?: string
          target_problem_solving_case_id: string
          target_sustainment_item_id?: string
          target_title: string
        }
        Returns: string
      }
      create_problem_solving_case_draft: {
        Args: {
          target_background?: string
          target_business_impact?: string
          target_detected_at?: string
          target_facilitator_membership_id?: string
          target_method_version_id?: string
          target_organisation_unit_id: string
          target_owner_membership_id?: string
          target_priority?: string
          target_problem_statement?: string
          target_scope_in?: string
          target_scope_out?: string
          target_severity?: string
          target_source_resource_id?: string
          target_target_condition?: string
          target_title: string
        }
        Returns: string
      }
      create_problem_solving_lessons_learned: {
        Args: {
          target_apply_elsewhere?: string
          target_case_id: string
          target_notes?: string
          target_standardise?: string
          target_what_happened: string
          target_what_learned: string
        }
        Returns: string
      }
      create_project_action: {
        Args: {
          target_description?: string
          target_due_at?: string
          target_priority?: string
          target_project_id: string
          target_project_phase_id?: string
          target_title: string
        }
        Returns: string
      }
      create_protected_role_draft: {
        Args: {
          role_canonical_name: string
          role_description?: string
          role_display_name: string
          target_organisation_id: string
        }
        Returns: string
      }
      create_recognition_type: {
        Args: {
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_role_draft: {
        Args: {
          role_canonical_name: string
          role_description?: string
          role_display_name: string
          target_organisation_id: string
        }
        Returns: string
      }
      create_schedule_definition: {
        Args: {
          target_activity_resource_id: string
          target_description?: string
          target_end_date?: string
          target_is_all_day?: boolean
          target_local_time?: string
          target_owner_membership_id: string
          target_participant_membership_ids?: string[]
          target_recurrence: Json
          target_start_date: string
          target_title: string
          target_unit_id: string
        }
        Returns: string
      }
      create_skill: {
        Args: {
          target_category?: string
          target_code: string
          target_description?: string
          target_evidence_expectations?: string
          target_name: string
        }
        Returns: string
      }
      create_skill_capability_set_draft: {
        Args: {
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_skill_proficiency_scale_draft: {
        Args: { target_description?: string; target_name: string }
        Returns: string
      }
      create_suggestion_action: {
        Args: {
          target_description?: string
          target_due_at?: string
          target_priority?: string
          target_purpose?: string
          target_suggestion_id: string
          target_title: string
        }
        Returns: string
      }
      create_suggestion_category: {
        Args: {
          target_code: string
          target_description?: string
          target_display_order?: number
          target_name: string
        }
        Returns: string
      }
      create_suggestion_draft: {
        Args: {
          target_category_id: string
          target_expected_benefit_summary?: string
          target_problem_or_opportunity: string
          target_programme_version_id: string
          target_proposed_idea: string
          target_target_unit_id?: string
          target_template_submission_id?: string
          target_title: string
        }
        Returns: string
      }
      create_suggestion_programme_draft: {
        Args: {
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_suggestion_programme_successor_version: {
        Args: { target_programme_id: string }
        Returns: string
      }
      create_sustainment_item: {
        Args: {
          target_case_id: string
          target_check_method?: string
          target_follow_up_date?: string
          target_owner_membership_id?: string
          target_what: string
        }
        Returns: string
      }
      create_template_draft: {
        Args: { target_description?: string; target_display_name: string }
        Returns: string
      }
      create_template_submission: {
        Args: { target_template_version_id: string }
        Returns: string
      }
      create_template_successor_version: {
        Args: { target_template_id: string }
        Returns: string
      }
      create_training_course_draft: {
        Args: {
          target_category?: string
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_training_course_successor_version: {
        Args: { target_course_id: string }
        Returns: string
      }
      create_training_curriculum_draft: {
        Args: {
          target_code: string
          target_description?: string
          target_name: string
        }
        Returns: string
      }
      create_training_session: {
        Args: {
          target_capacity?: number
          target_course_version_id: string
          target_location?: string
          target_notes?: string
          target_online_metadata?: Json
          target_organisational_unit_id?: string
          target_schedule_occurrence_id?: string
          target_scheduled_end?: string
          target_scheduled_start?: string
          target_title: string
          target_trainer_membership_id?: string
          target_trainer_name?: string
        }
        Returns: string
      }
      create_workforce_import_job: {
        Args: { target_original_filename: string }
        Returns: string
      }
      current_identity_state: {
        Args: never
        Returns: {
          enrolment_status: string
          identity_status: string
          password_change_required: boolean
        }[]
      }
      current_organisation_id: { Args: never; Returns: string }
      current_workforce_login_identifier: { Args: never; Returns: string }
      deactivate_job_function: {
        Args: { target_job_function_id: string }
        Returns: boolean
      }
      deactivate_schedule_definition: {
        Args: { target_schedule_definition_id: string }
        Returns: boolean
      }
      deactivate_suggestion_category: {
        Args: { target_category_id: string }
        Returns: boolean
      }
      deactivate_suggestion_programme: {
        Args: { target_programme_id: string }
        Returns: boolean
      }
      delete_suggestion_category: {
        Args: { target_category_id: string }
        Returns: boolean
      }
      delete_suggestion_programme_draft: {
        Args: { target_programme_id: string }
        Returns: boolean
      }
      derive_schedule_occurrence_status: {
        Args: {
          target_lifecycle_status: string
          target_now?: string
          target_planned_local_date: string
          target_timezone: string
        }
        Returns: string
      }
      derive_skill_gap: {
        Args: {
          target_capability_set_version_id?: string
          target_membership_id: string
          target_skill_id: string
        }
        Returns: Json
      }
      derive_training_completion_validity_state: {
        Args: {
          target_as_of?: string
          target_expires_at: string
          target_expiring_window_days?: number
          target_status: string
        }
        Returns: string
      }
      disable_workforce_identity: {
        Args: { change_reason: string; target_user_id: string }
        Returns: number
      }
      edit_comment: {
        Args: { target_body: string; target_comment_id: string }
        Returns: boolean
      }
      end_membership_job_function_assignment: {
        Args: { target_assignment_id: string; target_valid_to?: string }
        Returns: boolean
      }
      ensure_problem_solving_methods_provisioned: {
        Args: never
        Returns: boolean
      }
      ensure_schedule_occurrences: {
        Args: {
          target_horizon_days?: number
          target_schedule_definition_id: string
        }
        Returns: number
      }
      expire_organisation_security_state: {
        Args: { target_organisation_id: string }
        Returns: {
          expired_grants: number
          expired_invitations: number
        }[]
      }
      fail_ai_run: {
        Args: {
          target_ai_run_id: string
          target_error_category: string
          target_final_output?: string
        }
        Returns: undefined
      }
      fail_domain_event_retryable_for_worker: {
        Args: {
          error_code: string
          error_detail?: string
          expected_lease_token: string
          target_event_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      fail_domain_event_terminal_for_worker: {
        Args: {
          error_code: string
          error_detail?: string
          expected_lease_token: string
          target_event_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      fail_notification_delivery_retryable_for_worker: {
        Args: {
          error_code: string
          expected_lease_token: string
          target_delivery_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      fail_notification_delivery_terminal_for_worker: {
        Args: {
          error_code: string
          expected_lease_token: string
          target_delivery_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      fail_workforce_provision: {
        Args: { target_failure_reason: string; target_intent_id: string }
        Returns: boolean
      }
      finalise_identity_enrolment: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      finalize_workforce_provision: {
        Args: { target_auth_user_id: string; target_intent_id: string }
        Returns: string
      }
      find_workforce_auth_user_for_intent: {
        Args: { target_intent_id: string }
        Returns: string
      }
      finish_ai_run: {
        Args: {
          target_ai_run_id: string
          target_assistant_content: string
          target_cached_input_tokens?: number
          target_duration_ms?: number
          target_input_tokens?: number
          target_manifest_hash: string
          target_manifest_json: Json
          target_manifest_version: string
          target_output_tokens?: number
          target_proposals?: Json
          target_provider_request_id?: string
          target_reasoning_tokens?: number
          target_source_references?: Json
          target_structured_payload: Json
          target_tool_call_count?: number
          target_tool_calls?: Json
        }
        Returns: string
      }
      get_ai_session_detail: {
        Args: { target_ai_session_id: string }
        Returns: Json
      }
      get_ai_usage_summary: { Args: never; Returns: Json }
      get_available_suggestion_submission_configuration: {
        Args: never
        Returns: Json
      }
      get_benefit_detail: { Args: { target_benefit_id: string }; Returns: Json }
      get_benefit_forecast_history: {
        Args: { target_benefit_id: string }
        Returns: Json
      }
      get_benefit_realisation_history: {
        Args: { target_benefit_id: string }
        Returns: Json
      }
      get_benefit_realisation_summary: {
        Args: { target_benefit_id: string }
        Returns: Json
      }
      get_benefit_validation_queue: { Args: never; Returns: Json }
      get_benefits_list: {
        Args: {
          target_benefit_class?: string
          target_category_id?: string
          target_financial_type?: string
          target_non_financial_type?: string
          target_owner_membership_id?: string
          target_page?: number
          target_page_size?: number
          target_search?: string
          target_status?: string
          target_unit_id?: string
        }
        Returns: Json
      }
      get_benefits_overview: { Args: never; Returns: Json }
      get_capability_dashboard: { Args: never; Returns: Json }
      get_ci_project_detail: {
        Args: { target_project_id: string }
        Returns: Json
      }
      get_ci_projects_portfolio: {
        Args: {
          target_page?: number
          target_page_size?: number
          target_priority?: string
          target_search?: string
          target_status?: string
          target_unit_id?: string
        }
        Returns: Json
      }
      get_current_membership_primary_unit: { Args: never; Returns: Json }
      get_delegatable_access_offers: { Args: never; Returns: Json }
      get_eligible_benefit_validators: {
        Args: { target_benefit_id: string }
        Returns: Json
      }
      get_membership_administration_profile: {
        Args: { target_membership_id: string }
        Returns: Json
      }
      get_membership_capability_profile_header: {
        Args: { target_membership_id: string }
        Returns: Json
      }
      get_membership_improvement_contribution: {
        Args: { target_membership_id: string }
        Returns: Json
      }
      get_membership_recognition: {
        Args: { target_membership_id: string }
        Returns: Json
      }
      get_membership_skills_profile: {
        Args: { target_membership_id: string }
        Returns: Json
      }
      get_membership_training_profile: {
        Args: { target_membership_id: string }
        Returns: Json
      }
      get_notification_delivery_context_for_worker: {
        Args: {
          target_delivery_id: string
          target_organisation_id: string
          target_source_domain_event_id: string
        }
        Returns: {
          context_detail: string
          context_link_path: string
          context_title: string
          deliverable_email: string
          delivery_id: string
          event_payload: Json
          event_type: string
          notification_kind: string
          organisation_id: string
          organisation_name: string
          recipient_display_name: string
          recipient_membership_id: string
          recipient_resolution_status: string
          resource_record_id: string
          source_domain_event_id: string
        }[]
      }
      get_notification_delivery_provider_envelope_for_worker: {
        Args: { target_delivery_id: string; target_organisation_id: string }
        Returns: {
          delivery_id: string
          delivery_key: string
          html_body: string
          organisation_id: string
          payload_hash: string
          recipient_email: string
          sender_from: string
          subject: string
          text_body: string
        }[]
      }
      get_people_directory: {
        Args: {
          target_page?: number
          target_page_size?: number
          target_search?: string
        }
        Returns: Json
      }
      get_potential_benefit_overlaps: {
        Args: { target_benefit_id: string }
        Returns: {
          candidate_benefit_id: string
          candidate_benefit_number: string
          candidate_title: string
          signal_detail: string
          signal_type: string
        }[]
      }
      get_problem_solving_detail: {
        Args: { target_case_id: string }
        Returns: Json
      }
      get_problem_solving_list: {
        Args: {
          target_facilitator_membership_id?: string
          target_owner_membership_id?: string
          target_page?: number
          target_page_size?: number
          target_search?: string
          target_severity?: string
          target_status?: string
          target_unit_id?: string
        }
        Returns: Json
      }
      get_problem_solving_methods: { Args: never; Returns: Json }
      get_problem_solving_overview: { Args: never; Returns: Json }
      get_project_benefits: {
        Args: { target_project_id: string }
        Returns: Json
      }
      get_recognition_feed: {
        Args: { target_page?: number; target_page_size?: number }
        Returns: Json
      }
      get_suggestion_benefits: {
        Args: { target_suggestion_id: string }
        Returns: Json
      }
      get_suggestion_detail: {
        Args: { target_suggestion_id: string }
        Returns: Json
      }
      get_suggestion_review_queue: { Args: never; Returns: Json }
      get_suggestions_list: {
        Args: {
          target_page?: number
          target_page_size?: number
          target_search?: string
          target_status?: string
        }
        Returns: Json
      }
      get_suggestions_overview: { Args: never; Returns: Json }
      get_training_compliance_summary: {
        Args: { target_unit_id?: string }
        Returns: Json
      }
      get_workforce_import_credential_export_rows: {
        Args: { target_import_job_id: string }
        Returns: {
          credential_ciphertext: string
          credential_nonce: string
          first_name: string
          import_row_id: string
          job_title: string
          last_name: string
          primary_unit_path: string
          row_number: number
          username: string
        }[]
      }
      get_workforce_import_job_progress: {
        Args: { target_import_job_id: string }
        Returns: Json
      }
      get_workforce_import_preview_rows: {
        Args: { target_import_job_id: string }
        Returns: {
          access_scope_unit_path: string
          application_role: string
          display_name: string
          job_function: string
          primary_unit_path: string
          row_number: number
          username: string
        }[]
      }
      get_workforce_import_validation_rows: {
        Args: { target_import_job_id: string }
        Returns: {
          created_at: string
          created_membership_id: string | null
          error_code: string | null
          error_message: string | null
          field_errors: Json | null
          id: string
          import_job_id: string
          input_payload: Json
          organisation_id: string
          provisioning_intent_id: string | null
          resolved_payload: Json | null
          row_number: number
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "workforce_import_rows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_workforce_provision_intent_for_worker: {
        Args: { expected_caller_user_id: string; target_intent_id: string }
        Returns: {
          created_auth_user_id: string
          intent_id: string
          organisation_code: string
          organisation_id: string
          sealed_internal_login_identifier: string
          status: string
          target_canonical_alias: string
          target_display_name: string
        }[]
      }
      grant_role_version: {
        Args: {
          target_grantee_membership_id: string
          target_organisation_id: string
          target_role_version_id: string
          target_scope_type: string
          target_scope_unit_id?: string
        }
        Returns: string
      }
      has_scoped_permission: {
        Args: {
          target_membership_id?: string
          target_organisation_id: string
          target_permission_key: string
          target_unit_id?: string
        }
        Returns: boolean
      }
      hold_project: {
        Args: { target_project_id: string; target_reason?: string }
        Returns: boolean
      }
      hook_require_invitation_for_signup: {
        Args: { event: Json }
        Returns: Json
      }
      initiate_attachment_upload: {
        Args: {
          target_byte_size: number
          target_filename: string
          target_mime_type: string
          target_resource_id: string
        }
        Returns: {
          attachment_id: string
          storage_object_path: string
        }[]
      }
      issue_organisation_invitation: {
        Args: {
          invitation_canonical_recipient: string
          invitation_expires_at: string
          invitation_recipient_type: string
          invitation_token_digest: string
          offered_role_version_id: string
          offered_scope_type: string
          offered_scope_unit_id?: string
          target_organisation_id: string
        }
        Returns: string
      }
      issue_organisation_member_invitation: {
        Args: {
          intended_display_name?: string
          intended_job_function_id?: string
          intended_organisational_unit_id?: string
          invitation_canonical_recipient: string
          invitation_expires_at: string
          invitation_recipient_type: string
          invitation_token_digest: string
          offered_role_version_id: string
          offered_scope_type: string
          offered_scope_unit_id?: string
        }
        Returns: string
      }
      link_benefit_evidence: {
        Args: { target_attachment_id: string; target_benefit_id: string }
        Returns: string
      }
      link_ci_project_evidence: {
        Args: {
          target_attachment_id: string
          target_project_id: string
          target_project_phase_id?: string
        }
        Returns: string
      }
      link_countermeasure_causes: {
        Args: {
          target_countermeasure_id: string
          target_hypothesis_ids: string[]
        }
        Returns: number
      }
      link_criterion_question: {
        Args: {
          target_contributes_to_score?: boolean
          target_criterion_id: string
          target_question_id: string
          target_scoring_metadata?: Json
        }
        Returns: string
      }
      link_five_s_evidence: {
        Args: {
          target_attachment_id: string
          target_audit_id: string
          target_finding_id?: string
          target_question_id?: string
          target_section_id?: string
        }
        Returns: string
      }
      link_gemba_evidence: {
        Args: {
          target_attachment_id: string
          target_observation_id?: string
          target_question_id?: string
          target_section_id?: string
          target_walk_id: string
        }
        Returns: string
      }
      link_maturity_evidence: {
        Args: {
          target_assessment_id: string
          target_attachment_id: string
          target_criterion_id: string
          target_question_id?: string
        }
        Returns: string
      }
      link_node_hypothesis: {
        Args: { target_hypothesis_id: string; target_node_id: string }
        Returns: boolean
      }
      link_problem_solving_evidence: {
        Args: {
          target_attachment_id: string
          target_case_id: string
          target_containment_id?: string
          target_countermeasure_id?: string
          target_current_condition_item_id?: string
          target_effectiveness_check_id?: string
          target_hypothesis_id?: string
          target_hypothesis_test_id?: string
          target_is_case_level?: boolean
          target_link_rationale?: string
          target_session_entry_id?: string
          target_session_id?: string
          target_sustainment_item_id?: string
        }
        Returns: string
      }
      list_my_eligible_organisations: {
        Args: never
        Returns: {
          membership_id: string
          organisation_code: string
          organisation_id: string
          organisation_name: string
          selected: boolean
        }[]
      }
      mark_benefit_realised: {
        Args: { target_benefit_id: string; target_reason?: string }
        Returns: boolean
      }
      mark_suggestion_implemented: {
        Args: {
          target_follow_up_note?: string
          target_implementation_outcome?: string
          target_implementation_summary: string
          target_suggestion_id: string
        }
        Returns: boolean
      }
      mark_workforce_import_credentials_exported: {
        Args: { target_import_job_id: string }
        Returns: undefined
      }
      mark_workforce_provision_needs_remediation: {
        Args: { target_failure_reason: string; target_intent_id: string }
        Returns: boolean
      }
      member_has_permission: {
        Args: { target_permission_key: string }
        Returns: boolean
      }
      move_organisation_unit: {
        Args: {
          target_organisation_id: string
          target_parent_unit_id: string
          target_unit_id: string
        }
        Returns: boolean
      }
      move_problem_solving_stage: {
        Args: { target_case_id: string; target_stage_id: string }
        Returns: boolean
      }
      preauthorize_workforce_provision: {
        Args: {
          target_alias_type?: string
          target_canonical_alias: string
          target_display_name: string
          target_idempotency_key?: string
          target_job_function_id?: string
          target_job_title?: string
          target_notification_email?: string
          target_organisational_unit_id?: string
          target_role_version_id: string
          target_scope_type: string
          target_scope_unit_id?: string
        }
        Returns: string
      }
      prepare_organisation_invitation_signup_binding: {
        Args: { invitation_token_digest: string }
        Returns: string
      }
      preview_organisation_invitation: {
        Args: { invitation_token_digest: string }
        Returns: Json
      }
      provision_organisation: {
        Args: {
          organisation_code: string
          organisation_locale?: string
          organisation_name: string
          organisation_reporting_currency?: string
          organisation_time_zone?: string
          owner_user_id: string
        }
        Returns: string
      }
      provision_workforce_identity: {
        Args: {
          target_alias_type: string
          target_canonical_alias: string
          target_internal_login_identifier: string
          target_membership_id: string
          target_organisation_id: string
          target_user_id: string
        }
        Returns: {
          internal_login_identifier: string
          reused_existing_account: boolean
          workforce_account_id: string
        }[]
      }
      publish_ci_project_methodology_version: {
        Args: { target_methodology_version_id: string }
        Returns: boolean
      }
      publish_five_s_standard_version: {
        Args: { target_standard_version_id: string }
        Returns: boolean
      }
      publish_gemba_definition_version: {
        Args: { target_definition_version_id: string }
        Returns: boolean
      }
      publish_maturity_model_version: {
        Args: { target_model_version_id: string }
        Returns: boolean
      }
      publish_official_maturity_result: {
        Args: { target_assessment_id: string }
        Returns: string
      }
      publish_problem_solving_method_version: {
        Args: { target_method_version_id: string }
        Returns: boolean
      }
      publish_role_version: {
        Args: { target_organisation_id: string; target_role_version_id: string }
        Returns: boolean
      }
      publish_skill_capability_set_version: {
        Args: { target_capability_set_version_id: string }
        Returns: boolean
      }
      publish_skill_proficiency_scale_version: {
        Args: { target_scale_version_id: string }
        Returns: boolean
      }
      publish_suggestion_programme_version: {
        Args: { target_programme_version_id: string }
        Returns: boolean
      }
      publish_template_version: {
        Args: { target_template_version_id: string }
        Returns: boolean
      }
      publish_training_course_version: {
        Args: { target_course_version_id: string }
        Returns: boolean
      }
      publish_training_curriculum_version: {
        Args: { target_curriculum_version_id: string }
        Returns: boolean
      }
      reactivate_suggestion_category: {
        Args: { target_category_id: string }
        Returns: boolean
      }
      reactivate_suggestion_programme: {
        Args: { target_programme_id: string }
        Returns: boolean
      }
      record_ai_proposal_accepted: {
        Args: {
          target_action_id?: string
          target_ai_proposal_id: string
          target_containment_id?: string
          target_countermeasure_id?: string
          target_current_condition_item_id?: string
          target_effectiveness_check_id?: string
          target_hypothesis_id?: string
          target_hypothesis_test_id?: string
          target_lesson_learned_id?: string
          target_problem_solving_session_id?: string
          target_session_entry_id?: string
          target_sustainment_item_id?: string
        }
        Returns: undefined
      }
      record_authentication_rate_limit_failure: {
        Args: {
          block_seconds: number
          limiter_dimension: string
          limiter_key_hash: string
          limiter_purpose: string
          maximum_attempts: number
          window_seconds: number
        }
        Returns: boolean
      }
      record_authentication_security_event: {
        Args: {
          event_action: string
          event_organisation_id?: string
          event_outcome: string
        }
        Returns: string
      }
      record_benefit_validation: {
        Args: {
          target_benefit_id: string
          target_decision: string
          target_rationale: string
          target_validation_role: string
        }
        Returns: string
      }
      record_effectiveness_result: {
        Args: {
          target_actual_numeric?: number
          target_effectiveness_check_id: string
          target_result: string
          target_verification_rationale?: string
        }
        Returns: boolean
      }
      record_metric_measurement: {
        Args: {
          target_measured_at?: string
          target_measured_value: number
          target_metric_id: string
          target_note?: string
        }
        Returns: string
      }
      record_skill_self_assessment: {
        Args: {
          target_assessed_at?: string
          target_assessment_method?: string
          target_membership_id: string
          target_notes?: string
          target_proficiency_level_id: string
          target_proficiency_scale_version_id: string
          target_skill_id: string
        }
        Returns: string
      }
      record_skill_validation: {
        Args: {
          target_assessed_at?: string
          target_assessment_method?: string
          target_membership_id: string
          target_notes?: string
          target_organisational_unit_id?: string
          target_proficiency_level_id: string
          target_proficiency_scale_version_id: string
          target_skill_id: string
          target_valid_until?: string
        }
        Returns: string
      }
      record_suggestion_review: {
        Args: {
          target_decision: string
          target_effort_level: string
          target_impact_level: string
          target_implementation_recommendation?: string
          target_rationale: string
          target_suggestion_id: string
        }
        Returns: string
      }
      record_sustainment_result: {
        Args: {
          target_evidence?: string
          target_result: string
          target_sustainment_item_id: string
        }
        Returns: boolean
      }
      record_training_completion: {
        Args: {
          target_completed_at?: string
          target_completion_method?: string
          target_course_version_id: string
          target_external_certificate_reference?: string
          target_membership_id: string
          target_notes?: string
          target_session_id?: string
          target_trainer_membership_id?: string
          target_trainer_name?: string
          target_validity_days_override?: number
        }
        Returns: string
      }
      record_workforce_auth_created: {
        Args: { target_auth_user_id: string; target_intent_id: string }
        Returns: boolean
      }
      record_workforce_import_row_failure: {
        Args: {
          target_error_code: string
          target_error_message: string
          target_import_row_id: string
          target_needs_remediation?: boolean
        }
        Returns: undefined
      }
      record_workforce_import_row_success: {
        Args: { target_import_row_id: string; target_membership_id: string }
        Returns: undefined
      }
      reissue_organisation_member_invitation: {
        Args: {
          replacement_expires_at: string
          replacement_token_digest: string
          target_invitation_id: string
        }
        Returns: string
      }
      reject_ai_proposal: {
        Args: {
          target_ai_proposal_id: string
          target_rejection_reason?: string
        }
        Returns: undefined
      }
      reject_benefit_realisation_entry: {
        Args: { target_entry_id: string; target_reason?: string }
        Returns: boolean
      }
      reject_cause_hypothesis: {
        Args: {
          target_hypothesis_id: string
          target_rejection_rationale?: string
        }
        Returns: boolean
      }
      reject_countermeasure: {
        Args: { target_countermeasure_id: string; target_rationale?: string }
        Returns: boolean
      }
      release_authentication_rate_limit: {
        Args: {
          limiter_dimension: string
          limiter_key_hash: string
          limiter_purpose: string
          maximum_attempts: number
          window_seconds: number
        }
        Returns: boolean
      }
      release_containment: {
        Args: {
          target_containment_id: string
          target_release_rationale?: string
        }
        Returns: boolean
      }
      remove_benefit_from_overlap_group: {
        Args: {
          target_benefit_id: string
          target_overlap_group_id: string
          target_reason?: string
        }
        Returns: boolean
      }
      remove_benefit_source_link: {
        Args: { target_benefit_id: string; target_source_resource_id: string }
        Returns: boolean
      }
      remove_problem_solving_source_link: {
        Args: { target_link_id: string }
        Returns: boolean
      }
      remove_training_session_participant: {
        Args: { target_participant_id: string; target_session_id: string }
        Returns: boolean
      }
      replace_benefit_forecast_periods: {
        Args: { target_forecast_version_id: string; target_periods: Json }
        Returns: boolean
      }
      resolve_benefit_submit_validators: {
        Args: { target_benefit_id: string }
        Returns: Json
      }
      resolve_organisation_invitation_session: {
        Args: { invitation_token_digest: string }
        Returns: Json
      }
      resolve_organisation_invitation_signup_binding: {
        Args: { target_binding_id: string }
        Returns: Json
      }
      resolve_workforce_login: {
        Args: { organisation_code: string; workforce_alias: string }
        Returns: {
          internal_login_identifier: string
          membership_id: string
          organisation_id: string
          password_change_required: boolean
          user_id: string
          workforce_account_id: string
        }[]
      }
      restore_organisation: {
        Args: { change_reason: string; target_organisation_id: string }
        Returns: boolean
      }
      resume_project: { Args: { target_project_id: string }; Returns: boolean }
      retry_workforce_import_failed_rows: {
        Args: { target_import_job_id: string }
        Returns: number
      }
      return_benefit_to_draft: {
        Args: { target_benefit_id: string; target_reason?: string }
        Returns: boolean
      }
      return_project_to_draft: {
        Args: { target_project_id: string; target_reason?: string }
        Returns: boolean
      }
      revoke_access_grant: {
        Args: {
          change_reason: string
          target_grant_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      revoke_identity_sessions: {
        Args: { change_reason: string; target_user_id: string }
        Returns: number
      }
      revoke_organisation_invitation: {
        Args: {
          change_reason: string
          target_invitation_id: string
          target_organisation_id: string
        }
        Returns: boolean
      }
      revoke_recognition: {
        Args: { target_award_id: string; target_reason: string }
        Returns: boolean
      }
      revoke_training_completion: {
        Args: { target_completion_id: string; target_notes?: string }
        Returns: boolean
      }
      search_similar_problem_solving_cases: {
        Args: { target_case_id: string; target_limit?: number }
        Returns: Json
      }
      select_countermeasure: {
        Args: { target_countermeasure_id: string; target_rationale?: string }
        Returns: boolean
      }
      set_membership_status: {
        Args: {
          change_reason: string
          target_membership_id: string
          target_organisation_id: string
          target_status: string
        }
        Returns: boolean
      }
      set_organisation_unit_status: {
        Args: {
          change_reason: string
          target_organisation_id: string
          target_status: string
          target_unit_id: string
        }
        Returns: boolean
      }
      start_ai_run: {
        Args: {
          target_ai_session_id: string
          target_idempotency_key: string
          target_model: string
          target_prompt_hash: string
          target_prompt_key: string
          target_prompt_version: string
          target_provider: string
          target_user_message: string
        }
        Returns: string
      }
      start_benefit_realisation: {
        Args: { target_benefit_id: string }
        Returns: boolean
      }
      start_five_s_audit: {
        Args: {
          target_schedule_occurrence_id?: string
          target_standard_id: string
          target_unit_id: string
        }
        Returns: string
      }
      start_gemba_walk: {
        Args: {
          target_definition_id: string
          target_schedule_occurrence_id?: string
          target_unit_id: string
        }
        Returns: string
      }
      start_maturity_assessment: {
        Args: {
          target_assessment_type: string
          target_lead_assessor_membership_id?: string
          target_model_version_id: string
          target_unit_id: string
        }
        Returns: string
      }
      start_problem_solving_session: {
        Args: {
          target_case_id: string
          target_facilitator_membership_id?: string
          target_scheduled_at?: string
          target_title: string
        }
        Returns: string
      }
      start_project: { Args: { target_project_id: string }; Returns: boolean }
      start_workforce_import_provisioning: {
        Args: { target_import_job_id: string }
        Returns: undefined
      }
      store_notification_delivery_provider_envelope_for_worker: {
        Args: {
          expected_delivery_key: string
          target_delivery_id: string
          target_html_body: string
          target_organisation_id: string
          target_payload_hash: string
          target_recipient_email: string
          target_sender_from: string
          target_subject: string
          target_text_body: string
        }
        Returns: {
          delivery_id: string
          delivery_key: string
          html_body: string
          organisation_id: string
          payload_hash: string
          recipient_email: string
          sender_from: string
          subject: string
          text_body: string
        }[]
      }
      store_workforce_import_row_credential: {
        Args: {
          target_ciphertext: string
          target_expires_at: string
          target_import_row_id: string
          target_nonce: string
        }
        Returns: undefined
      }
      submit_benefit: {
        Args: {
          target_benefit_id: string
          target_ci_validator_membership_id: string
          target_finance_validator_membership_id?: string
        }
        Returns: string
      }
      submit_benefit_forecast: {
        Args: { target_forecast_version_id: string }
        Returns: boolean
      }
      submit_benefit_realisation_entry: {
        Args: { target_entry_id: string }
        Returns: boolean
      }
      submit_ci_project_charter: {
        Args: { target_project_id: string }
        Returns: boolean
      }
      submit_maturity_assessment: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      submit_project: { Args: { target_project_id: string }; Returns: boolean }
      submit_suggestion: {
        Args: { target_suggestion_id: string }
        Returns: boolean
      }
      submit_workforce_import_rows: {
        Args: { target_import_job_id: string; target_rows: Json }
        Returns: undefined
      }
      suspend_or_close_organisation: {
        Args: {
          change_reason: string
          target_organisation_id: string
          target_status: string
        }
        Returns: boolean
      }
      switch_organisation: {
        Args: { target_organisation_id: string }
        Returns: boolean
      }
      update_benefit_category: {
        Args: {
          target_category_id: string
          target_description?: string
          target_display_order?: number
          target_name: string
        }
        Returns: boolean
      }
      update_benefit_draft: {
        Args: {
          target_baseline_description?: string
          target_baseline_financial_value?: number
          target_baseline_measure_unit?: string
          target_baseline_measure_value?: number
          target_baseline_period_end?: string
          target_baseline_period_start?: string
          target_benefit_class?: string
          target_benefit_id: string
          target_category_id?: string
          target_description?: string
          target_financial_type?: string
          target_is_standalone_initiative?: boolean
          target_non_financial_type?: string
          target_organisational_unit_id?: string
          target_owner_membership_id?: string
          target_planned_realisation_end?: string
          target_planned_realisation_start?: string
          target_title: string
        }
        Returns: boolean
      }
      update_benefit_forecast_draft: {
        Args: {
          target_assumptions?: string
          target_calculation_basis?: string
          target_forecast_end_date: string
          target_forecast_start_date: string
          target_forecast_total_amount?: number
          target_forecast_version_id: string
          target_realisation_pattern: string
          target_target_date?: string
          target_target_measure_unit?: string
          target_target_measure_value?: number
        }
        Returns: boolean
      }
      update_benefit_overlap_allocation: {
        Args: {
          target_allocation_percentage: number
          target_benefit_id: string
          target_overlap_group_id: string
          target_reason?: string
        }
        Returns: string
      }
      update_ci_project_draft: {
        Args: {
          target_baseline_summary?: string
          target_constraints_risks?: string
          target_expected_impact_summary?: string
          target_methodology_version_id?: string
          target_objective?: string
          target_planned_end_date?: string
          target_planned_start_date?: string
          target_priority?: string
          target_problem_statement?: string
          target_project_id: string
          target_scope_in?: string
          target_scope_out?: string
          target_sustainment_expectation?: string
          target_target_summary?: string
          target_title?: string
        }
        Returns: boolean
      }
      update_containment: {
        Args: {
          target_containment_id: string
          target_description?: string
          target_is_still_required?: boolean
          target_rationale?: string
        }
        Returns: boolean
      }
      update_hypothesis_status: {
        Args: {
          target_hypothesis_id: string
          target_reason?: string
          target_status: string
        }
        Returns: boolean
      }
      update_job_function: {
        Args: {
          target_description?: string
          target_job_function_id: string
          target_name: string
        }
        Returns: boolean
      }
      update_organisation_ai_settings: {
        Args: {
          target_ai_enabled: boolean
          target_monthly_token_ceiling?: number
        }
        Returns: undefined
      }
      update_organisation_membership_display_name: {
        Args: { target_display_name: string; target_membership_id: string }
        Returns: boolean
      }
      update_problem_solving_case_draft: {
        Args: {
          target_background?: string
          target_business_impact?: string
          target_case_id: string
          target_detected_at?: string
          target_facilitator_membership_id?: string
          target_method_version_id?: string
          target_owner_membership_id?: string
          target_priority?: string
          target_problem_statement?: string
          target_scope_in?: string
          target_scope_out?: string
          target_severity?: string
          target_target_condition?: string
          target_target_due_at?: string
          target_title?: string
        }
        Returns: boolean
      }
      update_schedule_definition: {
        Args: {
          target_description?: string
          target_end_date?: string
          target_is_all_day?: boolean
          target_local_time?: string
          target_owner_membership_id: string
          target_participant_membership_ids?: string[]
          target_recurrence: Json
          target_schedule_definition_id: string
          target_start_date: string
          target_title: string
          target_unit_id: string
        }
        Returns: boolean
      }
      update_suggestion_category: {
        Args: {
          target_category_id: string
          target_description?: string
          target_display_order?: number
          target_name?: string
        }
        Returns: boolean
      }
      update_suggestion_draft: {
        Args: {
          target_category_id?: string
          target_expected_benefit_summary?: string
          target_problem_or_opportunity: string
          target_proposed_idea: string
          target_suggestion_id: string
          target_target_unit_id?: string
          target_template_submission_id?: string
          target_title: string
        }
        Returns: boolean
      }
      update_suggestion_programme: {
        Args: {
          target_description?: string
          target_name: string
          target_programme_id: string
        }
        Returns: boolean
      }
      update_training_course_draft_version: {
        Args: {
          target_course_version_id: string
          target_delivery_method?: string
          target_duration_minutes?: number
          target_evidence_requirements?: Json
          target_learning_objectives?: string
          target_trainer_requirements?: string
          target_validity_days?: number
        }
        Returns: boolean
      }
      update_training_session_participant_status: {
        Args: {
          target_participant_id: string
          target_session_id: string
          target_status: string
        }
        Returns: boolean
      }
      upsert_benefit_reporting_settings: {
        Args: { target_fiscal_year_start_month: number }
        Returns: boolean
      }
      upsert_five_s_audit_answer: {
        Args: {
          target_audit_id: string
          target_date_value?: string
          target_is_not_applicable?: boolean
          target_json_value?: Json
          target_number_value?: number
          target_question_id: string
          target_text_value?: string
        }
        Returns: string
      }
      upsert_gemba_walk_answer: {
        Args: {
          target_date_value?: string
          target_is_not_applicable?: boolean
          target_json_value?: Json
          target_number_value?: number
          target_question_id: string
          target_text_value?: string
          target_walk_id: string
        }
        Returns: string
      }
      upsert_maturity_assessment_answer: {
        Args: {
          target_assessment_id: string
          target_date_value?: string
          target_is_not_applicable?: boolean
          target_json_value?: Json
          target_number_value?: number
          target_question_id: string
          target_text_value?: string
        }
        Returns: string
      }
      upsert_template_answer: {
        Args: {
          target_date_value?: string
          target_is_not_applicable?: boolean
          target_json_value?: Json
          target_number_value?: number
          target_question_id: string
          target_submission_id: string
          target_text_value?: string
        }
        Returns: string
      }
      validate_benefit_realisation_entry: {
        Args: { target_entry_id: string }
        Returns: boolean
      }
      validate_workforce_import_job: {
        Args: { target_import_job_id: string }
        Returns: Json
      }
      verify_cause_hypothesis: {
        Args: {
          target_hypothesis_id: string
          target_verification_rationale: string
        }
        Returns: boolean
      }
      verify_current_condition_item: {
        Args: { target_item_id: string; target_verification_rationale?: string }
        Returns: boolean
      }
      withdraw_benefit: {
        Args: { target_benefit_id: string; target_reason?: string }
        Returns: boolean
      }
      withdraw_suggestion: {
        Args: { target_reason?: string; target_suggestion_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

