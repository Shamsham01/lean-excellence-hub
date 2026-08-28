import Link from "next/link";

import { SetupChecklistItem } from "@/components/onboarding/setup-checklist-item";
import type { SetupItem } from "@/modules/organisation-setup/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupChecklist({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: SetupItem[];
}) {
  return (
    <Card data-testid="setup-checklist">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item) => (
          <SetupChecklistItem key={item.id} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

export function SetupChecklistCompact({ items }: { items: SetupItem[] }) {
  const incomplete = items.filter(
    (item) =>
      item.canAssess &&
      item.status !== "complete" &&
      item.status !== "unavailable",
  );

  if (incomplete.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-testid="setup-checklist-compact">
      {incomplete.slice(0, 3).map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span>{item.title}</span>
          {item.href && item.canPerform ? (
            <Link
              href={item.href}
              className="text-primary underline-offset-4 hover:underline"
            >
              Continue
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              {item.helperMessage ?? "Pending"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
