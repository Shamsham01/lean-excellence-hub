import Link from "next/link";

import { setupStatusLabel } from "@/modules/organisation-setup/readiness";
import type { CoreSetupState } from "@/modules/organisation-setup/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CoreSetupBanner({
  core,
  nextActionHref,
  nextActionLabel,
  compact = false,
}: {
  core: CoreSetupState;
  nextActionHref: string | null;
  nextActionLabel: string | null;
  compact?: boolean;
}) {
  if (core.readyLabel === "ready" && compact) {
    return (
      <Card
        className="border-border bg-surface"
        data-testid="core-setup-banner"
      >
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Ready to start
            </p>
            <p className="text-sm text-muted-foreground">
              Your organisation is set up for Lean Excellence Hub.
            </p>
          </div>
          {nextActionHref ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={nextActionHref}>
                {nextActionLabel ?? "View setup"}
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (core.readyLabel === "managed_by_admin") {
    return (
      <Card
        className="border-border bg-surface"
        data-testid="core-setup-banner"
      >
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground">Core setup</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Setup status is managed by your Organisation Administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  const incompleteCount = core.items.filter(
    (item) => item.canAssess && item.status !== "complete",
  ).length;

  return (
    <Card
      className="border-primary/20 bg-surface"
      data-testid="core-setup-banner"
    >
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {core.readyLabel === "ready" ? "Ready to start" : "Core setup"}
          </p>
          <p className="text-sm text-muted-foreground">
            {core.readyLabel === "ready"
              ? "Your organisation is ready to use Lean Excellence Hub."
              : `${incompleteCount} core ${incompleteCount === 1 ? "step" : "steps"} remaining before you are ready to start.`}
          </p>
        </div>
        {nextActionHref && core.readyLabel !== "ready" ? (
          <Button asChild>
            <Link href={nextActionHref}>
              {nextActionLabel ?? "Continue setup"}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CoreSetupStatusList({ core }: { core: CoreSetupState }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="core-setup-status-list">
      {core.items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="text-foreground">{item.title}</span>
          <span className="text-muted-foreground">
            {item.canAssess ? setupStatusLabel(item.status) : "Unavailable"}
          </span>
        </li>
      ))}
    </ul>
  );
}
