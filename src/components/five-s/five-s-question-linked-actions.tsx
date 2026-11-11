import { Badge } from "@/components/ui/badge";
import { AppLink } from "@/components/ui/app-link";
import { actionStatusLabel } from "@/lib/actions/status";

export type FiveSLinkedAction = {
  action_id: string;
  question_id: string | null;
  status: string;
  title: string;
  href: string;
};

export function FiveSQuestionLinkedActions({
  questionId,
  actions,
}: {
  questionId: string;
  actions: FiveSLinkedAction[];
}) {
  const linked = actions.filter((row) => row.question_id === questionId);
  if (linked.length === 0) return null;

  return (
    <ul
      className="mt-2 flex flex-col gap-1.5"
      data-testid={`five-s-question-actions-${questionId}`}
    >
      {linked.map((row) => (
        <li key={row.action_id} className="flex flex-wrap items-center gap-2">
          <AppLink
            href={row.href}
            className="text-sm text-primary hover:underline"
            data-testid={`five-s-linked-action-${row.action_id}`}
          >
            {row.title}
          </AppLink>
          <Badge variant="secondary" className="text-xs">
            {actionStatusLabel(row.status)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
