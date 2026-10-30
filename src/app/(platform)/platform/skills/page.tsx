import { SkillsFrameworkPath } from "@/components/skills/skills-framework-path";
import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
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
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: SKILLS_PERMISSIONS.read,
    module: "skills",
    title: "Skills",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

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
    { data: setupDrafts },
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
    supabase
      .from("skill_setup_bundles")
      .select("id, title, source, status")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(5),
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
            <Button size="sm" asChild>
              <AppLink
                href="/platform/skills/setup"
                data-testid="skills-setup-link"
              >
                Set up skills
              </AppLink>
            </Button>
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
      {(setupDrafts ?? []).length > 0 ? (
        <section
          className="flex flex-col gap-2"
          data-testid="skills-setup-drafts"
        >
          <h2 className="text-base font-medium">Setup drafts</h2>
          <ul className="flex flex-col gap-2">
            {(setupDrafts ?? []).map((draft) => (
              <li key={draft.id}>
                <AppLink
                  href={`/platform/skills/setup/drafts/${draft.id}`}
                  className="text-sm underline"
                >
                  {draft.title}
                </AppLink>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  · {draft.source} · not published
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <SkillsFrameworkPath
        snapshot={snapshot}
        canManageCatalog={canManageCatalog}
        canManageRequirements={canManageRequirements}
      />
    </div>
  );
}
