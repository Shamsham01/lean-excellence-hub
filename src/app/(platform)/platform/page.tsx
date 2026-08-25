import Link from "next/link";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AssessmentStatusBadge, ScoreBadge } from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listEligibleOrganisations } from "@/modules/organisations/context";

export default async function PlatformHomePage() {
  const supabase = await createServerSupabaseClient();
  const organisations = await listEligibleOrganisations();
  const currentOrg = organisations.find((o) => o.selected);

  const { data: latestResult } = await supabase
    .from("maturity_official_results")
    .select("overall_score, published_at")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: openActions } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"]);

  const { count: overdueActions } = await supabase
    .from("actions")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"])
    .lt("due_at", new Date().toISOString());

  const { data: recentAssessments } = await supabase
    .from("maturity_assessments")
    .select("id, status, assessment_type")
    .order("updated_at", { ascending: false })
    .limit(3);

  const { count: templateCount } = await supabase
    .from("templates")
    .select("id", { count: "exact", head: true });

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${greeting}`}
        description={currentOrg?.organisation_name ?? "Your organisation"}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Maturity"
          value={
            latestResult
              ? <ScoreBadge score={Number(latestResult.overall_score)} />
              : "—"
          }
          hint={
            latestResult?.published_at
              ? `Last formal: ${new Date(latestResult.published_at).toLocaleDateString("en-GB")}`
              : "No official result"
          }
        />
        <MetricCard label="Open actions" value={openActions ?? 0} hint={`${overdueActions ?? 0} overdue`} />
        <MetricCard
          label="Assessments"
          value={recentAssessments?.length ?? 0}
          hint="Recent activity"
        />
        <MetricCard label="Templates" value={templateCount ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lean maturity</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/maturity">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track framework maturity, run assessments, and publish official results.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent assessments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentAssessments?.length ? (
              recentAssessments.map((a) => (
                <Link
                  key={a.id}
                  href={`/platform/maturity/assessments/${a.id}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{a.assessment_type.replace("_", " ")}</span>
                  <AssessmentStatusBadge status={a.status} />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No assessments yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
