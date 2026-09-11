import Link from "next/link";

import { SiteContextSwitcher } from "@/components/platform/site-context-switcher";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";

type PlatformSidebarHeaderProps = {
  organisationName: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
};

export function PlatformSidebarHeader({
  organisationName,
  organisations,
  siteContext,
}: PlatformSidebarHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-sidebar-border p-4">
      <p className="typography-product-identity">Lean Excellence Hub</p>
      <div className="min-w-0">
        <p
          className="truncate text-sm font-semibold text-sidebar-foreground"
          data-testid="platform-sidebar-org-name"
        >
          {organisationName}
        </p>
        {organisations.length > 1 ? (
          <Link
            href="/select-organisation"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Switch organisation
          </Link>
        ) : null}
      </div>
      <SiteContextSwitcher context={siteContext} />
    </div>
  );
}
