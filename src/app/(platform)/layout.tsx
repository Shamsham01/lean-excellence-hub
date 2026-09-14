import { PlatformShell } from "@/components/platform/platform-shell";
import { loadPlatformWorkspaceContext } from "@/modules/platform-shell/workspace-context";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { current, organisations, siteContext } =
    await loadPlatformWorkspaceContext();

  return (
    <PlatformShell
      organisationName={current.organisation_name}
      organisations={organisations}
      siteContext={siteContext}
      membershipId={current.membership_id}
    >
      {children}
    </PlatformShell>
  );
}
