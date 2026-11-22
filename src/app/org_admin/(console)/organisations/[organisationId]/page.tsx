import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { loadPlatformOrganisationDetail } from "@/modules/platform-admin/data";
import { isOrganisationId } from "@/modules/platform-admin/directory-query";
import { formatLondon, stripeModeLabel } from "@/modules/platform-admin/format";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readRequestPathname } from "@/platform/http/request-path";

export const metadata: Metadata = {
  title: "Organisation",
};

export default async function PlatformOrganisationPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!isOrganisationId(organisationId)) {
    notFound();
  }
  const access = await resolvePlatformConsoleAccess();
  if (access.kind !== "allowed") {
    return null;
  }
  const detail = await loadPlatformOrganisationDetail({
    organisationId,
    requestPath: await readRequestPathname(),
    userId: access.userId,
  });
  if (!detail.found || !detail.organisation || !detail.access) {
    notFound();
  }
  const organisation = detail.organisation;
  const billing = detail.billing;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm">
          <AppLink
            className="text-muted-foreground underline-offset-4 hover:underline"
            href="/org_admin/organisations"
          >
            Organisations
          </AppLink>
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{organisation.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {organisation.code}
          {organisation.country_code ? ` · ${organisation.country_code}` : ""}
          {" · "}
          {organisation.time_zone}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{organisation.status}</Badge>
          <Badge
            variant={detail.access.verified_customer ? "success" : "warning"}
          >
            {detail.access.verified_customer
              ? "Verified customer"
              : "Not a verified customer"}
          </Badge>
          <Badge
            variant={
              billing?.stripe_livemode === true ? "warning" : "information"
            }
          >
            {stripeModeLabel(billing?.stripe_livemode)}
          </Badge>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-base font-semibold">Owner and access</h3>
          <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Owner</dt>
            <dd>{organisation.owner_display_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{organisation.owner_email ?? "—"}</dd>
            <dt className="text-muted-foreground">Onboarding</dt>
            <dd>
              {detail.access.onboarding_required ? "Required" : "Complete"}
            </dd>
            <dt className="text-muted-foreground">Checkout</dt>
            <dd>{detail.access.checkout_open ? "Open" : "Not open"}</dd>
            <dt className="text-muted-foreground">Billing state</dt>
            <dd>{detail.access.billing_state ?? "None"}</dd>
            <dt className="text-muted-foreground">Founded</dt>
            <dd>{formatLondon(organisation.created_at)}</dd>
            <dt className="text-muted-foreground">Status changed</dt>
            <dd>{formatLondon(organisation.status_changed_at)}</dd>
          </dl>
        </div>
        <div>
          <h3 className="text-base font-semibold">Subscription</h3>
          <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Provider</dt>
            <dd>{billing?.subscription_provider ?? "None"}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd>
              {billing?.plan_code ?? "—"}
              {billing?.billing_interval
                ? ` · ${billing.billing_interval}`
                : ""}
            </dd>
            <dt className="text-muted-foreground">Subscribed sites</dt>
            <dd>{billing?.site_quantity ?? "—"}</dd>
            <dt className="text-muted-foreground">Period</dt>
            <dd>
              {formatLondon(billing?.current_period_start)} –{" "}
              {formatLondon(billing?.current_period_end)}
            </dd>
            <dt className="text-muted-foreground">Cancel at period end</dt>
            <dd>{billing?.cancel_at_period_end ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Grace</dt>
            <dd>{formatLondon(billing?.grace_expires_at)}</dd>
            <dt className="text-muted-foreground">Stripe customer</dt>
            <dd className="break-all">
              {billing?.provider_customer_id ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Stripe subscription</dt>
            <dd className="break-all">
              {billing?.provider_subscription_id ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Mode observed</dt>
            <dd>{formatLondon(billing?.stripe_mode_observed_at)}</dd>
          </dl>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold">Sites</h3>
        {(detail.sites ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No sites recorded.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {(detail.sites ?? []).map((site) => (
              <li className="flex justify-between gap-3 py-2" key={site.id}>
                <span>
                  {site.name}{" "}
                  <span className="text-muted-foreground">{site.code}</span>
                </span>
                <span>{site.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EventList
        empty="No billing events recorded."
        rows={(detail.webhooks ?? []).map((webhook) => ({
          detail: webhook.last_error,
          id: webhook.provider_event_id,
          meta: `${webhook.provider} · ${webhook.processing_state}`,
          title: webhook.event_type,
          when: formatLondon(webhook.received_at),
        }))}
        title="Billing events"
      />
      <EventList
        empty="No operator notifications for this organisation."
        rows={(detail.notifications ?? []).map((notification) => ({
          detail: notification.last_error ?? notification.suppressed_reason,
          id: notification.id,
          meta: `${notification.status} · attempt ${notification.attempt_count}`,
          title: notification.event_kind,
          when: formatLondon(notification.created_at),
        }))}
        title="Notification outbox"
      />
      <EventList
        empty="No organisation security events in the recent window."
        rows={(detail.security_events ?? []).map((event) => ({
          detail: null,
          id: `${event.occurred_at}-${event.action}`,
          meta: event.outcome,
          title: event.action,
          when: formatLondon(event.occurred_at),
        }))}
        title="Access status"
      />
    </div>
  );
}

function EventList({
  empty,
  rows,
  title,
}: {
  empty: string;
  rows: Array<{
    detail: string | null;
    id: string;
    meta: string;
    title: string;
    when: string;
  }>;
  title: string;
}) {
  return (
    <section>
      <h3 className="text-base font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {rows.map((row) => (
            <li className="py-2" key={row.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{row.title}</span>
                <span className="text-muted-foreground">{row.when}</span>
              </div>
              <p className="text-muted-foreground">{row.meta}</p>
              {row.detail ? <p className="mt-1">{row.detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
