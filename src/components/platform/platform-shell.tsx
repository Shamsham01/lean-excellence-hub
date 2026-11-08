import type { ReactNode } from "react";

import { LeanAiAssistantShell } from "@/components/leanai/leanai-assistant-shell";
import { MobilePlatformNavigation } from "@/components/platform/mobile-platform-navigation";
import { PlatformDesktopMainChrome } from "@/components/platform/platform-desktop-main-chrome";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import { settingsNavigationItem } from "@/modules/platform-shell/navigation";
import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";

type PlatformShellProps = {
  children: ReactNode;
  organisationName: string;
  organisationId: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
  member: PlatformShellMember;
  notifications: {
    unreadCount: number;
    items: PlatformInAppNotification[];
  } | null;
};

export async function PlatformShell({
  children,
  organisationName,
  organisationId,
  organisations,
  siteContext,
  member,
  notifications,
}: PlatformShellProps) {
  const navWithSetup = await buildVisibleNavigation();

  const showSettings =
    settingsNavigationItem.universalAccess === true &&
    !navWithSetup.some((item) => item.href === settingsNavigationItem.href);

  return (
    <div
      data-testid="platform-shell"
      className="flex min-h-dvh min-w-0 flex-col bg-background lg:h-dvh lg:max-h-dvh lg:flex-row lg:overflow-hidden"
    >
      <PlatformSidebar
        items={navWithSetup}
        organisationName={organisationName}
        organisations={organisations}
        siteContext={siteContext}
        member={member}
        showSettings={showSettings}
        notifications={notifications}
      />
      <LeanAiAssistantShell
        organisationId={organisationId}
        notifications={notifications}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background max-lg:min-h-dvh lg:ml-[290px] lg:overflow-hidden">
          <MobilePlatformNavigation
            items={navWithSetup}
            organisationName={organisationName}
            organisations={organisations}
            siteContext={siteContext}
            member={member}
            showSettings={showSettings}
            notifications={notifications}
          />
          <PlatformTopbar member={member} organisationName={organisationName} />
          <main
            data-testid="platform-main"
            className="platform-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden"
          >
            <PlatformDesktopMainChrome />
            <div className="platform-main-viewport flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
              <div className="platform-main-inner mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </LeanAiAssistantShell>
    </div>
  );
}
