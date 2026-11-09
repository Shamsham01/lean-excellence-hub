import { Check } from "lucide-react";

import { setupStatusLabel } from "@/modules/organisation-setup/readiness";
import type { SetupItem } from "@/modules/organisation-setup/types";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusVariant(status: SetupItem["status"]) {
  switch (status) {
    case "complete":
      return "text-success";
    case "in_progress":
    case "setup_started":
      return "text-warning-foreground";
    case "unavailable":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

export function SetupChecklistItem({ item }: { item: SetupItem }) {
  const statusText = item.canAssess
    ? setupStatusLabel(item.status)
    : "Unavailable";
  const isComplete = item.status === "complete";

  if (isComplete) {
    return (
      <details
        className="rounded-lg border border-success/40 bg-success/5"
        data-testid={`setup-item-${item.id}`}
        data-status={item.status}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-success/40 bg-success/15 text-success">
            <Check className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            {item.title}
          </span>
          <span className={cn("text-xs font-medium", statusVariant(item.status))}>
            {statusText}
          </span>
          {item.href && item.canPerform ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="shrink-0"
              onClick={(event) => event.stopPropagation()}
            >
              <AppLink href={item.href}>View</AppLink>
            </Button>
          ) : null}
        </summary>
        <div className="border-t border-success/20 px-4 py-3 text-sm text-muted-foreground">
          {item.description}
        </div>
      </details>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
      data-testid={`setup-item-${item.id}`}
      data-status={item.status}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
          <span className={`text-xs font-medium ${statusVariant(item.status)}`}>
            {statusText}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{item.description}</p>
        {!item.canPerform && item.helperMessage ? (
          <p className="text-xs text-muted-foreground">{item.helperMessage}</p>
        ) : null}
      </div>
      {item.href && item.canPerform ? (
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <AppLink href={item.href}>
            {item.status === "complete" ? "View" : "Set up"}
          </AppLink>
        </Button>
      ) : null}
    </div>
  );
}
