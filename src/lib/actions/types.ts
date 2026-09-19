import type { ActionPriority, ActionStatus } from "@/lib/actions/status";

export type ActionSourceSummary = {
  id: string;
  resource_type: string;
  title: string | null;
  reference: string | null;
  href: string | null;
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
  created_by_membership_id: string;
  created_by_display_name: string;
  created_at: string;
  updated_at: string;
  version: number;
  assignees: ActionAssignee[];
  status_history: ActionStatusHistoryEntry[];
  permissions: ActionPermissions;
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
};
