import { CoreSetupBanner } from "@/components/onboarding/core-setup-banner";
import { QuickActions } from "@/components/onboarding/quick-actions";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { TimeGreeting } from "@/components/platform/time-greeting";
import { formatBenefitCurrencyAmount } from "@/lib/benefits/forecast";
import type { BenefitsOverview } from "@/lib/benefits/types";
import {
  AssessmentStatusBadge,
  ScoreBadge,
} from "@/modules/maturity/status-badges";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkplaceHomeActivity } from "@/components/workplace/workplace-home-activity";
import { listEligibleOrganisations } from "@/modules/organisations/context";
import { buildQuickActions } from "@/modules/organisation-setup/readiness";
import {
  loadOrganisationSetupSnapshot,
  loadSetupPermissions,
} from "@/modules/organisation-setup/queries";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { visibleHomeSections } from "@/modules/platform-shell/home-sections";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

export default async function PlatformHomePage() {
  const supabase = await createServerSupabaseClient();
  const organisations = await listEligibleOrganisations();
  const currentOrg = organisations.find((o) => o.selected);
  const [setupSnapshot, setupPermissions, homePermissions] = await Promise.all([
    loadOrganisationSetupSnapshot(),
    loadSetupPermissions(),
    Promise.all([
      currentMemberHasPermission("maturity.read"),
      currentMemberHasPermission(MATURITY_PERMISSIONS.modelsManage),
      currentMemberHasPermission("actions.read"),
      currentMemberHasPermission("five_s.read"),
      currentMemberHasPermission("gemba.read"),
      currentMemberHasPermission("templates.read"),
      currentMemberHasPermission("people.capability.read"),
      currentMemberHasPermission("memberships.read"),
      currentMemberHasPermission("skills.read"),
      currentMemberHasPermission("training.read"),
      currentMemberHasPermission("suggestions.read"),
      currentMemberHasPermission("suggestions.submit"),
      currentMemberHasPermission("benefits.read"),
      currentMemberHasPermission("workplace.view"),
    ]),
  ]);
  const [
    canReadMaturity,
    canManageMaturity,
    canReadActions,
    canReadFiveS,
    canReadGemba,
    canReadTemplates,
    canReadPeopleCapability,
    canReadMemberships,
    canReadSkills,
    canReadTraining,
    canReadSuggestions,
    canSubmitSuggestions,
    canReadBenefits,
    canViewWorkplace,
  ] = homePermissions;
  const home = visibleHomeSections({
    canReadMaturity,
    canManageMaturity,
    canReadActions,
    canReadFiveS,
    canReadGemba,
    canReadTemplates,
    canReadPeople: canReadPeopleCapability || canReadMemberships,
    canReadCapability: canReadSkills || canReadTraining,
    canReadSuggestions,
    canSubmitSuggestions,
    canReadBenefits,
    canViewWorkplace,
  });
  const quickActions = buildQuickActions(
    setupPermissions,
    canManageMaturity
      ? "start"
      : canReadMaturity
        ? "open"
        : canViewWorkplace
          ? "view"
          : "hidden",
  );

  const { data: latestResult } = home.maturityMetric
    ? await supabase
        .from("maturity_official_results")
        .select("overall_score, published_at")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { count: openActions } = home.actionsMetric
    ? await supabase
        .from("actions")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"])
    : { count: null };

  const { count: overdueActions } = home.actionsMetric
    ? await supabase
        .from("actions")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"])
        .lt("due_at", new Date().toISOString())
    : { count: null };

  const { data: recentAssessments } = home.recentAssessments
    ? await supabase
        .from("maturity_assessments")
        .select("id, status, assessment_type")
        .order("updated_at", { ascending: false })
        .limit(3)
    : { data: null };

  const { count: templateCount } = home.templates
    ? await supabase
        .from("templates")
        .select("id", { count: "exact", head: true })
    : { count: null };

  const { data: latestFiveS } = home.fiveSMetric
    ? await supabase
        .from("five_s_audits")
        .select("overall_score_percent")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { count: gembaWalkCount } = home.gembaMetric
    ? await supabase
        .from("gemba_walks")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
    : { count: null };

  const { data: capabilityDashboard } = home.capability
    ? await supabase.rpc("get_capability_dashboard")
    : { data: null };
  const capabilityObj = capabilityDashboard as {
    training_compliance_percent?: number | null;
    skill_coverage_percent?: number | null;
  } | null;

  const suggestionsOverview = canReadSuggestions
    ? ((await supabase.rpc("get_suggestions_overview")).data as Record<
        string,
        unknown
      > | null)
    : null;

  const benefitsOverview = canReadBenefits
    ? ((await supabase.rpc("get_benefits_overview"))
        .data as BenefitsOverview | null)
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
    <div className="flex flex-col gap-8" data-testid="platform-home-page">
      <PageHeader
        title={<TimeGreeting />}
        description={
          currentOrg?.organisation_name ?? setupSnapshot.organisationName
        }
        descriptionTestId="platform-org-name"
      />

      <CoreSetupBanner
        core={setupSnapshot.core}
        nextActionHref={setupSnapshot.nextActionHref}
        nextActionLabel={setupSnapshot.nextActionLabel}
        compact={setupSnapshot.core.readyLabel === "ready"}
      />

      <QuickActions actions={quickActions} />

      <div>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Your Lean system
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {home.maturityMetric ? (
            <MetricCard
              label="Maturity"
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
                  : "No official result"
              }
            />
          ) : null}
          {home.actionsMetric ? (
            <MetricCard
              label="Open actions"
              value={openActions ?? 0}
              hint={`${overdueActions ?? 0} overdue`}
            />
          ) : null}
          {home.assessmentMetric ? (
            <MetricCard
              label="Assessments"
              value={recentAssessments?.length ?? 0}
              hint="Recent activity"
            />
          ) : null}
          {home.fiveSMetric ? (
            <MetricCard
              label="5S"
              value={
                latestFiveS?.overall_score_percent != null
                  ? `${latestFiveS.overall_score_percent}%`
                  : "—"
              }
              hint="Latest completed audit"
            />
          ) : null}
          {home.gembaMetric ? (
            <MetricCard
              label="Gemba walks"
              value={gembaWalkCount ?? 0}
              hint="Completed"
            />
          ) : null}
          {home.capability ? (
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
          ) : null}
          {home.templates ? (
            <MetricCard label="Templates" value={templateCount ?? 0} />
          ) : null}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="home-your-profile">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your profile</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/people/me">Open</AppLink>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Job function, primary work area, and your access. A job function
              does not grant permissions.
            </p>
          </CardContent>
        </Card>
        {home.submitSuggestion ? (
          <Card data-testid="home-submit-suggestion">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Suggestions</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink href="/platform/suggestions/new">
                  Submit a suggestion
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Submission uses Suggestions Contributor or another role that
                includes it. Review and programme administration stay separate.
              </p>
            </CardContent>
          </Card>
        ) : null}
        {home.workplaceActivity ? <WorkplaceHomeActivity /> : null}
        {home.fiveSCard ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>5S audits</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink href="/platform/5s" data-testid="dashboard-open-5s">
                  Open
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {home.fiveSViewingCopy
                  ? "Completed audits in your viewing scope. Running an audit needs a separate role."
                  : "Run scored 5S audits with evidence, findings, and schedule compliance."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {home.gembaCard ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gemba walks</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink
                  href="/platform/gemba"
                  data-testid="dashboard-open-gemba"
                >
                  Open
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {home.gembaViewingCopy
                  ? "Completed walks in your viewing scope. Walk notes and drafts stay unavailable."
                  : "Capture observations and improvement opportunities on the floor."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {home.maturityCard ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lean maturity</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink
                  href="/platform/maturity"
                  data-testid="dashboard-open-maturity"
                >
                  Open
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {home.maturityViewingCopy
                  ? "Published frameworks and official results in your viewing scope. Assessments and answers need a separate role."
                  : "Track framework maturity, run assessments, and publish official results."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {home.peopleCard ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>People & capability</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink
                  href="/platform/people"
                  data-testid="dashboard-open-people"
                >
                  Open
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Training compliance, skills coverage, and workforce capability
                profiles.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {home.suggestions ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Suggestions</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink
                  href="/platform/suggestions"
                  data-testid="dashboard-open-suggestions"
                >
                  Open
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                {(suggestionsOverview?.implementing as number) ?? 0}{" "}
                implementing
              </p>
              <p>
                {(suggestionsOverview?.implemented as number) ?? 0} implemented
              </p>
            </CardContent>
          </Card>
        ) : null}

        {home.benefits ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Benefits</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <AppLink
                  href="/platform/benefits"
                  data-testid="dashboard-open-benefits"
                >
                  Open
                </AppLink>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>{benefitsRealising} realising</p>
              <p>{benefitsAwaitingValidation} awaiting validation</p>
              <p>
                Validated YTD{" "}
                {formatBenefitCurrencyAmount(benefitsValidatedYtd, null)}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {home.recentAssessments ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent assessments</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {recentAssessments?.length ? (
                recentAssessments.map((a) => (
                  <AppLink
                    key={a.id}
                    href={`/platform/maturity/assessments/${a.id}`}
                    className="flex items-center justify-between text-sm"
                    data-testid={`dashboard-assessment-link-${a.id}`}
                  >
                    <span className="capitalize">
                      {a.assessment_type.replace("_", " ")}
                    </span>
                    <AssessmentStatusBadge status={a.status} />
                  </AppLink>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No assessments yet.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
