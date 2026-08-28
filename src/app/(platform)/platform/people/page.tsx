import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PeopleDirectoryPage() {
  const supabase = await createServerSupabaseClient();
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (o) => o.selected,
  )?.membership_id;
  const canManageMemberships =
    await currentMemberHasPermission("memberships.read");

  const { data: directory, error } = await supabase.rpc(
    "get_people_directory",
    {
      target_page: 1,
      target_page_size: 50,
    },
  );

  const directoryObj = directory as {
    people?: Array<{
      membership_id: string;
      display_name: string;
      job_function_name?: string;
    }>;
  } | null;

  const people = directoryObj?.people ?? [];
  const directoryDenied = error?.code === "42501";

  return (
    <div className="flex flex-col gap-8" data-testid="people-directory-page">
      <PageHeader
        title="People"
        description="Workforce capability directory — training compliance and skill coverage at a glance."
      />

      {directoryDenied && currentMembershipId ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Your access is limited to your own capability profile.
            </p>
            <Button asChild>
              <Link href="/platform/people/me">View my capability profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!directoryDenied ? (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {people.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No people found.
              </p>
            ) : (
              people.map((person) => (
                <div
                  key={person.membership_id}
                  className="flex min-h-11 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/platform/people/${person.membership_id}`}
                    className="flex flex-1 flex-col gap-0.5 hover:underline"
                  >
                    <span className="font-medium">{person.display_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {person.job_function_name ?? "No job function"}
                    </span>
                  </Link>
                  {canManageMemberships ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/platform/people/${person.membership_id}/admin`}
                      >
                        Manage
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
