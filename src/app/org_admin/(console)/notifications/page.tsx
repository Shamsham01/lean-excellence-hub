import type { Metadata } from "next";

import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { loadPlatformNotificationHistory } from "@/modules/platform-admin/data";
import { parseHistoryPage } from "@/modules/platform-admin/directory-query";
import { formatLondon } from "@/modules/platform-admin/format";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readRequestPathname } from "@/platform/http/request-path";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function PlatformNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = parseHistoryPage((await searchParams).page);
  const access = await resolvePlatformConsoleAccess();
  if (access.kind !== "allowed") {
    return null;
  }
  const history = await loadPlatformNotificationHistory({
    limit: query.limit,
    offset: query.offset,
    requestPath: await readRequestPathname(),
    userId: access.userId,
  });
  const pageCount = Math.max(1, Math.ceil(history.total / history.limit));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Operator notifications</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Delivery is {history.delivery_enabled ? "enabled" : "disabled"} to{" "}
          {history.recipient_email}. Events are queued when a founder confirms,
          an organisation is founded, or a verified Stripe subscription changes.
          A Checkout redirect does not create these events.
        </p>
      </div>
      {history.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No notification events yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {history.rows.map((row) => (
            <li className="flex flex-col gap-2 py-4" key={row.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{row.event_kind}</h3>
                  <Badge variant={statusVariant(row.status)}>
                    {row.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatLondon(row.created_at)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {row.organisation_name ?? "No organisation"} · attempt{" "}
                {row.attempt_count}
                {row.sent_at ? ` · sent ${formatLondon(row.sent_at)}` : ""}
                {row.next_attempt_at && row.status !== "sent"
                  ? ` · next ${formatLondon(row.next_attempt_at)}`
                  : ""}
              </p>
              {row.last_error ? (
                <p className="text-sm text-destructive">
                  Failure: {row.last_error}
                </p>
              ) : null}
              {row.suppressed_reason ? (
                <p className="text-sm text-muted-foreground">
                  Suppressed: {row.suppressed_reason}
                </p>
              ) : null}
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                {payloadEntries(row.payload).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-muted-foreground">{key}</dt>
                    <dd className="break-all">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
      <nav
        aria-label="Notification pages"
        className="flex items-center gap-3 text-sm"
      >
        {query.page > 1 ? (
          <AppLink href={historyHref(query.page - 1)}>Previous</AppLink>
        ) : (
          <span className="text-muted-foreground">Previous</span>
        )}
        <span className="tabular-nums">
          Page {query.page} of {pageCount}
        </span>
        {query.page < pageCount ? (
          <AppLink href={historyHref(query.page + 1)}>Next</AppLink>
        ) : (
          <span className="text-muted-foreground">Next</span>
        )}
      </nav>
    </div>
  );
}

function historyHref(page: number) {
  return page > 1
    ? `/org_admin/notifications?page=${page}`
    : "/org_admin/notifications";
}

function statusVariant(status: string) {
  if (status === "sent") {
    return "success" as const;
  }
  if (status === "failed") {
    return "destructive" as const;
  }
  if (status === "suppressed") {
    return "warning" as const;
  }
  if (status === "processing") {
    return "information" as const;
  }
  return "secondary" as const;
}

function payloadEntries(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value),
    )
    .slice(0, 12)
    .map(([key, value]) => [key, String(value)] as const);
}
