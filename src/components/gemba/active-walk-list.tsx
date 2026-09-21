import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import {
  formatGembaWalkResumePrimaryLabel,
  formatGembaWalkResumeSecondaryLabel,
  formatGembaWalkStartedDate,
  type GembaActiveWalk,
} from "@/modules/operational/gemba-active-walks";
import { formatGembaWalkStatus } from "@/modules/operational/gemba-display";

type GembaActiveWalkListProps = {
  walks: GembaActiveWalk[];
  emptyMessage?: string;
  listTestId?: string;
};

export function GembaActiveWalkList({
  walks,
  emptyMessage = "No walks in progress in your current scope.",
  listTestId = "gemba-active-walk-list",
}: GembaActiveWalkListProps) {
  if (walks.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid={`${listTestId}-empty`}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid={listTestId}>
      {walks.map((walk) => {
        const startedDate = formatGembaWalkStartedDate(walk.started_at);

        return (
          <AppLink
            key={walk.id}
            href={`/platform/gemba/walks/${walk.id}`}
            className="rounded-md border border-border px-4 py-3 hover:bg-surface"
            data-testid={`gemba-active-walk-link-${walk.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="font-medium"
                  data-testid={`gemba-active-walk-title-${walk.id}`}
                >
                  {formatGembaWalkResumePrimaryLabel(walk)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatGembaWalkResumeSecondaryLabel(walk)}
                </p>
              </div>
              <Badge variant="information">
                {formatGembaWalkStatus(walk.status)}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-primary">Resume walk</span>
              {startedDate ? (
                <span className="text-xs text-muted-foreground">
                  Started {startedDate}
                </span>
              ) : null}
            </div>
          </AppLink>
        );
      })}
    </div>
  );
}
