import { MobilePlatformNavigation } from "@/components/platform/mobile-platform-navigation";
import { PlatformNavigation } from "@/components/platform/platform-navigation";
import { PlatformSidebarFooter } from "@/components/platform/platform-sidebar-footer";
import { PlatformSidebarHeader } from "@/components/platform/platform-sidebar-header";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { PlatformNavItem } from "@/modules/platform-shell/navigation";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";

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
    <aside
      data-testid="platform-desktop-sidebar"
      className="hidden h-dvh min-h-0 w-[290px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:max-h-dvh lg:self-start"
    >
      <PlatformSidebarHeader
        organisationName={organisationName}
        organisations={organisations}
        siteContext={siteContext}
      />
      <div
        className="sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
        role="navigation"
        aria-label="Platform"
      >
        <PlatformNavigation items={items} />
        <PlatformSidebarFooter member={member} showSettings={showSettings} />
      </div>
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
