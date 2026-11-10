import { EmptyState } from "@/components/platform/empty-state";
import { OperationalCatalogTable } from "@/components/operational/operational-catalog-table";
import { ModulePageInsights } from "@/components/platform/module-page-insights";
import { FIVE_S_ANALYTICS_ICONS } from "@/components/platform/module-analytics-icons";
import { buildFiveSOverviewCatalogRows } from "@/lib/operational/overview-catalog-rows";
import { PageHeader } from "@/components/platform/page-header";
import { parseAnalyticsRangeDays } from "@/modules/platform-analytics/date-range";
import { buildAnalyticsDateRangeForOrganisation } from "@/modules/platform-analytics/date-range.server";
import { loadFiveSAnalytics } from "@/modules/platform-analytics/five-s";
import { ModuleReadError } from "@/components/workplace/module-read-error";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { presentCatalogRead } from "@/modules/workplace/access-decision";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Sparkles } from "lucide-react";

export default async function FiveSOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: FIVE_S_PERMISSIONS.read,
    module: "five_s",
    title: "5S",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const analyticsRange = await buildAnalyticsDateRangeForOrganisation(
    parseAnalyticsRangeDays(params.range),
  );
  const canManage = await currentMemberHasPermission(
    FIVE_S_PERMISSIONS.standardsManage,
  );

  const { count: standardCount, error: standardCountError } = await supabase
    .from("five_s_standards")
    .select("id", { count: "exact", head: true });
  const catalog = presentCatalogRead({
    failed: Boolean(standardCountError),
    visibleCount: standardCount ?? 0,
  });
  if (catalog === "failed") {
    return (
      <ModuleReadError
        title="5S Audits"
        description="Digital 5S auditing with scoring, evidence, and accountability."
        message="5S standards could not be loaded. Refresh the page and try again."
        module="five_s"
      />
    );
  }

  const { data: standards } = await supabase
    .from("five_s_standards")
    .select("id, display_name")
    .order("created_at", { ascending: false })
    .limit(5);
  const { count: auditCount } = await supabase
    .from("five_s_audits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  const { data: latestAudit } = await supabase
    .from("five_s_audits")
    .select("id, overall_score_percent, target_percent, completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: openOccurrences } = await supabase
    .from("schedule_occurrences")
    .select("id", { count: "exact", head: true })
    .eq("lifecycle_status", "open");
  const analytics = await loadFiveSAnalytics(supabase, analyticsRange);
  const catalogRows = await buildFiveSOverviewCatalogRows(
    supabase,
    standards ?? [],
  );

  if (catalog === "empty") {
    return (
      <div className="flex flex-col gap-8" data-testid="five-s-empty-state">
        <PageHeader
          title="5S Audits"
        />
        <EmptyState
          title={
            canManage
              ? "No 5S standards yet"
              : "No 5S standards are available with your access"
          }
          description={
            canManage
              ? "Set up your first 5S standard to start auditing."
              : "Standards you can open will appear here."
          }
          icon={<Sparkles className="size-5" />}
          {...(canManage
            ? {
                actionLabel: "Set up 5S",
                actionHref: "/platform/5s/setup",
              }
            : {})}
        />
        <WorkplaceSharedRecords module="five_s" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="five-s-overview-page">
      <PageHeader
        title="5S Audits"
        actions={
          <>
            {canManage ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/5s/setup"
                  data-testid="five-s-new-standard"
                >
                  New standard
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/schedule"
                data-testid="five-s-upcoming-link"
              >
                Upcoming
              </AppLink>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Standards</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/5s/standards">All standards</AppLink>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/5s/history">History</AppLink>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <OperationalCatalogTable
            rows={catalogRows}
            nameColumnLabel="Standard"
            actionColumnLabel="Action"
            testId="five-s-standard-list"
          />
        </CardContent>
      </Card>

      <ModulePageInsights
        snapshot={analytics}
        icons={FIVE_S_ANALYTICS_ICONS}
        testId="five-s-analytics"
      />
      <WorkplaceSharedRecords module="five_s" />
    </div>
  );
}
