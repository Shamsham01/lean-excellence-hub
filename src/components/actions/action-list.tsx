import { EmptyState } from "@/components/platform/empty-state";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { ListTodo } from "lucide-react";
import {
  actionPriorityLabel,
  actionStatusBadgeVariant,
  actionStatusLabel,
  formatActionReference,
  formatDueDate,
} from "@/lib/actions/status";

export type ActionListItem = {
  id: string;
  action_number: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  due_at: string | null;
};

export function ActionList({ actions }: { actions: ActionListItem[] }) {
  if (actions.length === 0) {
    return (
      <EmptyState
        testId="actions-empty-state"
        title="No actions in your scope"
        description="No actions are currently available in your scope."
        icon={<ListTodo className="size-5" aria-hidden />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="actions-list">
      {actions.map((action) => (
        <AppLink
          key={action.id}
          href={`/platform/actions/${action.id}`}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
          data-testid={`action-list-item-${action.id}`}
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{action.title}</p>
            <p className="typography-metadata">
              {formatActionReference(action.action_number, action.title)}
              {action.due_at
                ? ` · Due ${formatDueDate(action.due_at)}`
                : ` · ${new Date(action.created_at).toLocaleDateString("en-GB")}`}
            </p>
          </div>
          <div className="ml-3 flex shrink-0 gap-2">
            <Badge variant={actionStatusBadgeVariant(action.status)}>
              {actionStatusLabel(action.status)}
            </Badge>
            <Badge variant="secondary">
              {actionPriorityLabel(action.priority)}
            </Badge>
          </div>
        </AppLink>
      ))}
    </div>
  );
}
