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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organisation_invitation: {
        Args: { invitation_token_digest: string }
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
      add_role_permission: {
        Args: {
          target_organisation_id: string
          target_permission_key: string
          target_role_version_id: string
        }
        Returns: boolean
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
      approve_maturity_assessment: {
        Args: { target_assessment_id: string }
        Returns: boolean
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
      begin_assessor_review: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      calculate_maturity_assessment_scores: {
        Args: { target_assessment_id: string }
        Returns: boolean
      }
      can_read_maturity_assessment: {
        Args: { target_assessment_id: string; target_organisation_id: string }
        Returns: boolean
      }
      cancel_maturity_assessment: {
        Args: { target_assessment_id: string; target_reason?: string }
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
      create_comment: {
        Args: { target_body: string; target_resource_id: string }
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
      create_protected_role_draft: {
        Args: {
          role_canonical_name: string
          role_description?: string
          role_display_name: string
          target_organisation_id: string
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
      disable_workforce_identity: {
        Args: { change_reason: string; target_user_id: string }
        Returns: number
      }
      edit_comment: {
        Args: { target_body: string; target_comment_id: string }
        Returns: boolean
      }
      expire_organisation_security_state: {
        Args: { target_organisation_id: string }
        Returns: {
          expired_grants: number
          expired_invitations: number
        }[]
      }
      finalise_identity_enrolment: {
        Args: { target_user_id: string }
        Returns: boolean
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
      link_criterion_question: {
        Args: {
          target_contributes_to_score?: boolean
          target_criterion_id: string
          target_question_id: string
          target_scoring_metadata?: Json
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
      move_organisation_unit: {
        Args: {
          target_organisation_id: string
          target_parent_unit_id: string
          target_unit_id: string
        }
        Returns: boolean
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
      publish_maturity_model_version: {
        Args: { target_model_version_id: string }
        Returns: boolean
      }
      publish_official_maturity_result: {
        Args: { target_assessment_id: string }
        Returns: string
      }
      publish_role_version: {
        Args: { target_organisation_id: string; target_role_version_id: string }
        Returns: boolean
      }
      publish_template_version: {
        Args: { target_template_version_id: string }
        Returns: boolean
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
      start_maturity_assessment: {
        Args: {
          target_assessment_type: string
          target_lead_assessor_membership_id?: string
          target_model_version_id: string
          target_unit_id: string
        }
        Returns: string
      }
      submit_maturity_assessment: {
        Args: { target_assessment_id: string }
        Returns: boolean
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

