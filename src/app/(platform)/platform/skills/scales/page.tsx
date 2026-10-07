import { VersionStatusBadge } from "@/components/skills/version-status-badge";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProficiencyScalesPage() {
  const supabase = await createServerSupabaseClient();
  const canManageCatalog = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.catalogManage,
  );
  const { data: scales } = await supabase
    .from("skill_proficiency_scales")
    .select("id, name, description")
    .order("name");
  const { data: versions } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("scale_id, status, version_number");

  const statusByScale = new Map<string, string>();
  for (const version of versions ?? []) {
    const current = statusByScale.get(version.scale_id);
    if (!current || version.status === "published" || current === "archived") {
      statusByScale.set(version.scale_id, version.status);
    }
    if (version.status === "draft" && current !== "published") {
      statusByScale.set(version.scale_id, "draft");
    }
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-scales-page"
    >
      <PageHeader
        title="Proficiency scales"
        description="How this organisation measures capability. You define the labels."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageCatalog ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/skills/scales/new"
                  data-testid="skills-scale-new-link"
                >
                  New proficiency scale
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/skills">Back to skills</AppLink>
            </Button>
          </div>
        }
      />
      {!scales?.length ? (
        <section
          className="flex max-w-xl flex-col gap-3"
          data-testid="skills-scales-empty"
        >
          <h2 className="text-lg font-semibold">No proficiency scale yet</h2>
          <p className="text-sm text-muted-foreground">
            Start here. A published scale is what capability requirements and
            assessments use to describe level.
          </p>
          {canManageCatalog ? (
            <Button className="self-start" asChild>
              <AppLink href="/platform/skills/scales/new">
                New proficiency scale
              </AppLink>
            </Button>
          ) : null}
        </section>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {scales.map((scale) => (
            <li
              key={scale.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <AppLink
                  href={`/platform/skills/scales/${scale.id}`}
                  className="font-medium hover:underline"
                  data-testid={`skills-scale-link-${scale.id}`}
                >
                  {scale.name}
                </AppLink>
                {scale.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scale.description}
                  </p>
                ) : null}
              </div>
              <VersionStatusBadge
                status={statusByScale.get(scale.id) ?? "draft"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
