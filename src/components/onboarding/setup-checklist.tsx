import { SetupChecklistItem } from "@/components/onboarding/setup-checklist-item";
import type { SetupItem } from "@/modules/organisation-setup/types";
import { AppLink } from "@/components/ui/app-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupChecklist({
  title,
  description,
  items,
  supplementalTitle,
  supplementalDescription,
  supplementalItems,
}: {
  title: string;
  description?: string;
  items: SetupItem[];
  supplementalTitle?: string;
  supplementalDescription?: string;
  supplementalItems?: SetupItem[];
}) {
  const secondary = supplementalItems ?? [];

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
        {secondary.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {supplementalTitle ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {supplementalTitle}
                </h3>
                {supplementalDescription ? (
                  <p className="text-sm text-muted-foreground">
                    {supplementalDescription}
                  </p>
                ) : null}
              </div>
            ) : null}
            {secondary.map((item) => (
              <SetupChecklistItem key={item.id} item={item} />
            ))}
          </div>
        ) : null}
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
            <AppLink
              href={item.href}
              className="text-primary underline-offset-4 hover:underline"
            >
              Continue
            </AppLink>
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
