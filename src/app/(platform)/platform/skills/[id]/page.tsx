import { notFound } from "next/navigation";

import { VersionStatusBadge } from "@/components/skills/version-status-badge";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: skill } = await supabase
    .from("skills")
    .select(
      "id, name, code, category, description, status, evidence_expectations",
    )
    .eq("id", id)
    .maybeSingle();

  if (!skill) {
    notFound();
  }

  const { data: requirementRows } = await supabase
    .from("skill_requirements")
    .select(
      "id, job_function_id, target_proficiency_level_id, capability_set_version_id, mandatory, evidence_requirement",
    )
    .eq("skill_id", id);

  const versionIds = [
    ...new Set(
      (requirementRows ?? []).map((row) => row.capability_set_version_id),
    ),
  ];
  const jobIds = [
    ...new Set(
      (requirementRows ?? [])
        .map((row) => row.job_function_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const levelIds = [
    ...new Set(
      (requirementRows ?? []).map((row) => row.target_proficiency_level_id),
    ),
  ];

  const [{ data: versions }, { data: jobs }, { data: levels }] =
    await Promise.all([
      versionIds.length
        ? supabase
            .from("skill_capability_set_versions")
            .select("id, status, capability_set_id")
            .in("id", versionIds)
        : Promise.resolve({ data: [] }),
      jobIds.length
        ? supabase.from("job_functions").select("id, name").in("id", jobIds)
        : Promise.resolve({ data: [] }),
      levelIds.length
        ? supabase
            .from("skill_proficiency_levels")
            .select("id, label, order_value")
            .in("id", levelIds)
        : Promise.resolve({ data: [] }),
    ]);

  const setIds = [
    ...new Set((versions ?? []).map((version) => version.capability_set_id)),
  ];
  const { data: standards } = setIds.length
    ? await supabase
        .from("skill_capability_sets")
        .select("id, name")
        .in("id", setIds)
    : { data: [] };

  const versionById = new Map(
    (versions ?? []).map((version) => [version.id, version]),
  );
  const standardName = new Map(
    (standards ?? []).map((row) => [row.id, row.name]),
  );
  const jobName = new Map((jobs ?? []).map((row) => [row.id, row.name]));
  const levelName = new Map(
    (levels ?? []).map((row) => [row.id, `${row.order_value} — ${row.label}`]),
  );

  const courseLinks = await supabase
    .from("training_course_skill_links")
    .select("course_id")
    .eq("skill_id", id);
  const courseIds = courseLinks.error
    ? []
    : [...new Set((courseLinks.data ?? []).map((link) => link.course_id))];
  const { data: courses } = courseIds.length
    ? await supabase
        .from("training_courses")
        .select("id, name")
        .in("id", courseIds)
        .eq("status", "active")
    : { data: [] };

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="skills-detail-page"
    >
      <PageHeader
        title={skill.name}
        description={skill.description ?? "Operational skill"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <VersionStatusBadge status={skill.status} />
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/skills/catalog"
                data-testid="skills-detail-back-link"
              >
                Back to catalogue
              </AppLink>
            </Button>
          </div>
        }
      />

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Category</dt>
          <dd className="font-medium">{skill.category ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-medium" data-testid="skill-code">
            {skill.code}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Evidence expectations</dt>
          <dd className="mt-1 max-w-2xl" data-testid="skill-evidence">
            {skill.evidence_expectations ?? "None recorded."}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="typography-section-title">Capability requirements</h2>
        {!requirementRows?.length ? (
          <p className="text-sm text-muted-foreground">
            No skills standard references this skill yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="skill-requirements">
            {requirementRows.map((row) => {
              const version = versionById.get(row.capability_set_version_id);
              const name = version
                ? (standardName.get(version.capability_set_id) ??
                  "Skills standard")
                : "Skills standard";
              return (
                <li
                  key={row.id}
                  className="border-t border-border pt-3 text-sm"
                >
                  <p className="font-medium">
                    {row.job_function_id
                      ? (jobName.get(row.job_function_id) ?? "Job function")
                      : "Job function"}{" "}
                    ·{" "}
                    {levelName.get(row.target_proficiency_level_id) ?? "Level"}
                  </p>
                  <p className="text-muted-foreground">
                    {name}
                    {version ? ` · ${version.status}` : ""}
                    {row.mandatory ? " · Mandatory" : " · Optional"}
                  </p>
                  {row.evidence_requirement ? (
                    <p className="text-muted-foreground">
                      Evidence: {row.evidence_requirement}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {courses && courses.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="typography-section-title">Linked training</h2>
          <ul
            className="flex flex-col gap-2"
            data-testid="skill-training-links"
          >
            {courses.map((course) => (
              <li key={course.id}>
                <AppLink
                  href={`/platform/training/courses/${course.id}`}
                  className="text-sm hover:underline"
                >
                  {course.name}
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AppLink
        href="/platform/skills/matrix"
        className="text-sm text-primary hover:underline"
        data-testid="skills-detail-matrix-link"
      >
        Open skills matrix
      </AppLink>
    </div>
  );
}
