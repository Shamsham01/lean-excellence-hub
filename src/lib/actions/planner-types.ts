import type {
  ActionLabel,
  ActionPermissions,
  ActionSourceSummary,
} from "@/lib/actions/types";

export type ActionPlannerListItem = {
  id: string;
  action_number: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  due_at: string | null;
  version: number;
  assignee_display_name: string | null;
  assignee_membership_id: string | null;
  assignee_avatar_url: string | null;
  source: ActionSourceSummary | null;
  permissions: ActionPermissions;
  labels: ActionLabel[];
  checklist_done: number;
  checklist_total: number;
  comment_count: number;
  card_cover_mime_type: string | null;
  card_cover_storage_path: string | null;
};
