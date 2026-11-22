import { PlatformShell } from "@/components/platform/platform-shell";
import { loadPlatformShellMember } from "@/modules/platform-shell/member-context";
import { loadPlatformNotificationSnapshot } from "@/modules/platform-shell/notifications";
import { loadPlatformWorkspaceContext } from "@/modules/platform-shell/workspace-context";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { current, organisations, siteContext } =
    await loadPlatformWorkspaceContext();
  const [member, notifications] = await Promise.all([
    loadPlatformShellMember(current.membership_id),
    loadPlatformNotificationSnapshot(current.membership_id),
  ]);

  return (
    <PlatformShell
      organisationName={current.organisation_name}
      organisationId={current.organisation_id}
      organisations={organisations}
      siteContext={siteContext}
      member={member}
      notifications={notifications}
    >
      {children}
    </PlatformShell>
  );
}
