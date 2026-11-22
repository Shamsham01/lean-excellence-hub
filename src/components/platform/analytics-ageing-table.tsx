import { AppLink } from "@/components/ui/app-link";
import type { AnalyticsAgeingRow } from "@/modules/platform-analytics/types";

export function AnalyticsAgeingTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: AnalyticsAgeingRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="analytics-ageing-empty"
      >
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="analytics-ageing-table">
      <table className="w-full min-w-[320px] text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Item</th>
            <th className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/60 last:border-0"
            >
              <td className="py-2 pr-3">
                {row.href ? (
                  <AppLink
                    href={row.href}
                    className="font-medium hover:underline"
                  >
                    {row.label}
                  </AppLink>
                ) : (
                  <span className="font-medium">{row.label}</span>
                )}
                {row.meta ? (
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    {row.meta}
                  </span>
                ) : null}
              </td>
              <td className="py-2 font-mono text-xs text-foreground tabular-nums">
                {row.metric}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
