import type { ActionPriority, ActionStatus } from "@/lib/actions/status";

export type ActionSourceSummary = {
  id: string;
  resource_type: string;
  title: string | null;
  reference: string | null;
  href: string | null;
};

export type FiveSActionLineage = {
  audit_id: string;
  section_id: string | null;
  question_id: string | null;
  finding_id: string | null;
  standard_name: string | null;
  unit_name: string | null;
  completed_at: string | null;
  question_prompt: string | null;
  section_title: string | null;
  chip_label: string;
  audit_href: string;
};

export type ActionAssignee = {
  membership_id: string;
  display_name: string;
  assigned_at: string;
};

export type ActionStatusHistoryEntry = {
  id: string;
  from_status: string;
  to_status: string;
  reason: string | null;
  created_at: string;
  actor_membership_id: string;
  actor_display_name: string;
};

export type ActionPermissions = {
  can_update: boolean;
  can_assign: boolean;
  can_complete: boolean;
  can_start: boolean;
  can_reopen: boolean;
  can_cancel: boolean;
};

export type ActionLabel = {
  id: string;
  name: string;
  color: string;
};

export type ActionChecklistItem = {
  id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  completed_at: string | null;
};

export type ActionCardCoverAttachment = {
  id: string;
  filename: string;
  mime_type: string;
  storage_object_path: string;
};

export type ActionDetail = {
  id: string;
  action_number: string;
  title: string;
  description: string | null;
  status: ActionStatus | string;
  priority: ActionPriority | string;
  due_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  unit_id: string | null;
  unit_name: string | null;
  site_unit_id: string | null;
  source_resource_id: string | null;
  source: ActionSourceSummary | null;
  five_s_lineage?: FiveSActionLineage | null;
  created_by_membership_id: string;
  created_by_display_name: string;
  created_at: string;
  updated_at: string;
  version: number;
  assignees: ActionAssignee[];
  status_history: ActionStatusHistoryEntry[];
  permissions: ActionPermissions;
  labels?: ActionLabel[];
  checklist_items?: ActionChecklistItem[];
  comment_count?: number;
  card_cover_attachment?: ActionCardCoverAttachment | null;
};

export type LinkedSuggestionAction = {
  id: string;
  action_number: string | null;
  title: string;
  status: string;
  href: string;
  can_open: boolean;
};

export type AssignablePerson = {
  membership_id: string;
  display_name: string;
  avatar_url?: string | null;
};
