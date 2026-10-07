import { VersionStatusBadge } from "@/components/skills/version-status-badge";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SkillsStandardsPage() {
  const supabase = await createServerSupabaseClient();
  const canManageRequirements = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.requirementsManage,
  );
  const { data: standards } = await supabase
    .from("skill_capability_sets")
    .select("id, name, description, code")
    .order("name");
  const { data: versions } = await supabase
    .from("skill_capability_set_versions")
    .select("capability_set_id, status");

  const statusByStandard = new Map<string, string>();
  for (const version of versions ?? []) {
    const current = statusByStandard.get(version.capability_set_id);
    if (!current || version.status === "published") {
      statusByStandard.set(version.capability_set_id, version.status);
    } else if (version.status === "draft" && current !== "published") {
      statusByStandard.set(version.capability_set_id, "draft");
    }
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-standards-page"
    >
      <PageHeader
        title="Skills standards"
        description="Capability requirements that connect a job function, a skill, and the level that job function needs."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageRequirements ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/skills/standards/new"
                  data-testid="skills-standard-new-link"
                >
                  New skills standard
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/skills">Back to skills</AppLink>
            </Button>
          </div>
        }
      />
      {!standards?.length ? (
        <section
          className="flex max-w-xl flex-col gap-3"
          data-testid="skills-standards-empty"
        >
          <h2 className="text-lg font-semibold">No skills standard yet</h2>
          <p className="text-sm text-muted-foreground">
            A skills standard is the set of requirements the matrix compares
            with validated capability. Create job functions first if you have
            not already.
          </p>
          {canManageRequirements ? (
            <Button className="self-start" asChild>
              <AppLink href="/platform/skills/standards/new">
                New skills standard
              </AppLink>
            </Button>
          ) : null}
        </section>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {standards.map((standard) => (
            <li
              key={standard.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <AppLink
                  href={`/platform/skills/standards/${standard.id}`}
                  className="font-medium hover:underline"
                  data-testid={`skills-standard-link-${standard.id}`}
                >
                  {standard.name}
                </AppLink>
                {standard.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {standard.description}
                  </p>
                ) : null}
              </div>
              <VersionStatusBadge
                status={statusByStandard.get(standard.id) ?? "draft"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
