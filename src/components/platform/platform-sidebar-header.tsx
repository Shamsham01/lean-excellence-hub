import type { ReactNode } from "react";

import { LEH_BRAND } from "@/components/brand/brand-assets";
import { LehBrand } from "@/components/brand/leh-brand";
import { AppLink } from "@/components/ui/app-link";

import { SiteContextSwitcher } from "@/components/platform/site-context-switcher";
import { cn } from "@/lib/utils";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";

type PlatformSidebarHeaderProps = {
  organisationName: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
  closeGutter?: boolean;
  notificationsSlot?: ReactNode;
};

export function PlatformSidebarHeader({
  organisationName,
  organisations,
  siteContext,
  closeGutter = false,
  notificationsSlot,
}: PlatformSidebarHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 border-b border-sidebar-border px-3 pt-3 pb-4",
        closeGutter && "pr-12",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <AppLink
          href="/platform"
          aria-label={LEH_BRAND.name}
          className="leh-brand-link block w-full max-w-full min-w-0"
        >
          <LehBrand
            decorative
            variant="full"
            strapline={false}
            priority
            className="leh-brand--platform-sidebar w-full min-w-0"
          />
        </AppLink>
        {notificationsSlot}
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-sm font-semibold text-sidebar-foreground"
          data-testid="platform-sidebar-org-name"
        >
          {organisationName}
        </p>
        {organisations.length > 1 ? (
          <AppLink
            href="/select-organisation"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Switch organisation
          </AppLink>
        ) : null}
      </div>
      <SiteContextSwitcher context={siteContext} />
    </div>
  );
}
