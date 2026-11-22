import { PeopleDirectory } from "@/components/people/people-directory";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchPeopleDirectory } from "@/lib/people/fetch-people-directory";
import { parsePeopleDirectorySearchParams } from "@/lib/people/directory-query";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { loadAccessibleOrganisationUnits } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function PeopleDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createServerSupabaseClient();
  const organisations = await listEligibleOrganisations();
  const currentMembershipId = organisations.find(
    (o) => o.selected,
  )?.membership_id;
  const params = await searchParams;
  const filters = parsePeopleDirectorySearchParams(params);

  const [canManageMemberships, canIncludeInactive, canInvite, canDelegate] =
    await Promise.all([
      currentMemberHasPermission("memberships.read"),
      currentMemberHasPermission("memberships.manage"),
      currentMemberHasPermission("invitations.manage"),
      currentMemberHasPermission("roles.delegate"),
    ]);

  const canImportColleagues = canInvite && canDelegate;

  const { error, people, totalCount, page, pageSize } =
    await fetchPeopleDirectory(supabase, filters, {
      canIncludeInactive,
    });

  const units = canManageMemberships
    ? (await loadAccessibleOrganisationUnits()).map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
      }))
    : [];

  const directoryDenied = error?.code === "42501";
  const directoryFailed = Boolean(error) && !directoryDenied;

  return (
    <div className="flex flex-col gap-6" data-testid="people-directory-page">
      {directoryDenied && currentMembershipId ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Your access is limited to your own capability profile.
            </p>
            <Button asChild>
              <AppLink
                href="/platform/people/me"
                data-testid="people-own-profile-link"
              >
                View my capability profile
              </AppLink>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {directoryFailed ? (
        <Card>
          <CardContent className="p-6">
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="people-directory-load-error"
            >
              The people directory could not be loaded. This is not the same as
              an empty directory.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!directoryDenied && !directoryFailed ? (
        <PeopleDirectory
          people={people}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          filters={filters}
          units={units}
          canManageMemberships={canManageMemberships}
          canIncludeInactive={canIncludeInactive}
          canImportColleagues={canImportColleagues}
        />
      ) : null}
    </div>
  );
}
