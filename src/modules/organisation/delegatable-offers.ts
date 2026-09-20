import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import {
  collectDescendantUnitIds,
  type FlatOrganisationUnit,
} from "@/modules/organisation/unit-hierarchy";

export function filterDelegatableOffersForActiveSite(
  offers: DelegatableAccessOffer[],
  units: FlatOrganisationUnit[],
  context: ActiveSiteContext,
): DelegatableAccessOffer[] {
  if (context.mode !== "site" || !context.activeSiteId) {
    return offers;
  }

  const visibleUnitIds = collectDescendantUnitIds(units, context.activeSiteId);

  return offers
    .map((offer) => ({
      ...offer,
      scope_options: offer.scope_options.filter((scope) => {
        if (scope.scope_type === "organisation") {
          return true;
        }
        if (!scope.scope_unit_id) {
          return false;
        }
        return visibleUnitIds.has(scope.scope_unit_id);
      }),
    }))
    .filter((offer) => offer.scope_options.length > 0);
}
