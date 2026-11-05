import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { HARBOURFIELD_STORYLINE, HARBOURFIELD_USERS } from "./constants";
import {
  collectHarbourfieldDemoInventory,
  type HarbourfieldDemoInventory,
} from "./inventory";
import { formatHarbourfieldPlan, planHarbourfieldTopUp } from "./planner";
import { expectRpc } from "./rpc";
import type { UnitMap } from "./foundation";
import type { ResolvedHarbourfieldOrganisation } from "./resolve-org";

export type HarbourfieldClients = {
  admin: SupabaseClient;
  manager: SupabaseClient;
  operator: SupabaseClient;
  organisation: ResolvedHarbourfieldOrganisation;
  unitIds: UnitMap;
  managerMembershipId: string;
  operatorMembershipId: string | null;
};

async function signInAs(
  apiUrl: string,
  publishableKey: string,
  userKey: keyof typeof HARBOURFIELD_USERS,
) {
  const user = HARBOURFIELD_USERS[userKey];
  const client = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw (
      error ??
      new Error(`Unable to sign in ${user.email} for Harbourfield top-up.`)
    );
  }

  return client;
}

async function switchOrganisation(
  client: SupabaseClient,
  organisationId: string,
) {
  const { data, error } = await client.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw (
      error ??
      new Error("Unable to switch organisation for Harbourfield top-up.")
    );
  }
}

export async function buildHarbourfieldClients(options: {
  apiUrl: string;
  publishableKey: string;
  organisation: ResolvedHarbourfieldOrganisation;
}): Promise<HarbourfieldClients> {
  const adminClient = await signInAs(
    options.apiUrl,
    options.publishableKey,
    "admin",
  );

  let managerClient: SupabaseClient;
  let operatorClient: SupabaseClient;

  try {
    managerClient = await signInAs(
      options.apiUrl,
      options.publishableKey,
      "manager",
    );
    operatorClient = await signInAs(
      options.apiUrl,
      options.publishableKey,
      "operator",
    );
  } catch {
    managerClient = adminClient;
    operatorClient = adminClient;
  }

  for (const client of [adminClient, managerClient, operatorClient]) {
    await switchOrganisation(client, options.organisation.id);
  }

  const unitIds: UnitMap = {};
  const { data: units, error: unitsError } = await managerClient
    .from("organisation_units")
    .select("id, code");

  if (unitsError) {
    throw unitsError;
  }

  for (const unit of units ?? []) {
    unitIds[unit.code] = unit.id;
  }

  const resolveMembership = async (client: SupabaseClient, userId: string) => {
    const { data, error } = await client
      .from("organisation_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.id ?? null;
  };

  const managerMembershipId =
    (await resolveMembership(managerClient, HARBOURFIELD_USERS.manager.id)) ??
    (await resolveMembership(managerClient, HARBOURFIELD_USERS.admin.id));

  if (!managerMembershipId) {
    throw new Error(
      "Harbourfield demo top-up requires an active manager or admin membership.",
    );
  }

  const operatorMembershipId = await resolveMembership(
    operatorClient,
    HARBOURFIELD_USERS.operator.id,
  );

  return {
    admin: adminClient,
    manager: managerClient,
    operator: operatorClient,
    organisation: options.organisation,
    unitIds,
    managerMembershipId,
    operatorMembershipId,
  };
}

async function ensureSuggestionProgramme(manager: SupabaseClient) {
  const story = HARBOURFIELD_STORYLINE;
  const { count } = await manager
    .from("suggestion_programmes")
    .select("id", { count: "exact", head: true })
    .eq("code", story.suggestionProgrammeCode);

  if ((count ?? 0) > 0) {
    return;
  }

  const programmeId = (await expectRpc(
    manager,
    "create_suggestion_programme_draft",
    {
      target_name: story.suggestionProgrammeName,
      target_code: story.suggestionProgrammeCode,
      target_description:
        "Frontline improvement ideas for Bodmin Bakery demos.",
    },
  )) as string;

  const { data: version } = await manager
    .from("suggestion_programme_versions")
    .select("id")
    .eq("programme_id", programmeId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!version?.id) {
    throw new Error("Harbourfield suggestion programme version missing.");
  }

  await manager
    .from("suggestion_programme_versions")
    .update({ review_target_days: 7 })
    .eq("id", version.id);

  await expectRpc(manager, "publish_suggestion_programme_version", {
    target_programme_version_id: version.id,
  });

  await expectRpc(manager, "create_suggestion_category", {
    target_name: "Quality",
    target_code: "quality",
  });
}

async function ensureMaturityCatalog(
  manager: SupabaseClient,
  siteUnitId: string,
) {
  const story = HARBOURFIELD_STORYLINE;

  const { data: existingModel } = await manager
    .from("maturity_models")
    .select("id")
    .eq("display_name", story.maturityModelName)
    .maybeSingle();

  let modelVersionId: string | undefined;

  if (!existingModel?.id) {
    const modelId = (await expectRpc(manager, "create_maturity_model_draft", {
      target_display_name: story.maturityModelName,
      target_description:
        "Demonstration operating standard for Harbourfield Bodmin Bakery.",
    })) as string;

    const { data: version } = await manager
      .from("maturity_model_versions")
      .select("id")
      .eq("model_id", modelId)
      .eq("version_number", 1)
      .maybeSingle();

    if (!version?.id) {
      throw new Error("Harbourfield maturity version missing.");
    }

    modelVersionId = version.id;

    await expectRpc(manager, "add_maturity_level", {
      target_model_version_id: version.id,
      target_level_number: 1,
      target_name: "Initial",
      target_color_token: "maturity-1",
    });

    const pillarId = (await expectRpc(manager, "add_maturity_pillar", {
      target_model_version_id: version.id,
      target_name: "Daily Management",
      target_position: 1,
      target_section_title: "Daily Management",
    })) as string;

    const { data: pillarRow } = await manager
      .from("maturity_pillars")
      .select("section_id")
      .eq("id", pillarId)
      .maybeSingle();

    const criterionId = (await expectRpc(manager, "add_maturity_criterion", {
      target_pillar_id: pillarId,
      target_name: "Visual management",
      target_position: 1,
    })) as string;

    const questionId = (await expectRpc(manager, "add_maturity_question", {
      target_model_version_id: version.id,
      target_section_id: pillarRow?.section_id,
      target_question_type: "score",
      target_prompt: "Rate visual management on the packing line",
      target_position: 1,
      target_allows_not_applicable: true,
    })) as string;

    await expectRpc(manager, "link_criterion_question", {
      target_criterion_id: criterionId,
      target_question_id: questionId,
      target_contributes_to_score: true,
      target_scoring_metadata: { type: "direct" },
    });

    await expectRpc(manager, "publish_maturity_model_version", {
      target_model_version_id: version.id,
    });
  } else {
    const { data: version } = await manager
      .from("maturity_model_versions")
      .select("id")
      .eq("model_id", existingModel.id)
      .eq("status", "published")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    modelVersionId = version?.id;
  }

  if (!modelVersionId) {
    throw new Error("Harbourfield maturity model version unavailable.");
  }

  const { count: officialCount } = await manager
    .from("maturity_official_results")
    .select("id", { count: "exact", head: true });

  if ((officialCount ?? 0) === 0) {
    const assessmentId = (await expectRpc(
      manager,
      "start_maturity_assessment",
      {
        target_model_version_id: modelVersionId,
        target_unit_id: siteUnitId,
        target_assessment_type: "formal",
        target_assessment_scope_type: "site",
      },
    )) as string;

    const { data: links } = await manager
      .from("maturity_criterion_questions")
      .select("question_id")
      .limit(1);

    const questionId = links?.[0]?.question_id;
    if (questionId) {
      await expectRpc(manager, "upsert_maturity_assessment_answer", {
        target_assessment_id: assessmentId,
        target_question_id: questionId,
        target_number_value: 3.2,
      });
    }

    await expectRpc(manager, "submit_maturity_assessment", {
      target_assessment_id: assessmentId,
    });
    await expectRpc(manager, "begin_assessor_review", {
      target_assessment_id: assessmentId,
    });
    await expectRpc(manager, "approve_maturity_assessment", {
      target_assessment_id: assessmentId,
    });
    await expectRpc(manager, "publish_official_maturity_result", {
      target_assessment_id: assessmentId,
    });
  }

  const { count: selfCount } = await manager
    .from("maturity_assessments")
    .select("id", { count: "exact", head: true })
    .eq("assessment_type", "self")
    .in("status", ["draft", "in_progress", "submitted"]);

  if ((selfCount ?? 0) === 0) {
    await expectRpc(manager, "start_maturity_assessment", {
      target_model_version_id: modelVersionId,
      target_unit_id: siteUnitId,
      target_assessment_type: "self",
      target_assessment_scope_type: "site",
    });
  }
}

async function ensureFiveSCatalog(
  manager: SupabaseClient,
  lineUnitId: string,
  managerMembershipId: string,
) {
  const story = HARBOURFIELD_STORYLINE;

  let standardId: string | undefined;
  const { data: existingStandard } = await manager
    .from("five_s_standards")
    .select("id")
    .eq("display_name", story.fiveSStandardName)
    .maybeSingle();

  if (!existingStandard?.id) {
    standardId = (await expectRpc(manager, "create_five_s_standard_draft", {
      target_display_name: story.fiveSStandardName,
      target_description: "Packing area 5S programme for Bodmin Bakery demos.",
      target_threshold_percent: 85,
    })) as string;

    const { data: version } = await manager
      .from("five_s_standard_versions")
      .select("id")
      .eq("standard_id", standardId)
      .eq("version_number", 1)
      .maybeSingle();

    if (!version?.id) {
      throw new Error("Harbourfield 5S version missing.");
    }

    const sectionId = (await expectRpc(manager, "add_five_s_section", {
      target_standard_version_id: version.id,
      target_title: "Sort",
      target_position: 1,
    })) as string;

    await expectRpc(manager, "add_five_s_question", {
      target_standard_version_id: version.id,
      target_section_id: sectionId,
      target_question_type: "yes_no",
      target_prompt: "Is the film path free of clutter?",
      target_position: 1,
      target_contributes_to_score: true,
      target_scoring_metadata: { type: "yes_no", yes_value: 100, no_value: 0 },
    });

    await expectRpc(manager, "set_five_s_standard_applicable_units", {
      target_standard_id: standardId,
      target_unit_ids: [lineUnitId],
    });

    await expectRpc(manager, "publish_five_s_standard_version", {
      target_standard_version_id: version.id,
    });
  } else {
    standardId = existingStandard.id;
  }

  const { count: completedCount } = await manager
    .from("five_s_audits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  if ((completedCount ?? 0) === 0 && standardId) {
    const auditId = (await expectRpc(manager, "start_five_s_audit", {
      target_standard_id: standardId,
      target_unit_id: lineUnitId,
    })) as string;

    const { data: version } = await manager
      .from("five_s_standard_versions")
      .select("template_version_id")
      .eq("standard_id", standardId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: questions } = await manager
      .from("template_questions")
      .select("id")
      .eq("template_version_id", version?.template_version_id ?? "");

    for (const question of questions ?? []) {
      await expectRpc(manager, "upsert_five_s_audit_answer", {
        target_audit_id: auditId,
        target_question_id: question.id,
        target_text_value: "yes",
      });
    }

    await expectRpc(manager, "complete_five_s_audit", {
      target_audit_id: auditId,
    });
  }

  const { count: inProgressCount } = await manager
    .from("five_s_audits")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");

  if ((inProgressCount ?? 0) === 0 && standardId) {
    const auditId = (await expectRpc(manager, "start_five_s_audit", {
      target_standard_id: standardId,
      target_unit_id: lineUnitId,
    })) as string;

    await expectRpc(manager, "create_five_s_finding", {
      target_audit_id: auditId,
      target_observation: story.inProgressFiveSAuditNote,
      target_severity: "minor",
    });

    void managerMembershipId;
  }
}

async function ensureGembaCatalog(manager: SupabaseClient, lineUnitId: string) {
  const story = HARBOURFIELD_STORYLINE;

  let definitionId: string | undefined;
  const { data: existingDefinition } = await manager
    .from("gemba_definitions")
    .select("id")
    .eq("display_name", story.gembaDefinitionName)
    .maybeSingle();

  if (!existingDefinition?.id) {
    definitionId = (await expectRpc(manager, "create_gemba_definition_draft", {
      target_display_name: story.gembaDefinitionName,
      target_description: "Morning leadership Gemba for Bodmin Bakery packing.",
      target_expected_duration_minutes: 45,
    })) as string;

    const { data: version } = await manager
      .from("gemba_definition_versions")
      .select("id")
      .eq("definition_id", definitionId)
      .maybeSingle();

    if (version?.id) {
      const sectionId = (await expectRpc(manager, "add_gemba_section", {
        target_definition_version_id: version.id,
        target_title: "Packing Line 1",
        target_position: 1,
      })) as string;

      await expectRpc(manager, "add_gemba_question", {
        target_definition_version_id: version.id,
        target_section_id: sectionId,
        target_question_type: "long_text",
        target_prompt: "What did you observe on Packing Line 1?",
        target_position: 1,
      });

      await expectRpc(manager, "set_gemba_definition_applicable_units", {
        target_definition_id: definitionId,
        target_unit_ids: [lineUnitId],
      });

      await expectRpc(manager, "publish_gemba_definition_version", {
        target_definition_version_id: version.id,
      });
    }
  } else {
    definitionId = existingDefinition.id;
  }

  const { count: completedWalkCount } = await manager
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  if ((completedWalkCount ?? 0) === 0 && definitionId) {
    const walkId = (await expectRpc(manager, "start_gemba_walk", {
      target_definition_id: definitionId,
      target_unit_id: lineUnitId,
    })) as string;

    await expectRpc(manager, "create_gemba_observation", {
      target_walk_id: walkId,
      target_observation_text: story.gembaObservationText,
      target_observation_type: "issue",
    });

    const { data: walkRow } = await manager
      .from("gemba_walks")
      .select("definition_version_id")
      .eq("id", walkId)
      .maybeSingle();

    const { data: version } = await manager
      .from("gemba_definition_versions")
      .select("template_version_id")
      .eq("id", walkRow?.definition_version_id ?? "")
      .maybeSingle();

    const { data: questions } = await manager
      .from("template_questions")
      .select("id")
      .eq("template_version_id", version?.template_version_id ?? "");

    for (const question of questions ?? []) {
      await expectRpc(manager, "upsert_gemba_walk_answer", {
        target_walk_id: walkId,
        target_question_id: question.id,
        target_text_value: story.gembaWalkCompletedSummary,
      });
    }

    await expectRpc(manager, "complete_gemba_walk", {
      target_walk_id: walkId,
      target_summary_notes: story.gembaWalkCompletedSummary,
    });
  }

  const { count: inProgressWalkCount } = await manager
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");

  if ((inProgressWalkCount ?? 0) === 0 && definitionId) {
    await expectRpc(manager, "start_gemba_walk", {
      target_definition_id: definitionId,
      target_unit_id: lineUnitId,
    });
  }
}

async function ensureStoryActions(
  manager: SupabaseClient,
  lineUnitId: string,
  managerMembershipId: string,
) {
  const story = HARBOURFIELD_STORYLINE;
  const overdueDue = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: corrective } = await manager
    .from("actions")
    .select("id")
    .eq("title", story.correctiveActionTitle)
    .maybeSingle();

  if (!corrective?.id) {
    await expectRpc(manager, "create_action", {
      target_title: story.correctiveActionTitle,
      target_description:
        "Immediate containment from GEM-214 storyline — realign guide and verify first-off pack.",
      target_priority: "high",
      target_unit_id: lineUnitId,
      target_due_at: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  const { data: overdue } = await manager
    .from("actions")
    .select("id, due_at, status")
    .eq("title", story.overdueActionTitle)
    .maybeSingle();

  if (!overdue?.id) {
    const actionId = (await expectRpc(manager, "create_action", {
      target_title: story.overdueActionTitle,
      target_description:
        "Demo overdue action for manager home Needs attention strip.",
      target_priority: "normal",
      target_unit_id: lineUnitId,
      target_due_at: overdueDue,
    })) as string;

    await expectRpc(manager, "set_action_assignee", {
      target_action_id: actionId,
      target_membership_id: managerMembershipId,
    });
  } else if (overdue.status === "open" || overdue.status === "in_progress") {
    const due = overdue.due_at ? new Date(overdue.due_at) : new Date();
    if (due.getTime() >= Date.now()) {
      await expectRpc(manager, "update_action", {
        target_action_id: overdue.id,
        target_due_at: overdueDue,
        target_clear_due_at: false,
      });
    }
  }
}

async function ensureProblemSolvingStory(
  admin: SupabaseClient,
  manager: SupabaseClient,
  lineUnitId: string,
  managerMembershipId: string,
  operatorMembershipId: string | null,
) {
  const story = HARBOURFIELD_STORYLINE;

  await expectRpc(admin, "ensure_problem_solving_methods_provisioned", {});

  const catalog = (await expectRpc(
    manager,
    "get_problem_solving_methods",
    {},
  )) as {
    items?: Array<{ id: string; code: string }>;
  };
  const method = catalog.items?.find((row) => row.code === "a3-structured");

  if (!method?.id) {
    throw new Error("A3 structured method missing for Harbourfield PPS demo.");
  }

  let caseId: string | undefined;
  const { data: existingCase } = await manager
    .from("problem_solving_cases")
    .select("id, status")
    .eq("title", story.problemSolvingCaseTitle)
    .maybeSingle();

  if (!existingCase?.id) {
    caseId = (await expectRpc(manager, "create_problem_solving_case_draft", {
      target_title: story.problemSolvingCaseTitle,
      target_organisation_unit_id: lineUnitId,
      target_problem_statement:
        "Packaging film wanders on Packing Line 1 after splice events, causing misaligned packs.",
      target_background:
        "Recurring film-path issues observed during Bodmin Bakery morning Gemba.",
      target_business_impact:
        "Rework, scrap, and customer appearance risk on flow-wrapped products.",
      target_owner_membership_id: managerMembershipId,
      target_facilitator_membership_id: managerMembershipId,
      target_priority: "high",
      target_severity: "major",
    })) as string;

    await expectRpc(manager, "activate_problem_solving_case", {
      target_case_id: caseId,
      target_method_id: method.id,
    });
  } else {
    caseId = existingCase.id;
    if (existingCase.status === "draft") {
      await expectRpc(manager, "activate_problem_solving_case", {
        target_case_id: caseId,
        target_method_id: method.id,
      });
    }
  }

  if (operatorMembershipId) {
    await expectRpc(manager, "add_problem_solving_participant", {
      target_case_id: caseId,
      target_membership_id: operatorMembershipId,
      target_participant_role: "contributor",
    });
  }

  const { count: sessionCount } = await manager
    .from("problem_solving_sessions")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("status", "in_progress");

  if ((sessionCount ?? 0) === 0) {
    const sessionId = (await expectRpc(
      manager,
      "start_problem_solving_session",
      {
        target_case_id: caseId,
        target_title: story.problemSolvingSessionTitle,
        target_facilitator_membership_id: managerMembershipId,
      },
    )) as string;

    await expectRpc(manager, "add_session_entry", {
      target_session_id: sessionId,
      target_entry_type: "note",
      target_body:
        "Review film guide alignment evidence from the latest Gemba walk and containment actions.",
    });
  }
}

async function ensureProjectAndBenefit(
  admin: SupabaseClient,
  manager: SupabaseClient,
  lineUnitId: string,
  managerMembershipId: string,
) {
  const story = HARBOURFIELD_STORYLINE;

  let projectId: string | undefined;
  const { data: existingProject } = await manager
    .from("ci_projects")
    .select("id, status")
    .eq("title", story.projectTitle)
    .maybeSingle();

  if (!existingProject?.id) {
    projectId = (await expectRpc(manager, "create_improvement_project", {
      target_title: story.projectTitle,
      target_unit_id: lineUnitId,
      target_problem_statement:
        "Film path countermeasures to sustain alignment on Packing Line 1.",
      target_objective:
        "Trial redesigned film guide and verify sustained performance.",
    })) as string;
  } else {
    projectId = existingProject.id;
  }

  const { data: existingBenefit } = await manager
    .from("improvement_benefits")
    .select("id, status")
    .eq("title", story.benefitTitle)
    .maybeSingle();

  if (existingBenefit?.id && existingBenefit.status !== "draft") {
    return;
  }

  const { data: category } = await manager
    .from("benefit_categories")
    .select("id")
    .eq("code", "quality")
    .maybeSingle();

  let categoryId = category?.id;
  if (!categoryId) {
    try {
      categoryId = (await expectRpc(admin, "create_benefit_category", {
        target_code: "quality",
        target_name: "Quality",
        target_display_order: 3,
      })) as string;
    } catch {
      const { data: retryCategory } = await admin
        .from("benefit_categories")
        .select("id")
        .eq("code", "quality")
        .maybeSingle();
      categoryId = retryCategory?.id;
    }
  }

  if (!categoryId) {
    throw new Error("Harbourfield quality benefit category is unavailable.");
  }

  let benefitId = existingBenefit?.id;
  if (!benefitId) {
    benefitId = (await expectRpc(manager, "create_benefit_draft", {
      target_title: story.benefitTitle,
      target_organisational_unit_id: lineUnitId,
      target_benefit_class: "non_financial",
      target_non_financial_type: "quality",
      target_category_id: categoryId,
      target_owner_membership_id: managerMembershipId,
      target_is_standalone_initiative: true,
      target_description:
        "Qualitative quality improvement linked to PRJ-042 storyline — awaiting validation.",
    })) as string;

    await expectRpc(manager, "update_benefit_draft", {
      target_benefit_id: benefitId,
      target_title: story.benefitTitle,
      target_description:
        "Qualitative quality improvement — awaiting validation (no verified savings).",
      target_category_id: categoryId,
      target_organisational_unit_id: lineUnitId,
      target_owner_membership_id: managerMembershipId,
      target_baseline_description:
        "Film misalignment complaints and rework on Packing Line 1.",
      target_baseline_measure_value: 12,
      target_baseline_measure_unit: "events/month",
    });
  }

  const { count: submittedForecastCount } = await manager
    .from("benefit_forecast_versions")
    .select("id", { count: "exact", head: true })
    .eq("benefit_id", benefitId)
    .eq("status", "submitted");

  if ((submittedForecastCount ?? 0) === 0) {
    const forecastVersionId = (await expectRpc(
      manager,
      "create_benefit_forecast_draft",
      {
        target_benefit_id: benefitId,
        target_realisation_pattern: "one_off",
        target_forecast_start_date: "2026-01-01",
        target_forecast_end_date: "2026-06-30",
        target_target_measure_value: 6,
        target_target_measure_unit: "events/month",
        target_target_date: "2026-06-30",
      },
    )) as string;

    await expectRpc(manager, "submit_benefit_forecast", {
      target_forecast_version_id: forecastVersionId,
    });
  }

  if (existingBenefit?.status === "draft" || !existingBenefit) {
    await expectRpc(manager, "submit_benefit", {
      target_benefit_id: benefitId,
      target_ci_validator_membership_id: managerMembershipId,
    });
  }

  void projectId;
}

async function ensureSuggestionAwaitingReview(
  admin: SupabaseClient,
  submitter: SupabaseClient,
) {
  const story = HARBOURFIELD_STORYLINE;

  const { count: existingCount } = await submitter
    .from("improvement_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("title", story.suggestionTitle);

  if ((existingCount ?? 0) > 0) {
    return;
  }

  const { data: programmeVersion } = await admin
    .from("suggestion_programme_versions")
    .select("id")
    .eq("lifecycle", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: category } = await admin
    .from("suggestion_categories")
    .select("id")
    .eq("code", "quality")
    .maybeSingle();

  if (!programmeVersion?.id || !category?.id) {
    throw new Error(
      "Harbourfield suggestion programme must exist before seeding awaiting-review idea.",
    );
  }

  const draftId = (await expectRpc(submitter, "create_suggestion_draft", {
    target_programme_version_id: programmeVersion.id,
    target_category_id: category.id,
    target_title: story.suggestionTitle,
    target_problem_or_opportunity:
      "Film splice checklist does not prompt guide alignment check.",
    target_proposed_idea:
      "Add explicit film guide alignment verification to the splice checklist.",
    target_expected_benefit_summary: "Fewer misalignment events after splice.",
  })) as string;

  await expectRpc(submitter, "submit_suggestion", {
    target_suggestion_id: draftId,
  });
}

async function ensureOperatorPrimaryPlacement(
  admin: SupabaseClient,
  operatorMembershipId: string | null,
  lineUnitId: string,
) {
  if (!operatorMembershipId) {
    return;
  }

  const { count: placementCount } = await admin
    .from("membership_job_function_assignments")
    .select("id", { count: "exact", head: true })
    .eq("membership_id", operatorMembershipId)
    .eq("is_primary", true)
    .is("valid_to", null);

  if ((placementCount ?? 0) > 0) {
    return;
  }

  let jobFunctionId: string | undefined;
  const { data: existingJobFunction } = await admin
    .from("job_functions")
    .select("id")
    .eq("code", "packing-operator")
    .maybeSingle();

  if (existingJobFunction?.id) {
    jobFunctionId = existingJobFunction.id;
  } else {
    jobFunctionId = (await expectRpc(admin, "create_job_function", {
      target_code: "packing-operator",
      target_name: "Packing Operator",
    })) as string;
  }

  await expectRpc(admin, "assign_membership_job_function", {
    target_membership_id: operatorMembershipId,
    target_job_function_id: jobFunctionId,
    target_primary: true,
    target_organisational_unit_id: lineUnitId,
  });
}

async function applyHarbourfieldStoryline(clients: HarbourfieldClients) {
  const lineUnitId =
    clients.unitIds["packing-line-1"] ?? clients.unitIds.packing;
  const siteUnitId = clients.unitIds["bodmin-bakery"] ?? lineUnitId;

  if (!lineUnitId || !siteUnitId) {
    throw new Error(
      "Harbourfield demo top-up requires bodmin-bakery and packing-line-1 units.",
    );
  }

  await ensureOperatorPrimaryPlacement(
    clients.admin,
    clients.operatorMembershipId,
    lineUnitId,
  );

  await ensureSuggestionProgramme(clients.admin);
  await ensureMaturityCatalog(clients.admin, siteUnitId);
  await ensureFiveSCatalog(
    clients.admin,
    lineUnitId,
    clients.managerMembershipId,
  );
  await ensureGembaCatalog(clients.admin, lineUnitId);
  await ensureStoryActions(
    clients.manager,
    lineUnitId,
    clients.managerMembershipId,
  );
  await ensureProblemSolvingStory(
    clients.admin,
    clients.manager,
    lineUnitId,
    clients.managerMembershipId,
    clients.operatorMembershipId,
  );
  await ensureProjectAndBenefit(
    clients.admin,
    clients.manager,
    lineUnitId,
    clients.managerMembershipId,
  );
  await ensureSuggestionAwaitingReview(clients.admin, clients.operator);
}

export async function runHarbourfieldTopUp(options: {
  apiUrl: string;
  publishableKey: string;
  organisation: ResolvedHarbourfieldOrganisation;
  mode: "dry-run" | "apply";
}) {
  const clients = await buildHarbourfieldClients({
    apiUrl: options.apiUrl,
    publishableKey: options.publishableKey,
    organisation: options.organisation,
  });

  const inventory = await collectHarbourfieldDemoInventory(clients.manager);
  const planned = planHarbourfieldTopUp(inventory);
  const label = `${options.organisation.name} (${options.organisation.code})`;
  const planText = formatHarbourfieldPlan(planned, label);

  if (options.mode === "dry-run") {
    return { planText, inventory, planned, applied: false };
  }

  if (planned.length > 0) {
    await applyHarbourfieldStoryline(clients);
  }

  const after = await collectHarbourfieldDemoInventory(clients.manager);
  return { planText, inventory, planned, applied: true, after };
}

export type { HarbourfieldDemoInventory };
