import { GembaActiveWalkList } from "@/components/gemba/active-walk-list";
import { EmptyState } from "@/components/platform/empty-state";
import { ModuleAnalyticsDashboard } from "@/components/platform/module-analytics-dashboard";
import { GEMBA_ANALYTICS_ICONS } from "@/components/platform/module-analytics-icons";
import { PageHeader } from "@/components/platform/page-header";
import {
  buildAnalyticsDateRangeForOrganisation,
  parseAnalyticsRangeDays,
} from "@/modules/platform-analytics/date-range";
import { loadGembaAnalytics } from "@/modules/platform-analytics/gemba";
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
  const gembaAnalytics = await loadGembaAnalytics(supabase, analyticsRange);

  if (catalog === "empty") {
    return (
      <div className="flex flex-col gap-8" data-testid="gemba-empty-state">
        <PageHeader
          title="Gemba walks"
          description="Structured walks with observations and follow-up."
        />
        <EmptyState
          title={
            canManage
              ? "No Gemba definitions yet"
              : "No Gemba definitions are available with your access"
          }
          description={
            canManage
              ? "Choose how to start. Manual, LEH Quick Start, and LeanAI each create a draft you review before anything is published."
              : "Definitions you are allowed to open will appear here. Creating a definition needs a separate role."
          }
          icon={<Footprints className="size-5" />}
          {...(canManage
            ? {
                actionLabel: "Set up Gemba",
                actionHref: "/platform/gemba/setup",
              }
            : {})}
        />
        <WorkplaceSharedRecords module="gemba" title="Gemba" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="gemba-overview-page">
      <PageHeader
        title="Gemba walks"
        description="Capture observations and improvement opportunities on the floor."
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
      <ModuleAnalyticsDashboard
        snapshot={gembaAnalytics}
        icons={GEMBA_ANALYTICS_ICONS}
        testId="gemba-analytics"
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
        <CardHeader>
          <CardTitle>Definitions</CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-2"
          data-testid="gemba-definition-list"
        >
          {definitions?.map((definition) => (
            <AppLink
              key={definition.id}
              href={`/platform/gemba/definitions/${definition.id}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {definition.display_name}
            </AppLink>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" asChild>
            <AppLink href="/platform/gemba/definitions">Definitions</AppLink>
          </Button>
          <Button variant="outline" asChild>
            <AppLink href="/platform/gemba/history">History</AppLink>
          </Button>
        </CardContent>
      </Card>
      <WorkplaceSharedRecords module="gemba" title="Gemba" />
    </div>
  );
}
