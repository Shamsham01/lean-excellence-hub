import { GembaActiveWalkList } from "@/components/gemba/active-walk-list";
import { EmptyState } from "@/components/platform/empty-state";
import { OperationalCatalogTable } from "@/components/operational/operational-catalog-table";
import { ModulePageInsightsDeferred } from "@/components/platform/module-page-insights-deferred";
import { buildGembaOverviewCatalogRows } from "@/lib/operational/overview-catalog-rows";
import { PageHeader } from "@/components/platform/page-header";
import { parseAnalyticsRangeDays } from "@/modules/platform-analytics/date-range";
import { buildAnalyticsDateRangeForOrganisation } from "@/modules/platform-analytics/date-range.server";
import { ModuleReadError } from "@/components/workplace/module-read-error";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GEMBA_ACTIVE_WALK_LIVE_SELECT,
  mapActiveWalkRow,
} from "@/modules/operational/gemba-active-walks";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { presentCatalogRead } from "@/modules/workplace/access-decision";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Footprints } from "lucide-react";

export default async function GembaOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: GEMBA_PERMISSIONS.read,
    module: "gemba",
    title: "Gemba",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const analyticsRange = await buildAnalyticsDateRangeForOrganisation(
    parseAnalyticsRangeDays(params.range),
  );
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const { count: definitionCount, error: definitionCountError } = await supabase
    .from("gemba_definitions")
    .select("id", { count: "exact", head: true });
  const catalog = presentCatalogRead({
    failed: Boolean(definitionCountError),
    visibleCount: definitionCount ?? 0,
  });
  if (catalog === "failed") {
    return (
      <ModuleReadError
        title="Gemba walks"
        description="Structured walks with observations and follow-up."
        message="Gemba definitions could not be loaded. Refresh the page and try again."
        module="gemba"
      />
    );
  }
  const { data: definitions } = await supabase
    .from("gemba_definitions")
    .select("id, display_name")
    .order("created_at", { ascending: false })
    .limit(5);
  const { count: walkCount } = await supabase
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  const { count: activeWalkCount } = await supabase
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");
  const { data: activeWalkRows } = await supabase
    .from("gemba_walks")
    .select(GEMBA_ACTIVE_WALK_LIVE_SELECT)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(20);
  const activeWalks = (activeWalkRows ?? []).map(mapActiveWalkRow);
  const { count: observationCount } = await supabase
    .from("gemba_walk_observations")
    .select("id", { count: "exact", head: true });
  const catalogRows = await buildGembaOverviewCatalogRows(
    supabase,
    definitions ?? [],
  );

  if (catalog === "empty") {
    return (
      <div className="flex flex-col gap-8" data-testid="gemba-empty-state">
        <PageHeader title="Gemba walks" />
        <EmptyState
          title={
            canManage
              ? "No Gemba definitions yet"
              : "No Gemba definitions are available with your access"
          }
          description={
            canManage
              ? "Set up your first Gemba definition to start walks."
              : "Definitions you can open will appear here."
          }
          icon={<Footprints className="size-5" />}
          {...(canManage
            ? {
                actionLabel: "Set up Gemba",
                actionHref: "/platform/gemba/setup",
              }
            : {})}
        />
        <WorkplaceSharedRecords module="gemba" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="gemba-overview-page">
      <PageHeader
        title="Gemba walks"
        actions={
          <>
            {canManage ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/gemba/setup"
                  data-testid="gemba-new-definition"
                >
                  New definition
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/schedule"
                data-testid="gemba-upcoming-link"
              >
                Upcoming
              </AppLink>
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Walks in progress</CardTitle>
        </CardHeader>
        <CardContent>
          <GembaActiveWalkList walks={activeWalks ?? []} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Definitions</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/gemba/definitions">
                All definitions
              </AppLink>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/gemba/history">History</AppLink>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <OperationalCatalogTable
            rows={catalogRows}
            nameColumnLabel="Definition"
            actionColumnLabel="Action"
            testId="gemba-definition-list"
          />
        </CardContent>
      </Card>
      <ModulePageInsightsDeferred
        module="gemba"
        rangeDays={analyticsRange.days}
        testId="gemba-analytics"
      />
      <WorkplaceSharedRecords module="gemba" />
    </div>
  );
}
