import { AppLink } from "@/components/ui/app-link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CharterRequirement } from "@/lib/projects/charter";
import {
  formatProjectReference,
  projectPriorityLabel,
  projectStatusBadgeVariant,
  projectStatusLabel,
} from "@/lib/projects/status";
import type { ProjectDetail, ProjectSourceLink } from "@/lib/projects/types";

type ProjectHeaderProps = {
  detail: ProjectDetail;
  canManage: boolean;
  unitName?: string | null;
  methodologyLabel?: string | null;
  currentPhaseTitle?: string | null;
  ownerName?: string | null;
  onSubmit?: () => void;
  onApprove?: () => void;
  onReturnToDraft?: () => void;
  onStart?: () => void;
  message?: string | null;
  charterReady?: boolean;
  missingRequirements?: CharterRequirement[];
  submitting?: boolean;
};

function sourceLabel(link: ProjectSourceLink): string {
  return link.reference?.trim() || link.title?.trim() || link.resource_type;
}

export function ProjectHeader({
  detail,
  canManage,
  unitName,
  methodologyLabel,
  currentPhaseTitle,
  ownerName,
  onSubmit,
  onApprove,
  onReturnToDraft,
  onStart,
  message,
  charterReady = true,
  missingRequirements = [],
  submitting = false,
}: ProjectHeaderProps) {
  const showSubmit = canManage && detail.status === "draft" && onSubmit;
  const showApprove = canManage && detail.status === "submitted" && onApprove;
  const showReturnToDraft =
    canManage &&
    (detail.status === "submitted" || detail.status === "approved") &&
    onReturnToDraft;
  const showStart = canManage && detail.status === "approved" && onStart;
  const sourceLinks = detail.source_links ?? [];

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium text-muted-foreground"
            data-testid="project-reference"
          >
            {formatProjectReference(detail.project_number, detail.title)}
          </p>
          <h1 className="typography-page-title">{detail.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant={projectStatusBadgeVariant(detail.status)}
              data-testid="project-status"
            >
              {projectStatusLabel(detail.status)}
            </Badge>
            <Badge variant="outline">
              {projectPriorityLabel(detail.priority)}
            </Badge>
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
          {sourceLinks.length > 0 ? (
            <div
              className="mt-4 flex flex-col gap-1 text-sm"
              data-testid="project-source-links"
            >
              <p className="text-muted-foreground">Source</p>
              {sourceLinks.map((link) =>
                link.href ? (
                  <AppLink
                    key={link.id}
                    href={link.href}
                    className="font-medium text-primary hover:underline"
                    data-testid={`project-source-link-${link.id}`}
                  >
                    {sourceLabel(link)}
                    {link.title ? ` · ${link.title}` : ""}
                  </AppLink>
                ) : (
                  <p key={link.id} className="font-medium">
                    {sourceLabel(link)}
                  </p>
                ),
              )}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {showSubmit ? (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={!charterReady || submitting}
              data-testid="submit-charter-button"
            >
              {submitting ? "Submitting…" : "Submit charter"}
            </Button>
          ) : null}
          {showApprove ? (
            <Button
              size="sm"
              onClick={onApprove}
              data-testid="approve-project-button"
            >
              Approve
            </Button>
          ) : null}
          {showReturnToDraft ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onReturnToDraft}
              data-testid="return-project-to-draft-button"
            >
              Return to draft
            </Button>
          ) : null}
          {showStart ? (
            <Button
              size="sm"
              onClick={onStart}
              data-testid="start-project-button"
            >
              Start project
            </Button>
          ) : null}
        </div>
      </div>
      {showSubmit && missingRequirements.length > 0 ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          data-testid="charter-readiness"
          role="alert"
        >
          <p className="font-medium">Charter is not ready to submit</p>
          <ul className="mt-1 list-disc pl-5">
            {missingRequirements.map((requirement) => (
              <li key={requirement.key}>{requirement.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? (
        <p
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-testid="project-workspace-message"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
