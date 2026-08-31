import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function OrganisationSettingsPage() {
  if (!(await currentMemberHasPermission("hierarchy.read"))) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: organisation } = await supabase
    .from("organisations")
    .select("name, code, locale, time_zone, reporting_currency, status")
    .maybeSingle();

  if (!organisation) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Organisation"
          description="Organisation details are unavailable."
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="organisation-settings-page"
    >
      <PageHeader
        title="Organisation"
        description="Your organisation identity in Lean Excellence Hub."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/settings">Back to settings</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Name</p>
            <p className="text-sm text-foreground">{organisation.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Code</p>
            <p className="text-sm text-foreground">{organisation.code}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Locale</p>
            <p className="text-sm text-foreground">{organisation.locale}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Time zone
            </p>
            <p className="text-sm text-foreground">{organisation.time_zone}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Reporting currency
            </p>
            <p className="text-sm text-foreground">
              {organisation.reporting_currency}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <p className="text-sm text-foreground capitalize">
              {organisation.status}
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Organisation metadata editing will be available in a future release.
        Contact your platform administrator if details need to change.
      </p>
    </div>
  );
}
