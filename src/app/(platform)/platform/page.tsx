import { CoreSetupBanner } from "@/components/onboarding/core-setup-banner";
import { QuickActions } from "@/components/onboarding/quick-actions";
import { HomeAttentionStrip } from "@/components/platform/home-attention-strip";
import { PlatformHomeAnalytics } from "@/components/platform/platform-home-analytics";
import { PageHeader } from "@/components/platform/page-header";
import { TimeGreeting } from "@/components/platform/time-greeting";
import type { BenefitsOverview } from "@/lib/benefits/types";
import { AssessmentStatusBadge } from "@/modules/maturity/status-badges";
import { parseAnalyticsRangeDays } from "@/modules/platform-analytics/date-range";
import { buildAnalyticsDateRangeForOrganisation } from "@/modules/platform-analytics/date-range.server";
import { loadPlatformHomeAnalytics } from "@/modules/platform-analytics/home";
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
import { buildHomeAttentionItems } from "@/modules/platform-shell/home-attention";
import { visibleHomeSections } from "@/modules/platform-shell/home-sections";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
  currentMemberHasScopedPermission,
} from "@/modules/platform-shell/permissions";

export default async function PlatformHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const analyticsRange = await buildAnalyticsDateRangeForOrganisation(
    parseAnalyticsRangeDays(params.range),
  );
  const organisations = await listEligibleOrganisations();
  const currentOrg = organisations.find((o) => o.selected);
  const [
    setupSnapshot,
    setupPermissions,
    homePermissions,
    canReadCapabilityDashboard,
  ] = await Promise.all([
    loadOrganisationSetupSnapshot(),
    loadSetupPermissions(),
    Promise.all([
      currentMemberHasGrantPermission("maturity.read"),
      currentMemberHasPermission(MATURITY_PERMISSIONS.modelsManage),
      currentMemberHasGrantPermission("actions.read"),
      currentMemberHasGrantPermission("five_s.read"),
      currentMemberHasGrantPermission("gemba.read"),
      currentMemberHasGrantPermission("templates.read"),
      currentMemberHasGrantPermission("people.capability.read"),
      currentMemberHasPermission("memberships.read"),
      currentMemberHasGrantPermission("skills.read"),
      currentMemberHasGrantPermission("training.read"),
      currentMemberHasGrantPermission("suggestions.read"),
      currentMemberHasPermission("suggestions.submit"),
      currentMemberHasGrantPermission("benefits.read"),
      currentMemberHasPermission("workplace.view"),
    ]),
    currentMemberHasScopedPermission("people.capability.read"),
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

  const { data: capabilityDashboard } =
    home.capability && canReadCapabilityDashboard
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
  const homeAnalytics = await loadPlatformHomeAnalytics(
    supabase,
    analyticsRange,
    home,
  );

  const homeAttention = buildHomeAttentionItems({
    canReadActions: Boolean(home.actionsMetric),
    canReadSuggestions,
    canReadBenefits,
    overdueActions: home.actionsMetric ? (overdueActions ?? 0) : null,
    ideasAwaitingReview: canReadSuggestions
      ? ((suggestionsOverview?.awaiting_review as number) ?? 0)
      : null,
    benefitsAwaitingValidation: canReadBenefits
      ? benefitsAwaitingValidation
      : null,
  });

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
        operationalSetupIncomplete={setupSnapshot.operationalSetupIncomplete}
      />

      <QuickActions actions={quickActions} />

      <HomeAttentionStrip items={homeAttention} />

      <PlatformHomeAnalytics data={homeAnalytics} />

      {home.workplaceActivity ? <WorkplaceHomeActivity /> : null}

      {home.recentAssessments ? (
        <Card data-testid="home-recent-assessments">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Recent assessments</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/maturity/assessments">View all</AppLink>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentAssessments?.length ? (
              recentAssessments.map((a) => (
                <AppLink
                  key={a.id}
                  href={`/platform/maturity/assessments/${a.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                  data-testid={`dashboard-assessment-link-${a.id}`}
                >
                  <span className="capitalize">
                    {a.assessment_type.replace("_", " ")}
                  </span>
                  <AssessmentStatusBadge status={a.status} />
                </AppLink>
              ))
            ) : (
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>No assessments yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-fit"
                  asChild
                >
                  <AppLink href="/platform/maturity">Open maturity</AppLink>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
