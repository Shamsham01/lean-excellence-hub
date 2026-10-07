import { SkillsFrameworkPath } from "@/components/skills/skills-framework-path";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import type { SkillsSetupSnapshot } from "@/modules/skills/setup-path";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function latestDraftParentId(
  versions: Array<{
    status: string;
    created_at: string;
    parentId: string;
  }>,
) {
  return (
    versions
      .filter((version) => version.status === "draft")
      .sort((left, right) => right.created_at.localeCompare(left.created_at))[0]
      ?.parentId ?? null
  );
}

export default async function SkillsOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const [canManageCatalog, canManageRequirements, dashboardResult] =
    await Promise.all([
      currentMemberHasPermission(SKILLS_PERMISSIONS.catalogManage),
      currentMemberHasPermission(SKILLS_PERMISSIONS.requirementsManage),
      supabase.rpc("get_capability_dashboard"),
    ]);

  const dashboard = dashboardResult.data as {
    skill_coverage_percent?: number | null;
  } | null;
  const coverage = dashboard?.skill_coverage_percent ?? null;

  const [
    { count: skillCount },
    { data: scaleVersions },
    { data: standardVersions },
  ] = await Promise.all([
    supabase
      .from("skills")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("skill_proficiency_scale_versions")
      .select("id, scale_id, status, created_at"),
    supabase
      .from("skill_capability_set_versions")
      .select("id, capability_set_id, status, created_at"),
  ]);

  const snapshot: SkillsSetupSnapshot = {
    publishedScaleCount: (scaleVersions ?? []).filter(
      (version) => version.status === "published",
    ).length,
    draftScaleId: latestDraftParentId(
      (scaleVersions ?? []).map((version) => ({
        status: version.status,
        created_at: version.created_at,
        parentId: version.scale_id,
      })),
    ),
    activeSkillCount: skillCount ?? 0,
    publishedStandardCount: (standardVersions ?? []).filter(
      (version) => version.status === "published",
    ).length,
    draftStandardId: latestDraftParentId(
      (standardVersions ?? []).map((version) => ({
        status: version.status,
        created_at: version.created_at,
        parentId: version.capability_set_id,
      })),
    ),
  };

  return (
    <div className="flex min-w-0 flex-col gap-8" data-testid="skills-overview">
      <PageHeader
        title="Skills"
        description="Set up how capability is measured, which skills the organisation needs, and what each job function requires."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/skills/catalog"
                data-testid="skills-catalog-link"
              >
                Skills catalogue
              </AppLink>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/skills/matrix"
                data-testid="skills-matrix-link"
              >
                Skills matrix
              </AppLink>
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Skill coverage"
          value={coverage != null ? `${coverage}%` : "—"}
        />
        <MetricCard label="Active skills" value={skillCount ?? 0} />
      </div>
      <SkillsFrameworkPath
        snapshot={snapshot}
        canManageCatalog={canManageCatalog}
        canManageRequirements={canManageRequirements}
      />
    </div>
  );
}
