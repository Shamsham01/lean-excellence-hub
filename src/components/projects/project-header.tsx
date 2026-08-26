import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  projectPriorityLabel,
  projectStatusBadgeVariant,
  projectStatusLabel,
} from "@/lib/projects/status";
import type { ProjectDetail } from "@/lib/projects/types";

type ProjectHeaderProps = {
  detail: ProjectDetail;
  canManage: boolean;
  unitName?: string | null;
  methodologyLabel?: string | null;
  currentPhaseTitle?: string | null;
  ownerName?: string | null;
  onSubmit?: () => void;
  onApprove?: () => void;
  onStart?: () => void;
  message?: string | null;
};

export function ProjectHeader({
  detail,
  canManage,
  unitName,
  methodologyLabel,
  currentPhaseTitle,
  ownerName,
  onSubmit,
  onApprove,
  onStart,
  message,
}: ProjectHeaderProps) {
  const showSubmit = canManage && detail.status === "draft" && onSubmit;
  const showApprove = canManage && detail.status === "submitted" && onApprove;
  const showStart = canManage && detail.status === "approved" && onStart;

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{detail.project_number}</p>
          <h1 className="typography-page-title">{detail.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={projectStatusBadgeVariant(detail.status)}>
              {projectStatusLabel(detail.status)}
            </Badge>
            <Badge variant="outline">{projectPriorityLabel(detail.priority)}</Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {unitName ? (
              <div>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="font-medium">{unitName}</dd>
              </div>
            ) : null}
            {methodologyLabel ? (
              <div>
                <dt className="text-muted-foreground">Methodology</dt>
                <dd className="font-medium">{methodologyLabel}</dd>
              </div>
            ) : null}
            {currentPhaseTitle ? (
              <div>
                <dt className="text-muted-foreground">Current phase</dt>
                <dd className="font-medium">{currentPhaseTitle}</dd>
              </div>
            ) : null}
            {ownerName ? (
              <div>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium">{ownerName}</dd>
              </div>
            ) : null}
            {detail.planned_end_date ? (
              <div>
                <dt className="text-muted-foreground">Planned end</dt>
                <dd className="font-medium">{detail.planned_end_date}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {showSubmit ? (
            <Button size="sm" onClick={onSubmit}>
              Submit charter
            </Button>
          ) : null}
          {showApprove ? (
            <Button size="sm" onClick={onApprove}>
              Approve
            </Button>
          ) : null}
          {showStart ? (
            <Button size="sm" onClick={onStart}>
              Start project
            </Button>
          ) : null}
        </div>
      </div>
      {message ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
