import type { SupabaseClient } from "@supabase/supabase-js";

import { expectRpc } from "./shared/auth";
import { switchOrganisation, type UnitMap } from "./shared/organisation";

export type CookieWorksModuleFixtureSnapshot = {
  maturityModels: number;
  fiveSStandards: number;
  gembaDefinitions: number;
  scheduleDefinitions: number;
  trainingCourses: number;
  ciProjects: number;
  problemSolvingCases: number;
  comments: number;
  attachments: number;
};

async function countRows(client: SupabaseClient, table: string, column = "id") {
  const { count, error } = await client
    .from(table)
    .select(column, { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function collectCookieWorksModuleFixtureSnapshot(
  client: SupabaseClient,
): Promise<CookieWorksModuleFixtureSnapshot> {
  return {
    maturityModels: await countRows(client, "maturity_models"),
    fiveSStandards: await countRows(client, "five_s_standards"),
    gembaDefinitions: await countRows(client, "gemba_definitions"),
    scheduleDefinitions: await countRows(client, "schedule_definitions"),
    trainingCourses: await countRows(client, "training_courses"),
    ciProjects: await countRows(client, "ci_projects"),
    problemSolvingCases: await countRows(client, "problem_solving_cases"),
    comments: await countRows(client, "comments"),
    attachments: await countRows(client, "attachments"),
  };
}

export function assertModuleFixturesPresent(
  snapshot: CookieWorksModuleFixtureSnapshot,
) {
  const required: Array<[keyof CookieWorksModuleFixtureSnapshot, number]> = [
    ["maturityModels", 1],
    ["fiveSStandards", 1],
    ["gembaDefinitions", 1],
    ["scheduleDefinitions", 1],
    ["trainingCourses", 1],
    ["ciProjects", 1],
    ["problemSolvingCases", 1],
    ["attachments", 1],
  ];

  for (const [key, minimum] of required) {
    if (snapshot[key] < minimum) {
      throw new Error(
        `CookieWorks module fixture missing ${String(key)} (expected >= ${minimum}, got ${snapshot[key]})`,
      );
    }
  }
}

export async function seedCookieWorksModuleFixtures(options: {
  adminClient: SupabaseClient;
  ciManagerClient: SupabaseClient;
  assessorClient: SupabaseClient;
  unitIds: UnitMap;
  organisationId: string;
}) {
  for (const client of [
    options.adminClient,
    options.ciManagerClient,
    options.assessorClient,
  ]) {
    await switchOrganisation(client, options.organisationId);
  }

  const operationsUnitId = options.unitIds.operations;
  if (!operationsUnitId) {
    throw new Error(
      "CookieWorks operations unit is required for module fixtures.",
    );
  }

  const { data: managerMembership } = await options.ciManagerClient
    .from("organisation_memberships")
    .select("id")
    .limit(1)
    .single();

  if (!managerMembership?.id) {
    throw new Error("CookieWorks memberships missing for module fixtures.");
  }

  const fixtureSuffix = `${Date.now()}`;

  const modelId = (await expectRpc(
    options.ciManagerClient,
    "create_maturity_model_draft",
    {
      target_display_name: "QA CookieWorks Maturity Framework",
      target_description: "Integration-test maturity framework.",
    },
  )) as string;

  const { data: version } = await options.ciManagerClient
    .from("maturity_model_versions")
    .select("id")
    .eq("model_id", modelId)
    .eq("version_number", 1)
    .single();

  if (!version?.id) {
    throw new Error("Maturity model version missing for QA fixtures.");
  }

  await expectRpc(options.ciManagerClient, "add_maturity_level", {
    target_model_version_id: version.id,
    target_level_number: 1,
    target_name: "Initial",
    target_color_token: "slate",
  });

  const pillarId = (await expectRpc(
    options.ciManagerClient,
    "add_maturity_pillar",
    {
      target_model_version_id: version.id,
      target_name: "Operations",
      target_position: 1,
      target_section_title: "Operations",
    },
  )) as string;

  const { data: pillarRow } = await options.ciManagerClient
    .from("maturity_pillars")
    .select("section_id")
    .eq("id", pillarId)
    .single();

  const criterionId = (await expectRpc(
    options.ciManagerClient,
    "add_maturity_criterion",
    {
      target_pillar_id: pillarId,
      target_name: "Standard work",
      target_position: 1,
    },
  )) as string;

  const questionId = (await expectRpc(
    options.ciManagerClient,
    "add_maturity_question",
    {
      target_model_version_id: version.id,
      target_section_id: pillarRow?.section_id,
      target_question_type: "score",
      target_prompt: "Rate standard work adherence",
      target_position: 1,
      target_allows_not_applicable: true,
    },
  )) as string;

  await expectRpc(options.ciManagerClient, "link_criterion_question", {
    target_criterion_id: criterionId,
    target_question_id: questionId,
    target_contributes_to_score: true,
    target_scoring_metadata: { type: "direct" },
  });

  await expectRpc(options.ciManagerClient, "publish_maturity_model_version", {
    target_model_version_id: version.id,
  });

  const fiveSStandardId = (await expectRpc(
    options.ciManagerClient,
    "create_five_s_standard_draft",
    {
      target_display_name: "QA CookieWorks 5S Standard",
      target_description: "Integration-test 5S standard.",
      target_threshold_percent: 90,
    },
  )) as string;

  const { data: fiveSVersion } = await options.ciManagerClient
    .from("five_s_standard_versions")
    .select("id")
    .eq("standard_id", fiveSStandardId)
    .eq("version_number", 1)
    .single();

  if (!fiveSVersion?.id) {
    throw new Error("5S version missing for QA fixtures.");
  }

  const sectionId = (await expectRpc(
    options.ciManagerClient,
    "add_five_s_section",
    {
      target_standard_version_id: fiveSVersion.id,
      target_title: "Sort",
      target_position: 1,
    },
  )) as string;

  await expectRpc(options.ciManagerClient, "add_five_s_question", {
    target_standard_version_id: fiveSVersion.id,
    target_section_id: sectionId,
    target_question_type: "yes_no",
    target_prompt: "Is the area sorted?",
    target_position: 1,
    target_contributes_to_score: true,
    target_scoring_metadata: { type: "yes_no", yes_value: 100, no_value: 0 },
  });

  await expectRpc(options.ciManagerClient, "publish_five_s_standard_version", {
    target_standard_version_id: fiveSVersion.id,
  });

  const gembaDefinitionId = (await expectRpc(
    options.ciManagerClient,
    "create_gemba_definition_draft",
    {
      target_display_name: "QA CookieWorks Gemba",
      target_description: "Integration-test gemba walk.",
      target_expected_duration_minutes: 30,
    },
  )) as string;

  const { data: gembaVersion } = await options.ciManagerClient
    .from("gemba_definition_versions")
    .select("id")
    .eq("definition_id", gembaDefinitionId)
    .maybeSingle();

  if (gembaVersion?.id) {
    const gembaSectionId = (await expectRpc(
      options.ciManagerClient,
      "add_gemba_section",
      {
        target_definition_version_id: gembaVersion.id,
        target_title: "Production floor",
        target_position: 1,
      },
    )) as string;

    await expectRpc(options.ciManagerClient, "add_gemba_question", {
      target_definition_version_id: gembaVersion.id,
      target_section_id: gembaSectionId,
      target_question_type: "long_text",
      target_prompt: "What did you observe?",
      target_position: 1,
    });

    await expectRpc(
      options.ciManagerClient,
      "publish_gemba_definition_version",
      {
        target_definition_version_id: gembaVersion.id,
      },
    );
  }

  await expectRpc(options.ciManagerClient, "create_schedule_definition", {
    target_activity_resource_id: fiveSStandardId,
    target_title: "QA Weekly 5S",
    target_unit_id: operationsUnitId,
    target_owner_membership_id: managerMembership.id,
    target_recurrence: {
      frequency: "weekly",
      interval: 1,
      weekdays: ["monday"],
    },
    target_start_date: new Date().toISOString().slice(0, 10),
    target_is_all_day: true,
  });

  const courseId = (await expectRpc(
    options.ciManagerClient,
    "create_training_course_draft",
    {
      target_name: `QA CookieWorks Safety Refresher ${fixtureSuffix}`,
      target_code: `qa-safety-refresher-${fixtureSuffix}`,
      target_description: "Integration-test training course.",
    },
  )) as string;

  const { data: courseVersion } = await options.ciManagerClient
    .from("training_course_versions")
    .select("id")
    .eq("course_id", courseId)
    .eq("version_number", 1)
    .single();

  if (!courseVersion?.id) {
    throw new Error("Training course version missing for QA fixtures.");
  }

  await expectRpc(options.ciManagerClient, "publish_training_course_version", {
    target_course_version_id: courseVersion.id,
  });

  const methodologyId = (await expectRpc(
    options.ciManagerClient,
    "create_ci_project_methodology_draft",
    {
      target_name: `QA DMAIC ${fixtureSuffix}`,
      target_code: `qa-dmaic-${fixtureSuffix}`,
      target_description: "Integration-test methodology.",
    },
  )) as string;

  const { data: methodologyVersion } = await options.ciManagerClient
    .from("ci_project_methodology_versions")
    .select("id")
    .eq("methodology_id", methodologyId)
    .eq("version_number", 1)
    .single();

  if (!methodologyVersion?.id) {
    throw new Error("CI methodology version missing for QA fixtures.");
  }

  await expectRpc(options.ciManagerClient, "add_ci_project_methodology_phase", {
    target_methodology_version_id: methodologyVersion.id,
    target_phase_key: "define",
    target_title: "Define",
    target_display_order: 1,
  });

  await expectRpc(
    options.ciManagerClient,
    "publish_ci_project_methodology_version",
    {
      target_methodology_version_id: methodologyVersion.id,
    },
  );

  const projectId = (await expectRpc(
    options.ciManagerClient,
    "create_improvement_project",
    {
      target_title: "QA CookieWorks CI Project",
      target_unit_id: operationsUnitId,
      target_problem_statement: "Fixture CI problem.",
      target_objective: "Fixture CI objective.",
    },
  )) as string;

  await expectRpc(options.ciManagerClient, "update_ci_project_draft", {
    target_project_id: projectId,
    target_methodology_version_id: methodologyVersion.id,
  });

  await expectRpc(options.adminClient, "create_comment", {
    target_resource_id: projectId,
    target_body: "QA fixture comment on CI project.",
  });

  const { data: uploadRows, error: uploadError } =
    await options.adminClient.rpc("initiate_attachment_upload", {
      target_resource_id: projectId,
      target_filename: "qa-fixture-evidence.pdf",
      target_mime_type: "application/pdf",
      target_byte_size: 1024,
    });

  if (uploadError) {
    throw uploadError;
  }

  const uploadRow = uploadRows?.[0];
  if (!uploadRow?.attachment_id) {
    throw new Error("Attachment upload fixture did not return attachment_id.");
  }

  await expectRpc(options.adminClient, "confirm_attachment_upload", {
    target_attachment_id: uploadRow.attachment_id,
  });

  await expectRpc(
    options.ciManagerClient,
    "ensure_problem_solving_methods_provisioned",
    {},
  );

  const caseId = (await expectRpc(
    options.ciManagerClient,
    "create_problem_solving_case_draft",
    {
      target_title: "QA CookieWorks Problem Case",
      target_organisation_unit_id: operationsUnitId,
      target_problem_statement: "Fixture problem statement.",
      target_owner_membership_id: managerMembership.id,
      target_facilitator_membership_id: managerMembership.id,
    },
  )) as string;

  void caseId;

  const snapshot = await collectCookieWorksModuleFixtureSnapshot(
    options.adminClient,
  );
  assertModuleFixturesPresent(snapshot);

  return snapshot;
}
