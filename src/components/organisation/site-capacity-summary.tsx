import { AppLink } from "@/components/ui/app-link";
import { ADD_SITE_CAPACITY_HREF } from "@/modules/billing/site-capacity-increase";
import {
  formatRemainingSiteSlots,
  formatSubscribedSitesActive,
  type SiteCapacityView,
} from "@/modules/billing/site-capacity";

export function SiteCapacitySummary({
  capacity,
}: {
  capacity: SiteCapacityView;
}) {
  const remaining = formatRemainingSiteSlots(capacity.remainingSlots);
  const exhausted = capacity.enforced && capacity.remainingSlots === 0;

  return (
    <section
      className="rounded-md border border-border/70 bg-surface px-4 py-3"
      data-testid="site-capacity-summary"
    >
      <h2 className="text-xs font-medium text-muted-foreground">Sites</h2>
      {capacity.enforced && capacity.subscribedLimit !== null ? (
        <>
          <p
            className="mt-1 text-sm font-medium text-foreground"
            data-testid="site-capacity-headline"
          >
            {formatSubscribedSitesActive(
              capacity.activeSiteCount,
              capacity.subscribedLimit,
            )}
          </p>
          {remaining ? (
            <p
              className="mt-1 text-sm text-muted-foreground"
              data-testid="site-capacity-remaining"
            >
              {remaining}
            </p>
          ) : null}
          {exhausted ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {capacity.canManageBilling ? (
                <>
                  Additional sites require subscribed capacity.{" "}
                  <AppLink
                    href={ADD_SITE_CAPACITY_HREF}
                    className="font-medium text-foreground underline underline-offset-2"
                    data-testid="site-capacity-summary-billing"
                  >
                    Add site capacity
                  </AppLink>
                  . Purchasing capacity does not create the site.
                </>
              ) : (
                "Ask your organisation billing administrator to increase capacity before activating another site."
              )}
            </p>
          ) : null}
        </>
      ) : (
        <p
          className="mt-1 text-sm text-foreground"
          data-testid="site-capacity-headline"
        >
          {capacity.activeSiteCount === 1
            ? "1 active site"
            : `${capacity.activeSiteCount} active sites`}
        </p>
      )}
    </section>
  );
}
