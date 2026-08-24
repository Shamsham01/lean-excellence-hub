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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organisation_invitation: {
        Args: { invitation_token_digest: string }
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
      current_identity_state: {
        Args: never
        Returns: {
          enrolment_status: string
          identity_status: string
          password_change_required: boolean
        }[]
      }
      current_workforce_login_identifier: { Args: never; Returns: string }
      disable_workforce_identity: {
        Args: { change_reason: string; target_user_id: string }
        Returns: number
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
      publish_role_version: {
        Args: { target_organisation_id: string; target_role_version_id: string }
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

