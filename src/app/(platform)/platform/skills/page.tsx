import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
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
    <div className="flex flex-col gap-8" data-testid="skills-overview">
      <PageHeader
        title="Skills"
        description="Capability catalogue, proficiency scales, and skills matrix."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/skills/matrix"
              data-testid="skills-matrix-link"
            >
              Skills matrix
            </AppLink>
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
      <AppLink
        href="/platform/skills/catalog"
        className="text-sm hover:underline"
        data-testid="skills-catalog-link"
      >
        Skills catalogue
      </AppLink>
    </div>
  );
}
