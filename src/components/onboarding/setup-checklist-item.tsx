import Link from "next/link";

import { setupStatusLabel } from "@/modules/organisation-setup/readiness";
import type { SetupItem } from "@/modules/organisation-setup/types";
import { Button } from "@/components/ui/button";

function statusVariant(status: SetupItem["status"]) {
  switch (status) {
    case "complete":
      return "text-emerald-700 dark:text-emerald-400";
    case "in_progress":
    case "setup_started":
      return "text-amber-700 dark:text-amber-400";
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

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
      data-testid={`setup-item-${item.id}`}
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
          <Link href={item.href}>
            {item.status === "complete" ? "View" : "Set up"}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
