import type { ReactNode } from "react";

import { LeanAiAssistantShell } from "@/components/leanai/leanai-assistant-shell";
import { PlatformDesktopMainChrome } from "@/components/platform/platform-desktop-main-chrome";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { settingsNavigationItem } from "@/modules/platform-shell/navigation";
import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import type { PlatformShellMember } from "@/modules/platform-shell/member-context";

type PlatformShellProps = {
  children: ReactNode;
  organisationName: string;
  organisationId: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
  membershipId: string;
  member: PlatformShellMember;
};

export async function PlatformShell({
  children,
  organisationName,
  organisationId,
  organisations,
  siteContext,
  membershipId,
  member,
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
        membershipId={membershipId}
        member={member}
        showSettings={showSettings}
      />
      <LeanAiAssistantShell organisationId={organisationId}>
        <main
          data-testid="platform-main"
          className="platform-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:overflow-y-auto lg:overscroll-y-contain"
        >
          <PlatformDesktopMainChrome />
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </LeanAiAssistantShell>
    </div>
  );
}
