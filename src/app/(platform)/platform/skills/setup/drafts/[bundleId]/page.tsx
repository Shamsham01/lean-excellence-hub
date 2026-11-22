import { notFound } from "next/navigation";

import { DiscardSetupDraft } from "@/components/skills/setup/discard-setup-draft";
import { PublishSetupDraft } from "@/components/skills/setup/publish-setup-draft";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { describeRequirementApplicability } from "@/modules/skills/setup/definition";
import { skillsSetupUnitOptions } from "@/modules/skills/setup/unit-options";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SkillsSetupDraftPage({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  const { bundleId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: bundle } = await supabase
    .from("skill_setup_bundles")
    .select(
      "id, title, status, source, sample, applicability, unresolved, capability_set_version_id, scale_version_id",
    )
    .eq("id", bundleId)
    .maybeSingle();
  if (!bundle) {
    notFound();
  }
  const [{ data: requirements }, { data: levels }, preview] = await Promise.all(
    [
      supabase
        .from("skill_requirements")
        .select(
          "id, skill_id, job_function_id, organisational_unit_id, target_proficiency_level_id, notes",
        )
        .eq(
          "capability_set_version_id",
          bundle.capability_set_version_id ?? "",
        ),
      supabase
        .from("skill_proficiency_levels")
        .select("id, label")
        .eq("scale_version_id", bundle.scale_version_id ?? ""),
      supabase.rpc("preview_skill_setup_bundle_discard", {
        target_bundle_id: bundleId,
      }),
    ],
  );
  const skillIds = [
    ...new Set((requirements ?? []).map((row) => row.skill_id)),
  ];
  const jobIds = [
    ...new Set(
      (requirements ?? [])
        .map((row) => row.job_function_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [{ data: skills }, { data: jobs }, { data: units }] = await Promise.all(
    [
      skillIds.length
        ? supabase.from("skills").select("id, name").in("id", skillIds)
        : Promise.resolve({ data: [] }),
      jobIds.length
        ? supabase.from("job_functions").select("id, name").in("id", jobIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("organisation_units")
        .select("id, name, parent_unit_id")
        .eq("status", "active"),
    ],
  );
  const skillName = new Map((skills ?? []).map((row) => [row.id, row.name]));
  const jobName = new Map((jobs ?? []).map((row) => [row.id, row.name]));
  const unitName = new Map(
    skillsSetupUnitOptions(units ?? []).map((row) => [row.id, row.path]),
  );
  const levelName = new Map((levels ?? []).map((row) => [row.id, row.label]));
  const impact = (preview.data ?? { removed: [], retained: [] }) as {
    removed?: Array<{ kind: string; label: string }>;
    retained?: Array<{ kind: string; label: string; reason: string }>;
  };

  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      data-testid="skills-draft-review"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {bundle.status === "published" ? "Published" : "Draft"} ·{" "}
          {bundle.source}
          {bundle.sample ? " · Sample" : ""}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
          {bundle.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {bundle.applicability === "organisation"
            ? "Requirements follow the job function across the organisation. The catalogue is organisation-owned either way."
            : "Requirements apply only to the units confirmed below. The catalogue remains organisation-owned."}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {(requirements ?? []).map((requirement) => (
          <li
            key={requirement.id}
            className="text-sm [overflow-wrap:anywhere]"
            data-testid="skills-draft-requirement"
          >
            {describeRequirementApplicability({
              jobFunctionName: requirement.job_function_id
                ? (jobName.get(requirement.job_function_id) ?? "Job function")
                : "Job function",
              skillName: skillName.get(requirement.skill_id) ?? "Skill",
              levelLabel:
                levelName.get(requirement.target_proficiency_level_id) ??
                "level",
              unitName: requirement.organisational_unit_id
                ? (unitName.get(requirement.organisational_unit_id) ?? null)
                : null,
            })}
          </li>
        ))}
      </ul>
      {Array.isArray(bundle.unresolved) && bundle.unresolved.length > 0 ? (
        <p className="text-sm" data-testid="skills-unresolved-roles">
          Unresolved roles were not turned into requirements. Map them in a new
          draft if you still need them.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Not assessed means there is no validated assessment. It is not a low
        score. Publishing does not mark anyone competent.
      </p>
      <div className="flex w-full max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        {bundle.status === "draft" ? (
          <PublishSetupDraft bundleId={bundle.id} />
        ) : (
          <Button
            className="w-full max-w-full whitespace-normal sm:w-auto"
            asChild
          >
            <AppLink href="/platform/skills/matrix">Open skills matrix</AppLink>
          </Button>
        )}
        {bundle.status === "draft" ? (
          <DiscardSetupDraft
            bundleId={bundle.id}
            impact={{
              removed: impact.removed ?? [],
              retained: impact.retained ?? [],
            }}
          />
        ) : null}
        <Button
          variant="outline"
          className="w-full max-w-full whitespace-normal sm:w-auto"
          asChild
        >
          <AppLink href="/platform/skills">Back to Skills</AppLink>
        </Button>
      </div>
    </div>
  );
}
