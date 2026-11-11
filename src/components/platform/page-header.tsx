import type { ReactNode } from "react";

import { PageHeaderLeanAiButton } from "@/components/platform/page-header-lean-ai-button";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

function breadcrumbLastLabel(node: ReactNode): string | null {
  if (!node || typeof node !== "object" || !("props" in node)) return null;
  const props = (node as { props?: { items?: BreadcrumbItem[] } }).props;
  const items = props?.items;
  if (!items?.length) return null;
  return items[items.length - 1]?.label ?? null;
}

function defaultModuleBreadcrumb(label: string): BreadcrumbItem[] {
  return [{ label: "Platform", href: "/platform" }, { label }];
}

export function PageHeader({
  title,
  description,
  descriptionTestId,
  breadcrumb,
  breadcrumbItems,
  actions,
  leanAiHelp = true,
  leanAiHelpLabel,
  className,
}: {
  title?: ReactNode;
  /** Opt-in: pass only when the line carries contextual data (org name, record title, etc.). */
  description?: string;
  descriptionTestId?: string;
  breadcrumb?: ReactNode;
  breadcrumbItems?: BreadcrumbItem[];
  actions?: ReactNode;
  leanAiHelp?: boolean;
  leanAiHelpLabel?: string;
  className?: string;
}) {
  const resolvedBreadcrumbItems =
    breadcrumbItems ??
    (typeof title === "string" && !breadcrumb
      ? defaultModuleBreadcrumb(title)
      : undefined);

  const resolvedBreadcrumb =
    breadcrumb ??
    (resolvedBreadcrumbItems ? (
      <Breadcrumb items={resolvedBreadcrumbItems} pageHeading />
    ) : null);

  const lastCrumbLabel =
    resolvedBreadcrumbItems?.at(-1)?.label ?? breadcrumbLastLabel(breadcrumb);

  const autoBreadcrumbFromTitle =
    typeof title === "string" && !breadcrumb && !breadcrumbItems;

  const titleDuplicatesCrumb =
    typeof title === "string" &&
    lastCrumbLabel != null &&
    title.trim() === lastCrumbLabel.trim();

  const showBreadcrumbHeading = Boolean(resolvedBreadcrumb);
  const showTitle =
    title != null &&
    (typeof title !== "string" ||
      (!autoBreadcrumbFromTitle && !titleDuplicatesCrumb));

  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {showBreadcrumbHeading ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {resolvedBreadcrumb}
            {leanAiHelp ? (
              <PageHeaderLeanAiButton
                {...(leanAiHelpLabel ? { label: leanAiHelpLabel } : {})}
              />
            ) : null}
          </div>
        ) : null}
        {showTitle ? (
          <div className="flex min-w-0 items-start gap-2">
            <h1 className="typography-page-title min-w-0 flex-1">{title}</h1>
            {!showBreadcrumbHeading && leanAiHelp ? (
              <PageHeaderLeanAiButton
                {...(leanAiHelpLabel ? { label: leanAiHelpLabel } : {})}
              />
            ) : null}
          </div>
        ) : null}
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
