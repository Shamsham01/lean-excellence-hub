import Link from "next/link";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SkillsOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const { data: dashboard } = await supabase.rpc("get_capability_dashboard");

  const dashboardObj = dashboard as {
    skill_coverage_percent?: number | null;
  } | null;
  const coverage = dashboardObj?.skill_coverage_percent ?? null;
  const { count: skillCount } = await supabase
    .from("skills")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Skills"
        description="Capability catalogue, proficiency scales, and skills matrix."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/skills/matrix">Skills matrix</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Skill coverage"
          value={coverage != null ? `${coverage}%` : "—"}
        />
        <MetricCard label="Active skills" value={skillCount ?? 0} />
      </div>
      <Link href="/platform/skills/catalog" className="text-sm hover:underline">
        Skills catalogue
      </Link>
    </div>
  );
}
