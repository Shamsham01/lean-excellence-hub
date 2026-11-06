import { PlatformShell } from "@/components/platform/platform-shell";
import { loadPlatformShellMember } from "@/modules/platform-shell/member-context";
import { loadPlatformWorkspaceContext } from "@/modules/platform-shell/workspace-context";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { current, organisations, siteContext } =
    await loadPlatformWorkspaceContext();
  const member = await loadPlatformShellMember(current.membership_id);

  return (
    <PlatformShell
      organisationName={current.organisation_name}
      organisationId={current.organisation_id}
      organisations={organisations}
      siteContext={siteContext}
      membershipId={current.membership_id}
      member={member}
    >
      {children}
    </PlatformShell>
  );
}
