import type { ReactNode } from "react";

import { PageHeaderLeanAiButton } from "@/components/platform/page-header-lean-ai-button";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  descriptionTestId,
  breadcrumb,
  actions,
  leanAiHelp = true,
  leanAiHelpLabel,
  className,
}: {
  title: ReactNode;
  /** Opt-in: pass only when the line carries contextual data (org name, record title, etc.). */
  description?: string;
  descriptionTestId?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  leanAiHelp?: boolean;
  leanAiHelpLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {breadcrumb}
        <div className="flex min-w-0 items-start gap-2">
          <h1 className="typography-page-title min-w-0 flex-1">{title}</h1>
          {leanAiHelp ? (
            <PageHeaderLeanAiButton
              {...(leanAiHelpLabel ? { label: leanAiHelpLabel } : {})}
            />
          ) : null}
        </div>
        {description ? (
          <p
            className="typography-page-description max-w-2xl"
            data-testid={descriptionTestId}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto [&>*]:max-w-full [&>*]:min-w-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="typography-section-title">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
