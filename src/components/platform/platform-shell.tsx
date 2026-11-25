import { Suspense, type ReactNode } from "react";

import { LeanAiAssistantShell } from "@/components/leanai/leanai-assistant-shell";
import { MobilePlatformNavigation } from "@/components/platform/mobile-platform-navigation";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformNotificationBell } from "@/components/platform/platform-notification-bell";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import { settingsNavigationItem } from "@/modules/platform-shell/navigation";
import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import type { PlatformNotificationSnapshot } from "@/modules/platform-shell/notifications";
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
  notifications: PlatformNotificationSnapshot | null;
  notificationsPromise?: Promise<PlatformNotificationSnapshot | null>;
};

export async function PlatformShell({
  children,
  organisationName,
  organisationId,
  organisations,
  siteContext,
  member,
  notifications,
  notificationsPromise,
}: PlatformShellProps) {
  const navWithSetup = await buildVisibleNavigation();

  const showSettings =
    settingsNavigationItem.universalAccess === true &&
    !navWithSetup.some((item) => item.href === settingsNavigationItem.href);

  const notificationSlot = notificationsPromise ? (
    <Suspense fallback={null}>
      <DeferredNotificationBell snapshot={notificationsPromise} />
    </Suspense>
  ) : undefined;

  return (
    <div
      data-testid="platform-shell"
      className="flex h-dvh max-h-dvh min-w-0 flex-col overflow-hidden bg-background lg:flex-row"
    >
      <PlatformSidebar
        items={navWithSetup}
        organisationName={organisationName}
        organisations={organisations}
        siteContext={siteContext}
        member={member}
        showSettings={showSettings}
      />
      <LeanAiAssistantShell organisationId={organisationId}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background lg:ml-[290px]">
          <MobilePlatformNavigation
            items={navWithSetup}
            organisationName={organisationName}
            organisations={organisations}
            siteContext={siteContext}
            member={member}
            showSettings={showSettings}
            notifications={notifications}
            notificationSlot={notificationSlot}
          />
          <PlatformTopbar
            member={member}
            organisationName={organisationName}
            showSettings={showSettings}
            notifications={notifications}
            notificationSlot={notificationSlot}
          />
          <main
            data-testid="platform-main"
            className="platform-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden"
          >
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

async function DeferredNotificationBell({
  snapshot,
}: {
  snapshot: Promise<PlatformNotificationSnapshot | null>;
}) {
  const notifications = await snapshot;
  return notifications ? (
    <PlatformNotificationBell
      initialUnreadCount={notifications.unreadCount}
      initialItems={notifications.items}
    />
  ) : null;
}
