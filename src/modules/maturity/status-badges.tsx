import { Badge } from "@/components/ui/badge";

const statusLabels: Record<
  string,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "warning"
      | "success"
      | "information"
      | "destructive";
  }
> = {
  draft: { label: "Draft", variant: "secondary" },
  in_progress: { label: "In progress", variant: "information" },
  submitted: { label: "Submitted", variant: "warning" },
  assessor_review: { label: "In review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  published: { label: "Published", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function AssessmentStatusBadge({ status }: { status: string }) {
  const config = statusLabels[status] ?? {
    label: status,
    variant: "secondary" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function ScoreBadge({
  score,
  max = 5,
}: {
  score: number | null;
  max?: number;
}) {
  if (score == null) {
    return <Badge variant="secondary">—</Badge>;
  }
  return (
    <Badge variant="outline" className="font-mono tabular-nums">
      {score.toFixed(1)} / {max}
    </Badge>
  );
}
