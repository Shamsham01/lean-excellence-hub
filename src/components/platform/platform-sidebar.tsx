import { MobilePlatformNavigation } from "@/components/platform/mobile-platform-navigation";
import { PlatformNavigation } from "@/components/platform/platform-navigation";
import { PlatformSidebarFooter } from "@/components/platform/platform-sidebar-footer";
import { PlatformSidebarHeader } from "@/components/platform/platform-sidebar-header";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";
import type { PlatformNavItem } from "@/modules/platform-shell/navigation";

type PlatformSidebarProps = {
  items: PlatformNavItem[];
  organisationName: string;
  organisations: EligibleOrganisation[];
  member: PlatformShellMember;
  showSettings: boolean;
};

function DesktopSidebar({
  items,
  organisationName,
  organisations,
  member,
  showSettings,
}: PlatformSidebarProps) {
  return (
    <aside className="hidden h-dvh w-56 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <PlatformSidebarHeader
        organisationName={organisationName}
        organisations={organisations}
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
