import { SkillCreateForm } from "@/components/skills/skill-create-form";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SkillsCatalogPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const newRequested = Array.isArray(query.new) ? query.new[0] : query.new;
  const supabase = await createServerSupabaseClient();
  const canManageCatalog = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.catalogManage,
  );
  const { data: skills } = await supabase
    .from("skills")
    .select("id, name, code, category, status")
    .order("name");
  const { data: publishedScales } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id, scale_id, status, created_at")
    .eq("status", "published");
  const { data: draftScales } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("scale_id, created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);

  const isEmpty = !skills?.length;
  const showCreateForm = canManageCatalog && (newRequested === "1" || false);
  const draftScaleId = draftScales?.[0]?.scale_id ?? null;
  const scaleHref = draftScaleId
    ? `/platform/skills/scales/${draftScaleId}`
    : "/platform/skills/scales/new";

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-catalog-page"
    >
      <PageHeader
        title="Skills catalogue"
        description="The capabilities people in this organisation need."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageCatalog && !showCreateForm ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/skills/catalog?new=1"
                  data-testid="skills-catalog-new-link"
                >
                  New skill
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/skills"
                data-testid="skills-catalog-back-link"
              >
                Back to skills
              </AppLink>
            </Button>
          </div>
        }
      />

      {showCreateForm ? (
        <section className="flex max-w-xl flex-col gap-4">
          <h2 className="typography-section-title">New skill</h2>
          <SkillCreateForm
            existingCodes={(skills ?? []).map((skill) => skill.code)}
            hasPublishedScale={(publishedScales ?? []).length > 0}
            scaleHref={scaleHref}
          />
        </section>
      ) : null}

      {isEmpty && !showCreateForm ? (
        <section
          className="flex max-w-xl flex-col gap-3"
          data-testid="skills-catalog-empty"
        >
          <h2 className="text-lg font-semibold">No skills yet</h2>
          <p className="text-sm text-muted-foreground">
            Add the first operational skill. Publish a proficiency scale before
            you connect it to a job function.
          </p>
          {canManageCatalog ? (
            <Button className="self-start" asChild>
              <AppLink href="/platform/skills/catalog?new=1">
                Create skill
              </AppLink>
            </Button>
          ) : null}
        </section>
      ) : null}

      {!isEmpty ? (
        <ul className="divide-y divide-border border-y border-border">
          {skills?.map((skill) => (
            <li
              key={skill.id}
              className="flex min-w-0 flex-col gap-1 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between"
            >
              <AppLink
                href={`/platform/skills/${skill.id}`}
                className="font-medium hover:underline"
                data-testid={`skills-catalog-link-${skill.id}`}
              >
                {skill.name}
              </AppLink>
              <span className="text-muted-foreground">
                {skill.category ? `${skill.category} · ` : ""}
                {skill.code}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
