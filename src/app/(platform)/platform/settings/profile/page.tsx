import Link from "next/link";

import { ProfileDisplayNameForm } from "@/components/profile/profile-display-name-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { updateProfileDisplayName } from "./actions";

export default async function ProfileSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;

  const { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-8" data-testid="profile-settings-page">
      <PageHeader
        title="Your profile"
        description="Set how your name appears across Lean Excellence Hub."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display name</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileDisplayNameForm
            initialDisplayName={profile?.display_name ?? ""}
            onSave={updateProfileDisplayName}
          />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Organisation-specific job titles and membership display names require a
        membership profile administration capability that is not yet available
        in the product UI.
      </p>
    </div>
  );
}
