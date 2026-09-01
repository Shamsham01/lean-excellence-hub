import Link from "next/link";

import type { EligibleOrganisation } from "@/modules/organisations/context";

type PlatformSidebarHeaderProps = {
  organisationName: string;
  organisations: EligibleOrganisation[];
};

export function PlatformSidebarHeader({
  organisationName,
  organisations,
}: PlatformSidebarHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-sidebar-border p-4">
      <p className="typography-product-identity">Lean Excellence Hub</p>
      <div className="min-w-0">
        <p
          className="truncate text-sm font-semibold text-sidebar-foreground"
          data-testid="platform-org-name"
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
    </div>
  );
}
