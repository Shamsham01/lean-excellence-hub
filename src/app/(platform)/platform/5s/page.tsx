import Link from "next/link";

import { EmptyState } from "@/components/platform/empty-state";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
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

  const { data: standards } = await supabase
    .from("five_s_standards")
    .select("id, display_name")
    .limit(1);
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

  if (!standards?.length) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="5S Audits"
          description="Digital 5S auditing with scoring, evidence, and accountability."
        />
        <EmptyState
          title="No 5S standards yet"
          description="Create a configurable 5S standard for your areas and teams."
          icon={<Sparkles className="size-5" />}
          {...(canManage
            ? {
                actionLabel: "Create standard",
                actionHref: "/platform/5s/standards",
              }
            : {})}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="5S Audits"
        description="Score, evidence, and trend your 5S programme."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/schedule">Upcoming</Link>
          </Button>
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
        <MetricCard label="Standards" value={standards.length} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/platform/5s/standards">Standards</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/platform/5s/history">History</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/platform/schedule">Schedule</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
