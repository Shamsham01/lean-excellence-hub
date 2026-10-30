import { skillsAuthoringOwner } from "./skills-authoring-org";

export type SkillsSetupSnapshot = {
  bundles: Array<{
    id: string;
    status: string;
    title: string;
    source: string;
    applicability: string;
    idempotencyKey: string;
    capabilitySetVersionId: string | null;
    scaleVersionId: string | null;
  }>;
  requirements: Array<{
    id: string;
    capabilitySetVersionId: string;
    skillId: string;
    skillName: string;
    skillStatus: string;
    unitId: string | null;
    unitName: string | null;
    levelId: string;
    levelLabel: string;
  }>;
  assessments: Array<{
    id: string;
    skillId: string;
    levelId: string;
    notes: string | null;
    status: string;
  }>;
  scaleVersions: Array<{ id: string; status: string }>;
};

type BundleRow = {
  id: string;
  status: string;
  title: string;
  source: string;
  applicability: string;
  idempotency_key: string;
  capability_set_version_id: string | null;
  scale_version_id: string | null;
};

type RequirementRow = {
  id: string;
  capability_set_version_id: string;
  skill_id: string;
  organisational_unit_id: string | null;
  target_proficiency_level_id: string;
};

export async function readSkillsPreparation(
  organisationId: string,
  source: "manual" | "quick_start" | "leanai",
  templateKey: string,
) {
  const owner = await skillsAuthoringOwner(organisationId);
  const { data, error } = await owner
    .from("skill_setup_preparations")
    .select("state")
    .eq("source", source)
    .eq("template_key", templateKey)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data?.state ?? null;
}

export async function readSkillsSetupSnapshot(
  organisationId: string,
): Promise<SkillsSetupSnapshot> {
  const owner = await skillsAuthoringOwner(organisationId);
  const { data: bundles, error: bundleError } = await owner
    .from("skill_setup_bundles")
    .select(
      "id, status, title, source, applicability, idempotency_key, capability_set_version_id, scale_version_id",
    )
    .order("created_at");
  if (bundleError) {
    throw bundleError;
  }
  const bundleRows = (bundles ?? []) as BundleRow[];
  const versionIds = bundleRows
    .map((bundle) => bundle.capability_set_version_id)
    .filter((id): id is string => Boolean(id));
  const scaleIds = bundleRows
    .map((bundle) => bundle.scale_version_id)
    .filter((id): id is string => Boolean(id));

  const { data: requirementRows, error: requirementError } = versionIds.length
    ? await owner
        .from("skill_requirements")
        .select(
          "id, capability_set_version_id, skill_id, organisational_unit_id, target_proficiency_level_id",
        )
        .in("capability_set_version_id", versionIds)
    : { data: [], error: null };
  if (requirementError) {
    throw requirementError;
  }
  const requirements = (requirementRows ?? []) as RequirementRow[];
  const skillIds = [...new Set(requirements.map((row) => row.skill_id))];
  const unitIds = [
    ...new Set(
      requirements
        .map((row) => row.organisational_unit_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const levelIds = [
    ...new Set(requirements.map((row) => row.target_proficiency_level_id)),
  ];

  const [
    { data: skills, error: skillError },
    { data: units, error: unitError },
    { data: levels, error: levelError },
    { data: assessments, error: assessmentError },
    { data: scaleVersions, error: scaleError },
  ] = await Promise.all([
    skillIds.length
      ? owner.from("skills").select("id, name, status").in("id", skillIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? owner.from("organisation_units").select("id, name").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    levelIds.length
      ? owner
          .from("skill_proficiency_levels")
          .select("id, label")
          .in("id", levelIds)
      : Promise.resolve({ data: [], error: null }),
    owner
      .from("membership_skill_assessments")
      .select("id, skill_id, proficiency_level_id, notes, status"),
    scaleIds.length
      ? owner
          .from("skill_proficiency_scale_versions")
          .select("id, status")
          .in("id", scaleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const queryError =
    skillError ?? unitError ?? levelError ?? assessmentError ?? scaleError;
  if (queryError) {
    throw queryError;
  }

  const skillById = new Map(
    ((skills ?? []) as Array<{ id: string; name: string; status: string }>).map(
      (skill) => [skill.id, skill],
    ),
  );
  const unitById = new Map(
    ((units ?? []) as Array<{ id: string; name: string }>).map((unit) => [
      unit.id,
      unit.name,
    ]),
  );
  const levelById = new Map(
    ((levels ?? []) as Array<{ id: string; label: string }>).map((level) => [
      level.id,
      level.label,
    ]),
  );

  return {
    bundles: bundleRows.map((bundle) => ({
      id: bundle.id,
      status: bundle.status,
      title: bundle.title,
      source: bundle.source,
      applicability: bundle.applicability,
      idempotencyKey: bundle.idempotency_key,
      capabilitySetVersionId: bundle.capability_set_version_id,
      scaleVersionId: bundle.scale_version_id,
    })),
    requirements: requirements.map((requirement) => {
      const skill = skillById.get(requirement.skill_id);
      return {
        id: requirement.id,
        capabilitySetVersionId: requirement.capability_set_version_id,
        skillId: requirement.skill_id,
        skillName: skill?.name ?? "",
        skillStatus: skill?.status ?? "",
        unitId: requirement.organisational_unit_id,
        unitName: requirement.organisational_unit_id
          ? (unitById.get(requirement.organisational_unit_id) ?? null)
          : null,
        levelId: requirement.target_proficiency_level_id,
        levelLabel:
          levelById.get(requirement.target_proficiency_level_id) ?? "",
      };
    }),
    assessments: (
      (assessments ?? []) as Array<{
        id: string;
        skill_id: string;
        proficiency_level_id: string;
        notes: string | null;
        status: string;
      }>
    ).map((assessment) => ({
      id: assessment.id,
      skillId: assessment.skill_id,
      levelId: assessment.proficiency_level_id,
      notes: assessment.notes,
      status: assessment.status,
    })),
    scaleVersions: (
      (scaleVersions ?? []) as Array<{ id: string; status: string }>
    ).map((version) => ({ id: version.id, status: version.status })),
  };
}

export function requirementsForBundle(
  snapshot: SkillsSetupSnapshot,
  bundleId: string,
) {
  const bundle = snapshot.bundles.find((item) => item.id === bundleId);
  if (!bundle?.capabilitySetVersionId) {
    return [];
  }
  return snapshot.requirements.filter(
    (requirement) =>
      requirement.capabilitySetVersionId === bundle.capabilitySetVersionId,
  );
}

export async function recordPublishedSkillsAssessment(input: {
  organisationId: string;
  bundleId: string;
  notes: string;
}) {
  const owner = await skillsAuthoringOwner(input.organisationId);
  const { data: bundle, error: bundleError } = await owner
    .from("skill_setup_bundles")
    .select("status, scale_version_id, capability_set_version_id")
    .eq("id", input.bundleId)
    .single();
  if (bundleError || !bundle) {
    throw bundleError ?? new Error("Published bundle was not found");
  }
  if (
    bundle.status !== "published" ||
    !bundle.scale_version_id ||
    !bundle.capability_set_version_id
  ) {
    throw new Error("Assessment requires a published setup bundle");
  }
  const { data: requirement, error: requirementError } = await owner
    .from("skill_requirements")
    .select("skill_id, target_proficiency_level_id, organisational_unit_id")
    .eq("capability_set_version_id", bundle.capability_set_version_id)
    .limit(1)
    .single();
  if (requirementError || !requirement) {
    throw requirementError ?? new Error("Published requirement was not found");
  }
  const { data: organisations, error: organisationError } = await owner.rpc(
    "list_my_eligible_organisations",
  );
  if (organisationError) {
    throw organisationError;
  }
  const membershipId = (
    organisations as Array<{
      organisation_id: string;
      membership_id: string;
    }> | null
  )?.find(
    (organisation) => organisation.organisation_id === input.organisationId,
  )?.membership_id;
  if (!membershipId) {
    throw new Error("Owner membership was not found");
  }
  const { data: assessmentId, error: assessmentError } = await owner.rpc(
    "record_skill_validation",
    {
      target_membership_id: membershipId,
      target_skill_id: requirement.skill_id,
      target_proficiency_scale_version_id: bundle.scale_version_id,
      target_proficiency_level_id: requirement.target_proficiency_level_id,
      target_organisational_unit_id:
        requirement.organisational_unit_id ?? undefined,
      target_notes: input.notes,
    },
  );
  if (assessmentError || !assessmentId) {
    throw assessmentError ?? new Error("Assessment was not recorded");
  }
  return {
    assessmentId,
    skillId: requirement.skill_id,
    levelId: requirement.target_proficiency_level_id,
    notes: input.notes,
  };
}
