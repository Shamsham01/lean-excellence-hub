import { EmptyState } from "@/components/platform/empty-state";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Sparkles } from "lucide-react";

export default async function FiveSOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    FIVE_S_PERMISSIONS.standardsManage,
  );

  const { count: standardCount } = await supabase
    .from("five_s_standards")
    .select("id", { count: "exact", head: true });
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

  if (!standardCount) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="5S Audits"
          description="Digital 5S auditing with scoring, evidence, and accountability."
        />
        <EmptyState
          title="No 5S standards yet"
          description="Choose how to start. Manual, LEH Quick Start, and LeanAI each create a draft you review before anything is published."
          icon={<Sparkles className="size-5" />}
          {...(canManage
            ? {
                actionLabel: "Set up 5S",
                actionHref: "/platform/5s/setup",
              }
            : {})}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="five-s-overview-page">
      <PageHeader
        title="5S Audits"
        description="Score, evidence, and trend your 5S programme."
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Latest score"
          value={
            latestAudit?.overall_score_percent != null
              ? `${latestAudit.overall_score_percent}%`
              : "—"
          }
          hint={
            latestAudit?.target_percent != null
              ? `Target ${latestAudit.target_percent}%`
              : "No completed audits"
          }
        />
        <MetricCard label="Completed audits" value={auditCount ?? 0} />
        <MetricCard label="Open schedule slots" value={openOccurrences ?? 0} />
        <MetricCard label="Standards" value={standardCount ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Standards</CardTitle>
        </CardHeader>
        <CardContent
          className="flex flex-col gap-2"
          data-testid="five-s-standard-list"
        >
          {standards?.map((standard) => (
            <AppLink
              key={standard.id}
              href={`/platform/5s/standards/${standard.id}`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {standard.display_name}
            </AppLink>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <AppLink href="/platform/5s/standards">Standards</AppLink>
          </Button>
          <Button variant="outline" asChild>
            <AppLink href="/platform/5s/history">History</AppLink>
          </Button>
          <Button variant="outline" asChild>
            <AppLink
              href="/platform/schedule"
              data-testid="five-s-schedule-link"
            >
              Schedule
            </AppLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
