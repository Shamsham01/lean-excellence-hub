import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { EmptyState } from "@/components/platform/empty-state";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import {
  MaturityRadarChart,
  PillarScoreList,
} from "@/components/maturity/maturity-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  AssessmentStatusBadge,
  ScoreBadge,
} from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MaturityOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );

  const { data: models } = await supabase
    .from("maturity_models")
    .select("id, display_name")
    .limit(1);

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

  const { count: openActions } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);

  const { data: assessments } = await supabase
    .from("maturity_assessments")
    .select("id, status, assessment_type, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (!models?.length) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Lean maturity"
          description="Measure and improve operational excellence across your organisation."
        />
        <EmptyState
          title="No Lean maturity framework yet"
          description="Create your organisation's Lean / Operational Excellence framework to begin measuring maturity across sites and teams."
          {...(canManage
            ? {
                actionLabel: "Create framework",
                actionHref: "/platform/maturity/models",
              }
            : {})}
          icon={<Layers className="size-5" />}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Lean maturity"
        description="Current maturity position, trends, and improvement focus."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/platform/maturity/assessments">Assessments</Link>
            </Button>
            {canManage ? (
              <Button asChild>
                <Link href="/platform/maturity/models">
                  <Plus className="size-4" />
                  Framework
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Current maturity"
          value={
            latestResult ? (
              <ScoreBadge score={Number(latestResult.overall_score)} />
            ) : (
              "—"
            )
          }
          hint={
            latestResult?.published_at
              ? `Last formal: ${new Date(latestResult.published_at).toLocaleDateString("en-GB")}`
              : "No official result yet"
          }
        />
        <MetricCard label="Open actions" value={openActions ?? 0} />
        <MetricCard
          label="Draft assessments"
          value={
            assessments?.filter(
              (a) => a.status === "draft" || a.status === "in_progress",
            ).length ?? 0
          }
        />
        <MetricCard
          label="In review"
          value={
            assessments?.filter(
              (a) => a.status === "submitted" || a.status === "assessor_review",
            ).length ?? 0
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pillar maturity</CardTitle>
          </CardHeader>
          <CardContent>
            {pillarScores.length > 0 ? (
              <>
                <MaturityRadarChart data={pillarScores} />
                <div className="mt-4 hidden sm:block">
                  <PillarScoreList data={pillarScores} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete a formal assessment to see pillar scores.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent assessments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {assessments?.length ? (
              assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/platform/maturity/assessments/${assessment.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted"
                >
                  <span className="text-sm capitalize">
                    {assessment.assessment_type.replace("_", " ")}
                  </span>
                  <AssessmentStatusBadge status={assessment.status} />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No assessments yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
