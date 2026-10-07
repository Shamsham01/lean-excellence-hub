import { notFound } from "next/navigation";

import { RequirementEditor } from "@/components/skills/requirement-editor";
import { VersionStatusBadge } from "@/components/skills/version-status-badge";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ standardId: string }> };

export default async function SkillsStandardPage({ params }: PageProps) {
  const { standardId } = await params;
  const supabase = await createServerSupabaseClient();
  const canManageRequirements = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.requirementsManage,
  );
  const { data: standard } = await supabase
    .from("skill_capability_sets")
    .select("id, name, description, code")
    .eq("id", standardId)
    .maybeSingle();

  if (!standard) {
    notFound();
  }

  const { data: versions } = await supabase
    .from("skill_capability_set_versions")
    .select("id, status, version_number")
    .eq("capability_set_id", standardId)
    .order("version_number", { ascending: false });
  const current = versions?.[0];
  if (!current) {
    notFound();
  }

  const { data: requirementRows } = await supabase
    .from("skill_requirements")
    .select(
      "id, skill_id, job_function_id, target_proficiency_level_id, mandatory, evidence_requirement, organisational_unit_id",
    )
    .eq("capability_set_version_id", current.id);

  const skillIds = [
    ...new Set((requirementRows ?? []).map((row) => row.skill_id)),
  ];
  const jobFunctionIds = [
    ...new Set(
      (requirementRows ?? [])
        .map((row) => row.job_function_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const levelIds = [
    ...new Set(
      (requirementRows ?? []).map((row) => row.target_proficiency_level_id),
    ),
  ];
  const unitIds = [
    ...new Set(
      (requirementRows ?? [])
        .map((row) => row.organisational_unit_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [
    { data: linkedSkills },
    { data: linkedJobs },
    { data: linkedLevels },
    { data: linkedUnits },
    { data: skills },
    { data: jobFunctions },
    { data: publishedVersions },
    { data: units },
    { data: draftScales },
  ] = await Promise.all([
    skillIds.length
      ? supabase.from("skills").select("id, name").in("id", skillIds)
      : Promise.resolve({ data: [] }),
    jobFunctionIds.length
      ? supabase
          .from("job_functions")
          .select("id, name")
          .in("id", jobFunctionIds)
      : Promise.resolve({ data: [] }),
    levelIds.length
      ? supabase
          .from("skill_proficiency_levels")
          .select("id, label, order_value")
          .in("id", levelIds)
      : Promise.resolve({ data: [] }),
    unitIds.length
      ? supabase.from("organisation_units").select("id, name").in("id", unitIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("skills")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("job_functions")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("skill_proficiency_scale_versions")
      .select("id, scale_id")
      .eq("status", "published"),
    supabase
      .from("organisation_units")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("skill_proficiency_scale_versions")
      .select("scale_id, created_at")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const publishedVersionIds = (publishedVersions ?? []).map(
    (version) => version.id,
  );
  const { data: publishedLevels } = publishedVersionIds.length
    ? await supabase
        .from("skill_proficiency_levels")
        .select("id, label, order_value, scale_version_id")
        .in("scale_version_id", publishedVersionIds)
        .order("order_value")
    : { data: [] };
  const scaleIds = [
    ...new Set((publishedVersions ?? []).map((version) => version.scale_id)),
  ];
  const { data: scaleRows } = scaleIds.length
    ? await supabase
        .from("skill_proficiency_scales")
        .select("id, name")
        .in("id", scaleIds)
    : { data: [] };

  const skillName = new Map(
    (linkedSkills ?? []).map((row) => [row.id, row.name]),
  );
  const jobName = new Map((linkedJobs ?? []).map((row) => [row.id, row.name]));
  const levelName = new Map(
    (linkedLevels ?? []).map((row) => [
      row.id,
      `${row.order_value} — ${row.label}`,
    ]),
  );
  const unitName = new Map(
    (linkedUnits ?? []).map((row) => [row.id, row.name]),
  );
  const scaleName = new Map((scaleRows ?? []).map((row) => [row.id, row.name]));
  const scaleNameByVersion = new Map(
    (publishedVersions ?? []).map((version) => [
      version.id,
      scaleName.get(version.scale_id) ?? "Proficiency scale",
    ]),
  );

  const isDraft = current.status === "draft";
  const scaleHref = draftScales?.[0]?.scale_id
    ? `/platform/skills/scales/${draftScales[0].scale_id}`
    : "/platform/skills/scales/new";

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="standard-detail-page"
    >
      <PageHeader
        title={standard.name}
        description={
          standard.description ??
          "Job function, skill, and the proficiency level that job function requires."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="standard-status">
              <VersionStatusBadge status={current.status} />
            </span>
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/skills/standards">All standards</AppLink>
            </Button>
          </div>
        }
      />
      <p className="text-sm text-muted-foreground">
        Code{" "}
        <span className="font-medium text-foreground">{standard.code}</span>
      </p>

      {isDraft && canManageRequirements ? (
        <RequirementEditor
          versionId={current.id}
          hasPublishedScale={publishedVersionIds.length > 0}
          scaleHref={scaleHref}
          skills={skills ?? []}
          jobFunctions={jobFunctions ?? []}
          units={units ?? []}
          levels={(publishedLevels ?? []).map((level) => ({
            id: level.id,
            label: level.label,
            order: level.order_value,
            scaleVersionId: level.scale_version_id,
            scaleName:
              scaleNameByVersion.get(level.scale_version_id) ??
              "Proficiency scale",
          }))}
          requirements={(requirementRows ?? []).map((row) => ({
            id: row.id,
            skillName: skillName.get(row.skill_id) ?? "Skill",
            jobFunctionName: row.job_function_id
              ? (jobName.get(row.job_function_id) ?? "Job function")
              : "Job function",
            levelLabel:
              levelName.get(row.target_proficiency_level_id) ?? "Level",
            mandatory: row.mandatory,
            evidenceRequirement: row.evidence_requirement,
            unitName: row.organisational_unit_id
              ? (unitName.get(row.organisational_unit_id) ?? null)
              : null,
          }))}
        />
      ) : (
        <section className="flex max-w-2xl flex-col gap-4">
          <p
            className="text-sm text-muted-foreground"
            data-testid="standard-readonly-note"
          >
            {current.status === "published"
              ? "This skills standard is published and read-only. The skills matrix uses the latest published standard. Editing it in place is not available."
              : "This skills standard is read-only."}
          </p>
          <ol
            className="flex flex-col gap-3"
            data-testid="standard-requirements"
          >
            {(requirementRows ?? []).map((row) => (
              <li key={row.id} className="border-t border-border pt-3 text-sm">
                <p className="font-medium">
                  {row.job_function_id
                    ? (jobName.get(row.job_function_id) ?? "Job function")
                    : "Job function"}{" "}
                  → {skillName.get(row.skill_id) ?? "Skill"}
                </p>
                <p className="text-muted-foreground">
                  Required level:{" "}
                  {levelName.get(row.target_proficiency_level_id) ?? "Level"}
                  {row.mandatory ? " · Mandatory" : " · Optional"}
                </p>
                {row.evidence_requirement ? (
                  <p className="text-muted-foreground">
                    Evidence: {row.evidence_requirement}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          {current.status === "published" ? (
            <Button variant="outline" className="self-start" asChild>
              <AppLink href="/platform/skills/matrix">
                Open skills matrix
              </AppLink>
            </Button>
          ) : null}
        </section>
      )}
    </div>
  );
}
