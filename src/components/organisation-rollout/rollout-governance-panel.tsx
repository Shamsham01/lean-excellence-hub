import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  formatRemainingSiteSlots,
  formatSubscribedSitesActive,
} from "@/modules/billing/site-capacity";
import { ADD_SITE_CAPACITY_HREF } from "@/modules/billing/site-capacity-increase";
import {
  siteLeadershipLabel,
  siteReadinessLabel,
  type OrganisationGovernanceSnapshot,
} from "@/modules/organisation-rollout/governance";
import { MULTI_SITE_INTENT_LABELS } from "@/modules/organisation-rollout/multi-site-intent";

export function RolloutGovernancePanel({
  snapshot,
}: {
  snapshot: OrganisationGovernanceSnapshot;
}) {
  const capacity = snapshot.siteCapacity;
  const exhausted =
    capacity?.enforced === true && capacity.remainingSlots === 0;
  const capacityHeadline =
    capacity?.enforced && capacity.subscribedLimit !== null
      ? formatSubscribedSitesActive(
          capacity.activeSiteCount,
          capacity.subscribedLimit,
        )
      : snapshot.activeSiteCount === 1
        ? "1 active site"
        : `${snapshot.activeSiteCount} active sites`;

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="rollout-governance-panel"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GovernanceStat
          label="Organisation"
          value={snapshot.organisationName}
        />
        <GovernanceStat
          label="Sites"
          value={
            snapshot.activeSiteCount === 1
              ? "1 active"
              : `${snapshot.activeSiteCount} active`
          }
        />
        <GovernanceStat
          label="Subscribed capacity"
          value={capacityHeadline}
          testId="rollout-capacity-headline"
        />
        <GovernanceStat
          label="Rollout state"
          value={snapshot.rolloutStateLabel}
          testId="rollout-state"
        />
      </div>

      <p className="max-w-3xl text-sm text-muted-foreground">
        {snapshot.rolloutStateDescription}{" "}
        {MULTI_SITE_INTENT_LABELS[snapshot.multiSiteIntent]}.
      </p>
      {capacity ? (
        <p className="text-sm text-muted-foreground">
          {formatRemainingSiteSlots(capacity.remainingSlots)}
        </p>
      ) : null}

      {snapshot.sites.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="rollout-empty"
        >
          No sites are recorded yet. Create the first site during organisation
          setup.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Sites in this organisation</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Site</th>
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium">Capacity</th>
                <th className="py-2 pr-4 font-medium">Local access</th>
                <th className="py-2 font-medium">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sites.map((site) => (
                <tr
                  key={site.id}
                  className="border-b border-border/70"
                  data-testid={`rollout-site-row-${site.id}`}
                >
                  <td className="py-3 pr-4 font-medium text-foreground">
                    {site.name}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground capitalize">
                    {site.status}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {site.consumesCapacity ? "Uses a site slot" : "Not billed"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {siteLeadershipLabel(site.leadership)}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {siteReadinessLabel(site.readiness)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {snapshot.canManageHierarchy ? (
          <Button asChild className="min-h-11">
            <AppLink
              href="/platform/settings/organisation/rollout"
              data-testid="roll-out-another-site"
            >
              Roll out another site
            </AppLink>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask an authorised hierarchy administrator to roll out another site.
          </p>
        )}
        {exhausted && snapshot.canManageBilling ? (
          <Button variant="outline" asChild className="min-h-11">
            <AppLink
              href={ADD_SITE_CAPACITY_HREF}
              data-testid="rollout-add-capacity"
            >
              Add site capacity
            </AppLink>
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Organisation ownership stays with the current organisation owner.
        Transferring ownership is a separate, security-sensitive change and is
        not available in this flow.
      </p>
    </section>
  );
}

function GovernanceStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-sm font-medium text-foreground"
        {...(testId ? { "data-testid": testId } : {})}
      >
        {value}
      </p>
    </div>
  );
}
