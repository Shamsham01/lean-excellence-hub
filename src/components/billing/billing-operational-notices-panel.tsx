import type { BillingOperationalNotice } from "@/modules/billing/billing-operational-notices";
import { cn } from "@/lib/utils";

const toneStyles: Record<BillingOperationalNotice["tone"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  critical:
    "border-destructive/40 bg-destructive/5 text-destructive dark:text-destructive-foreground",
};

export function BillingOperationalNoticesPanel({
  notices,
}: {
  notices: BillingOperationalNotice[];
}) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3"
      data-testid="billing-operational-notices"
    >
      {notices.map((notice) => (
        <p
          key={notice.testId}
          data-testid={notice.testId}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            toneStyles[notice.tone],
          )}
        >
          <span className="font-medium text-foreground">{notice.title}</span>
          {" — "}
          {notice.body}
        </p>
      ))}
    </div>
  );
}
