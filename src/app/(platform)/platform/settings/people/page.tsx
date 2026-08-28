import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function PeopleSettingsPage() {
  const canManageInvitations =
    await currentMemberHasPermission("invitations.manage");

  const supabase = await createServerSupabaseClient();
  const { data: pendingInvitations, error } = canManageInvitations
    ? await supabase
        .from("organisation_invitations")
        .select("id, status, canonical_recipient, expires_at")
        .eq("status", "pending")
        .order("expires_at", { ascending: true })
    : { data: null, error: null };

  return (
    <div className="flex flex-col gap-8" data-testid="people-settings-page">
      <PageHeader
        title="People and invitations"
        description="Bring colleagues into your organisation with the right access."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team invitations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            Issuing invitations requires selecting a role version and scope that
            your authority can safely delegate. A guided invitation workflow is
            planned for a future release once a safe delegation picker API is
            available.
          </p>
          <p>
            Until then, contact your platform administrator or use approved
            provisioning tools to invite colleagues.
          </p>
          {!canManageInvitations ? (
            <p>
              Ask an Organisation Administrator to manage invitations for this
              organisation.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canManageInvitations ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-muted-foreground">
                Unable to load pending invitations.
              </p>
            ) : pendingInvitations?.length ? (
              <ul className="flex flex-col gap-2">
                {pendingInvitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {invitation.canonical_recipient}
                    </p>
                    <p className="text-muted-foreground">
                      Expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString(
                        "en-GB",
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending invitations.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/people">Open people directory</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
