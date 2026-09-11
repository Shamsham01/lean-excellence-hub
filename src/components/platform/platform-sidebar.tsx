import { MobilePlatformNavigation } from "@/components/platform/mobile-platform-navigation";
import { PlatformNavigation } from "@/components/platform/platform-navigation";
import { PlatformSidebarFooter } from "@/components/platform/platform-sidebar-footer";
import { PlatformSidebarHeader } from "@/components/platform/platform-sidebar-header";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import type { PlatformNavItem } from "@/modules/platform-shell/navigation";

type PlatformSidebarProps = {
  items: PlatformNavItem[];
  organisationName: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
  member: PlatformShellMember;
  showSettings: boolean;
};

function DesktopSidebar({
  items,
  organisationName,
  organisations,
  siteContext,
  member,
  showSettings,
}: PlatformSidebarProps) {
  return (
    <aside className="hidden h-dvh min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex">
      <PlatformSidebarHeader
        organisationName={organisationName}
        organisations={organisations}
        siteContext={siteContext}
      />
      <PlatformNavigation items={items} />
      <PlatformSidebarFooter member={member} showSettings={showSettings} />
    </aside>
  );
}

export function PlatformSidebar(props: PlatformSidebarProps) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobilePlatformNavigation {...props} />
    </>
  );
}
