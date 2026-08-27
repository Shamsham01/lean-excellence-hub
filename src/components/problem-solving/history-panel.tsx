import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { problemSolvingStatusLabel } from "@/lib/problem-solving/status";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type HistoryPanelProps = {
  detail: ProblemSolvingCaseDetail;
  membershipNameById: Record<string, string>;
};

export function HistoryPanel({
  detail,
  membershipNameById,
}: HistoryPanelProps) {
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="problem-solving-history-panel"
    >
      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.status_history.length === 0 ? (
            <p className="text-muted-foreground">No status changes yet.</p>
          ) : (
            detail.status_history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:justify-between"
              >
                <span>
                  {problemSolvingStatusLabel(entry.from_status)} →{" "}
                  {problemSolvingStatusLabel(entry.to_status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.changed_at).toLocaleString("en-GB")}
                  {entry.rationale ? ` · ${entry.rationale}` : ""}
                  {" · "}
                  {membershipNameById[entry.changed_by_membership_id] ??
                    entry.changed_by_membership_id.slice(0, 8)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stage history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {detail.stage_history.length === 0 ? (
            <p className="text-muted-foreground">No stage changes yet.</p>
          ) : (
            detail.stage_history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:justify-between"
              >
                <span>
                  {entry.from_stage?.title ?? "Start"} →{" "}
                  {entry.to_stage?.title ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.changed_at).toLocaleString("en-GB")}
                  {entry.notes ? ` · ${entry.notes}` : ""}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
