import type { ReactNode } from "react";

import { LeanAiAssistantShell } from "@/components/leanai/leanai-assistant-shell";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { loadPlatformShellMember } from "@/modules/platform-shell/member-context";
import { settingsNavigationItem } from "@/modules/platform-shell/navigation";
import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import type { EligibleOrganisation } from "@/modules/organisations/context";
import type { ActiveSiteContext } from "@/modules/organisation/site-context";

type PlatformShellProps = {
  children: ReactNode;
  organisationName: string;
  organisationId: string;
  organisations: EligibleOrganisation[];
  siteContext: ActiveSiteContext;
  membershipId: string;
};

export async function PlatformShell({
  children,
  organisationName,
  organisationId,
  organisations,
  siteContext,
  membershipId,
}: PlatformShellProps) {
  const [navWithSetup, member] = await Promise.all([
    buildVisibleNavigation(),
    loadPlatformShellMember(membershipId),
  ]);

  const showSettings =
    settingsNavigationItem.universalAccess === true &&
    !navWithSetup.some((item) => item.href === settingsNavigationItem.href);

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background lg:h-dvh lg:flex-row lg:overflow-hidden">
      <PlatformSidebar
        items={navWithSetup}
        organisationName={organisationName}
        organisations={organisations}
        siteContext={siteContext}
        member={member}
        showSettings={showSettings}
      />
      <LeanAiAssistantShell organisationId={organisationId}>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </LeanAiAssistantShell>
    </div>
  );
}
