import { Layers, Plus } from "lucide-react";
import { Suspense } from "react";

import { EmptyState } from "@/components/platform/empty-state";
import { MaturityOverviewAnalytics } from "@/components/platform/maturity-overview-analytics";
import { PageHeader } from "@/components/platform/page-header";
import {
  buildAnalyticsDateRange,
  parseAnalyticsRangeDays,
} from "@/modules/platform-analytics/date-range";
import { ModuleReadError } from "@/components/workplace/module-read-error";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import {
  MaturityRadarChart,
  PillarScoreList,
} from "@/components/maturity/maturity-charts";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { presentCatalogRead } from "@/modules/workplace/access-decision";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  AssessmentStatusBadge,
  ScoreBadge,
} from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MaturityOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const analyticsRange = buildAnalyticsDateRange(
    parseAnalyticsRangeDays(params.range),
  );
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: MATURITY_PERMISSIONS.read,
    module: "maturity",
    title: "Maturity",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );

  const { data: models, error: modelsError } = await supabase
    .from("maturity_models")
    .select("id, display_name")
    .limit(1);
  const catalog = presentCatalogRead({
    failed: Boolean(modelsError),
    visibleCount: models?.length ?? 0,
  });
  if (catalog === "failed") {
    return (
      <ModuleReadError
        title="Lean maturity"
        description="Measure and improve operational excellence across your organisation."
        message="Maturity frameworks could not be loaded. Refresh the page and try again."
        module="maturity"
      />
    );
  }

  const { data: latestResult } = await supabase
    .from("maturity_official_results")
    .select("id, overall_score, published_at, assessment_id")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pillarScores: Array<{ name: string; score: number }> = [];
  if (latestResult) {
    const { data: pillars } = await supabase
      .from("maturity_official_result_pillars")
      .select("pillar_name, score")
      .eq("official_result_id", latestResult.id);
    for (const p of pillars ?? []) {
      pillarScores.push({ name: p.pillar_name, score: Number(p.score) });
    }
  }

  const { data: assessments } = await supabase
    .from("maturity_assessments")
    .select("id, status, assessment_type, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (catalog === "empty") {
    return (
      <div className="flex flex-col gap-8" data-testid="maturity-overview-page">
        <PageHeader
          title="Lean maturity"
          description="Measure and improve operational excellence across your organisation."
        />
        <EmptyState
          title={
            canManage
              ? "No Lean maturity framework yet"
              : "No maturity frameworks are available with your access"
          }
          description={
            canManage
              ? "Start with an LEH Quick Start template or create a framework to begin measuring maturity across sites and teams."
              : "Published frameworks you are allowed to open will appear here. Creating a framework needs a separate role."
          }
          {...(canManage
            ? {
                actionLabel: "Create framework",
                actionHref: "/platform/maturity/models",
              }
            : {})}
          icon={<Layers className="size-5" />}
        />
        <WorkplaceSharedRecords module="maturity" title="Maturity" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="maturity-overview-page">
      <PageHeader
        title="Lean maturity"
        description="Current maturity position, trends, and improvement focus."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <AppLink
                href="/platform/maturity/assessments"
                data-testid="maturity-assessments-link"
              >
                Assessments
              </AppLink>
            </Button>
            {latestResult ? (
              <Button variant="outline" asChild>
                <AppLink
                  href={`/platform/maturity/results/${latestResult.id}`}
                  data-testid="maturity-latest-result-link"
                >
                  Official result
                </AppLink>
              </Button>
            ) : null}
            {canManage ? (
              <Button asChild>
                <AppLink
                  href="/platform/maturity/models"
                  data-testid="maturity-framework-link"
                >
                  <Plus className="size-4" />
                  Framework
                </AppLink>
              </Button>
            ) : null}
          </div>
        }
      />

      {!latestResult ? (
        <p className="text-sm text-muted-foreground">No official result yet</p>
      ) : null}

      <Suspense fallback={null}>
        <MaturityOverviewAnalytics range={analyticsRange} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {pillarScores.length > 0 ? (
            <>
              <MaturityRadarChart data={pillarScores} />
              <div className="hidden sm:block">
                <PillarScoreList data={pillarScores} />
              </div>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Pillar maturity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Complete a formal assessment to see pillar scores.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent assessments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {assessments?.length ? (
              assessments.map((assessment) => (
                <AppLink
                  key={assessment.id}
                  href={`/platform/maturity/assessments/${assessment.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted"
                  data-testid={`maturity-recent-assessment-${assessment.id}`}
                >
                  <span className="text-sm capitalize">
                    {assessment.assessment_type.replace("_", " ")}
                  </span>
                  <AssessmentStatusBadge status={assessment.status} />
                </AppLink>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No assessments yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <WorkplaceSharedRecords module="maturity" title="Maturity" />
    </div>
  );
}
