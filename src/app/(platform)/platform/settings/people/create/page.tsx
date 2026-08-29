import Link from "next/link";

import { CreateWorkforceUserForm } from "@/components/people/create-workforce-user-form";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  currentMemberHasDelegatableAccess,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { createWorkforceUser } from "./actions";

export default async function CreateWorkforceUserPage() {
  const canProvision = await currentMemberHasPermission("workforce.provision");
  const canDelegateAccess = await currentMemberHasDelegatableAccess();
  const canManageJobFunctions = await currentMemberHasPermission(
    "job_functions.manage",
  );

  const supabase = await createServerSupabaseClient();

  const [{ data: offersData }, { data: units }, { data: jobFunctions }] =
    await Promise.all([
      canDelegateAccess
        ? supabase.rpc("get_delegatable_access_offers")
        : Promise.resolve({ data: null }),
      canProvision || canManageJobFunctions
        ? supabase
            .from("organisation_units")
            .select("id, name, code, parent_unit_id")
            .eq("status", "active")
            .order("name")
        : Promise.resolve({ data: [] }),
      canProvision
        ? supabase
            .from("job_functions")
            .select("id, name, code")
            .eq("status", "active")
            .order("name")
        : Promise.resolve({ data: [] }),
    ]);

  const offers = ((offersData as { offers?: DelegatableAccessOffer[] } | null)
    ?.offers ?? []) as DelegatableAccessOffer[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create workforce user"
        description="Add an employee with a system-generated temporary password for workforce sign-in."
        actions={
          <Button variant="outline" asChild>
            <Link href="/platform/settings/people">
              Back to people settings
            </Link>
          </Button>
        }
      />

      {!canProvision ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You do not have permission to create workforce users.
          </CardContent>
        </Card>
      ) : !canDelegateAccess ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You need delegatable access authority before you can assign an
            application role during workforce provisioning.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Employee details</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateWorkforceUserForm
              offers={offers}
              units={units ?? []}
              jobFunctions={jobFunctions ?? []}
              onCreate={createWorkforceUser}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
