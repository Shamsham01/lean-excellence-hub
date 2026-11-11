import type {
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
};
