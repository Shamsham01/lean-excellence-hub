import type { Metadata } from "next";

import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { loadPlatformOverview } from "@/modules/platform-admin/data";
import { formatLondon, stripeModeLabel } from "@/modules/platform-admin/format";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readPlatformBillingRuntime } from "@/modules/platform-admin/runtime";
import { readRequestPathname } from "@/platform/http/request-path";

export const metadata: Metadata = {
  title: "Platform owner",
};

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-b border-border py-3 sm:border-b-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default async function PlatformOverviewPage() {
  const requestPath = await readRequestPathname();
  const access = await resolvePlatformConsoleAccess();
  if (access.kind !== "allowed") {
    return null;
  }
  const overview = await loadPlatformOverview({
    requestPath,
    userId: access.userId,
  });
  const runtime = readPlatformBillingRuntime();
  const secretMode =
    runtime.stripeSecretMode === "live"
      ? "Stripe live key configured"
      : runtime.stripeSecretMode === "test"
        ? "Stripe test key configured"
        : runtime.stripeSecretMode === "absent"
          ? "No Stripe secret configured"
          : "Stripe secret unrecognised";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Verified customers</h2>
          <Badge
            variant={
              runtime.stripeSecretMode === "live" ? "warning" : "information"
            }
          >
            {secretMode}
          </Badge>
          <Badge variant="outline">
            Billing provider {runtime.billingProvider}
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A verified customer has a Stripe subscription in trialing, active,
          past due, or scheduled to cancel. Organisation status and Checkout
          redirects do not count. Observed mode comes from signature-verified
          Stripe events.
        </p>
        <dl className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Verified customers"
            value={overview.verified_customers}
          />
          <Metric
            label="Stripe live"
            value={overview.verified_customers_live_mode}
          />
          <Metric
            label="Stripe test"
            value={overview.verified_customers_test_mode}
          />
          <Metric
            label="Mode not observed"
            value={overview.verified_customers_mode_unknown}
          />
        </dl>
        <p className="text-sm text-muted-foreground">
          Self-service checkout in this deployment:{" "}
          {runtime.selfServiceCheckout === "stripe"
            ? "Stripe"
            : "not in this environment"}
          . Subscribed site capacity across verified customers:{" "}
          {overview.subscribed_site_capacity}. Active operational sites:{" "}
          {overview.active_sites}.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Identities and organisations</h2>
        <dl className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Registered users"
            value={overview.registered_identities}
          />
          <Metric
            label="Confirmed users"
            value={overview.confirmed_identities}
          />
          <Metric
            label="Confirmed founders"
            value={overview.confirmed_founders}
          />
          <Metric
            label="Unconfirmed founder bindings"
            value={overview.unconfirmed_founder_bindings}
          />
          <Metric
            label="Provisioning"
            value={overview.organisations.provisioning}
          />
          <Metric label="Active" value={overview.organisations.active} />
          <Metric label="Suspended" value={overview.organisations.suspended} />
          <Metric label="Closed" value={overview.organisations.closed} />
        </dl>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <AttentionList
          count={overview.attention.no_subscription_count}
          rows={overview.attention.no_subscription}
          title="No verified subscription"
        />
        <AttentionList
          count={overview.attention.incomplete_onboarding_count}
          rows={overview.attention.incomplete_onboarding}
          title="Incomplete onboarding"
        />
        <AttentionList
          count={overview.attention.failed_billing_count}
          rows={overview.attention.failed_billing}
          title="Failed billing"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Subscription plans</h2>
        {overview.plans.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No verified Stripe subscriptions yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-medium" scope="col">
                    Plan
                  </th>
                  <th className="py-2 pr-3 font-medium" scope="col">
                    Interval
                  </th>
                  <th className="py-2 pr-3 font-medium" scope="col">
                    Organisations
                  </th>
                  <th className="py-2 pr-3 font-medium" scope="col">
                    Subscribed sites
                  </th>
                  <th className="py-2 font-medium" scope="col">
                    Earliest renewal
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.plans.map((plan) => (
                  <tr
                    className="border-b border-border"
                    key={`${plan.plan_code}-${plan.billing_interval}`}
                  >
                    <th className="py-2 pr-3 text-left font-medium" scope="row">
                      {plan.plan_code}
                    </th>
                    <td className="py-2 pr-3">{plan.billing_interval}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {plan.organisations}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {plan.subscribed_sites}
                    </td>
                    <td className="py-2">
                      {formatLondon(plan.earliest_period_end)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Operator notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Delivery is{" "}
          {overview.notification_delivery_enabled ? "enabled" : "disabled"} for{" "}
          {overview.notification_recipient}. Queued events stay in the outbox
          until delivery is enabled.
        </p>
        <p className="mt-2">
          <AppLink
            className="text-sm underline-offset-4 hover:underline"
            href="/org_admin/notifications"
          >
            Notification history
          </AppLink>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recent console access</h2>
        {overview.recent_access.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No access events yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {overview.recent_access.map((event) => (
              <li
                className="flex flex-wrap justify-between gap-2 py-2"
                key={`${event.occurred_at}-${event.action}-${event.outcome}`}
              >
                <span>
                  {event.action} · {event.outcome}
                  {event.request_path ? ` · ${event.request_path}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {formatLondon(event.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {stripeModeLabel(null)} is shown per organisation when a verified
          Stripe event has not recorded a mode.
        </p>
      </section>
    </div>
  );
}

function AttentionList({
  count,
  rows,
  title,
}: {
  count: number;
  rows: Array<{
    code: string;
    id: string;
    name: string;
    status: string;
  }>;
  title: string;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold">
        {title}{" "}
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <li key={`${title}-${row.id}`}>
              <AppLink
                className="underline-offset-4 hover:underline"
                href={`/org_admin/organisations/${row.id}`}
              >
                {row.name}
              </AppLink>
              <span className="text-muted-foreground">
                {" "}
                · {row.code} · {row.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
