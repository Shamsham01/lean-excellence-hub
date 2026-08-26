import Link from "next/link";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { TimeGreeting } from "@/components/platform/time-greeting";
import { formatBenefitCurrencyAmount } from "@/lib/benefits/forecast";
import type { BenefitsOverview } from "@/lib/benefits/types";
import { AssessmentStatusBadge, ScoreBadge } from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

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

  const { data: latestFiveS } = await supabase
    .from("five_s_audits")
    .select("overall_score_percent")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: gembaWalkCount } = await supabase
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  const { data: capabilityDashboard } = await supabase.rpc("get_capability_dashboard");
  const capabilityObj = capabilityDashboard as {
    training_compliance_percent?: number | null;
    skill_coverage_percent?: number | null;
  } | null;

  const canReadSuggestions = await currentMemberHasPermission("suggestions.read");
  const suggestionsOverview = canReadSuggestions
    ? ((await supabase.rpc("get_suggestions_overview")).data as Record<string, unknown> | null)
    : null;

  const canReadBenefits = await currentMemberHasPermission("benefits.read");
  const benefitsOverview = canReadBenefits
    ? ((await supabase.rpc("get_benefits_overview")).data as BenefitsOverview | null)
    : null;

  const benefitsAwaitingValidation =
    (benefitsOverview?.awaiting_validation?.benefits ?? 0) +
    (benefitsOverview?.awaiting_validation?.realisation_entries ?? 0);
  const benefitsValidatedYtd =
    benefitsOverview?.financial_by_type?.reduce(
      (sum, row) => sum + Number(row.validated_realised_ytd ?? 0),
      0,
    ) ?? 0;
  const benefitsRealising = benefitsOverview?.status_pipeline?.realising ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={<TimeGreeting />}
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
        <MetricCard
          label="5S"
          value={latestFiveS?.overall_score_percent != null ? `${latestFiveS.overall_score_percent}%` : "—"}
          hint="Latest completed audit"
        />
        <MetricCard label="Gemba walks" value={gembaWalkCount ?? 0} hint="Completed" />
        <MetricCard
          label="Capability"
          value={
            capabilityObj?.training_compliance_percent != null
              ? `${capabilityObj.training_compliance_percent}%`
              : "—"
          }
          hint={
            capabilityObj?.skill_coverage_percent != null
              ? `Skill coverage ${capabilityObj.skill_coverage_percent}%`
              : "Training compliance"
          }
        />
        <MetricCard label="Templates" value={templateCount ?? 0} />
        {canReadSuggestions ? (
          <MetricCard
            label="Ideas awaiting review"
            value={(suggestionsOverview?.awaiting_review as number) ?? 0}
            hint={`${(suggestionsOverview?.submitted_this_month as number) ?? 0} submitted this month`}
          />
        ) : null}
        {canReadBenefits ? (
          <MetricCard
            label="Benefits realising"
            value={benefitsRealising}
            hint={`${benefitsAwaitingValidation} awaiting validation`}
          />
        ) : null}
        {canReadBenefits ? (
          <MetricCard
            label="Validated benefits YTD"
            value={formatBenefitCurrencyAmount(benefitsValidatedYtd, null)}
            hint="Financial portfolio (allocated)"
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>5S audits</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/5s">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run scored 5S audits with evidence, findings, and schedule compliance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Gemba walks</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/gemba">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Capture observations and improvement opportunities on the floor.
            </p>
          </CardContent>
        </Card>

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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>People & capability</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/people">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Training compliance, skills coverage, and workforce capability profiles.
            </p>
          </CardContent>
        </Card>

        {canReadSuggestions ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Suggestions</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/platform/suggestions">Open</Link>
              </Button>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{(suggestionsOverview?.implementing as number) ?? 0} implementing</p>
              <p>{(suggestionsOverview?.implemented as number) ?? 0} implemented</p>
            </CardContent>
          </Card>
        ) : null}

        {canReadBenefits ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Benefits</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/platform/benefits">Open</Link>
              </Button>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>{benefitsRealising} realising</p>
              <p>{benefitsAwaitingValidation} awaiting validation</p>
              <p>
                Validated YTD {formatBenefitCurrencyAmount(benefitsValidatedYtd, null)}
              </p>
            </CardContent>
          </Card>
        ) : null}

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
