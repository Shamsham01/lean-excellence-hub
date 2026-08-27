import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DEMO_BENEFIT_CATEGORIES,
  DEMO_BENEFITS,
  DEMO_CI_METHODOLOGIES,
  DEMO_CI_PROJECTS,
  DEMO_MATURITY_LEVELS,
  DEMO_MATURITY_PILLARS,
  DEMO_ORGANISATION,
  DEMO_PLATFORM_SAMPLES,
  DEMO_PROBLEM_SOLVING_CASE,
  DEMO_FIVE_S_CATEGORIES,
  DEMO_FIVE_S_STANDARD,
  DEMO_GEMBA_DEFINITION,
  DEMO_JOB_FUNCTIONS,
  DEMO_PROFICIENCY_SCALE,
  DEMO_RECOGNITION_TYPES,
  DEMO_ROLES,
  DEMO_SKILLS,
  DEMO_SUGGESTION_CATEGORIES,
  DEMO_SUGGESTION_PROGRAMME,
  DEMO_TRAINING_COURSES,
  DEMO_TRAINING_SESSION,
  DEMO_UNITS,
  DEMO_USERS,
} from "./constants";
import { invitationTokenDigest, invitationTokenFromSeed } from "./crypto";
import { loadLocalSupabaseEnv } from "./local-env";

type DemoUserKey = keyof typeof DEMO_USERS;

type DemoRoleKey = keyof typeof DEMO_ROLES;

const DEMO_USER_ROLE_KEY: Record<Exclude<DemoUserKey, "admin">, DemoRoleKey> = {
  manager: "manager",
  operator: "operator",
  finance: "financeValidator",
  psContributor: "psContributor",
};

type UnitMap = Record<string, string>;

async function expectRpc(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`RPC ${fn} failed: ${error.message}`);
  }
  return data;
}

async function isM8DemoComplete(managerClient: SupabaseClient): Promise<boolean> {
  const { count: publishedCount } = await managerClient
    .from("ci_project_methodology_versions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  if (publishedCount !== DEMO_CI_METHODOLOGIES.length) {
    return false;
  }

  const { data: completedProject } = await managerClient
    .from("ci_projects")
    .select("status")
    .eq("title", "Visual Standards Improvement")
    .maybeSingle();

  return completedProject?.status === "completed";
}

async function ensurePublishedMethodology(
  managerClient: SupabaseClient,
  methodology: (typeof DEMO_CI_METHODOLOGIES)[number],
): Promise<string> {
  const { data: existingMethodology } = await managerClient
    .from("ci_project_methodologies")
    .select("id")
    .eq("code", methodology.code)
    .maybeSingle();

  let methodologyId = existingMethodology?.id;
  if (!methodologyId) {
    methodologyId = (await expectRpc(managerClient, "create_ci_project_methodology_draft", {
      target_name: methodology.name,
      target_code: methodology.code,
      target_description: `${methodology.name} improvement methodology.`,
    })) as string;
  }

  const { data: versionRow, error: versionError } = await managerClient
    .from("ci_project_methodology_versions")
    .select("id, status")
    .eq("methodology_id", methodologyId)
    .eq("version_number", 1)
    .single();

  if (versionError || !versionRow) {
    throw versionError ?? new Error(`methodology version missing for ${methodology.code}`);
  }

  if (versionRow.status === "draft") {
    const { count: phaseCount } = await managerClient
      .from("ci_project_methodology_phases")
      .select("id", { count: "exact", head: true })
      .eq("methodology_version_id", versionRow.id);

    if (phaseCount === 0) {
      for (let index = 0; index < methodology.phases.length; index += 1) {
        await expectRpc(managerClient, "add_ci_project_methodology_phase", {
          target_methodology_version_id: versionRow.id,
          target_phase_key: `${methodology.code}-${index + 1}`,
          target_title: methodology.phases[index],
          target_display_order: index + 1,
        });
      }
    }

    await expectRpc(managerClient, "publish_ci_project_methodology_version", {
      target_methodology_version_id: versionRow.id,
    });
  }

  const { data: publishedVersion, error: publishedError } = await managerClient
    .from("ci_project_methodology_versions")
    .select("id")
    .eq("methodology_id", methodologyId)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (publishedError || !publishedVersion) {
    throw publishedError ?? new Error(`published version missing for ${methodology.code}`);
  }

  return publishedVersion.id;
}

async function advanceDemoProjectToActive(
  managerClient: SupabaseClient,
  projectId: string,
  currentStatus: string,
): Promise<void> {
  let status = currentStatus;

  if (status === "draft") {
    await expectRpc(managerClient, "submit_project", { target_project_id: projectId });
    status = "submitted";
  }
  if (status === "submitted") {
    await expectRpc(managerClient, "approve_project", { target_project_id: projectId });
    status = "approved";
  }
  if (status === "approved") {
    await expectRpc(managerClient, "start_project", { target_project_id: projectId });
  }
}

async function finalizeDemoProjectTarget(
  managerClient: SupabaseClient,
  projectId: string,
  currentStatus: string,
  project: (typeof DEMO_CI_PROJECTS)[number],
): Promise<void> {
  let status = currentStatus;

  if (status === "draft" || status === "submitted" || status === "approved") {
    await advanceDemoProjectToActive(managerClient, projectId, status);
    status = "active";
  }

  if (project.status === "on_hold" && status === "active") {
    await expectRpc(managerClient, "hold_project", {
      target_project_id: projectId,
      target_reason: "Waiting for tooling delivery.",
    });
    status = "on_hold";
  }

  if (project.status === "completed" && status !== "completed") {
    if (status === "on_hold") {
      await expectRpc(managerClient, "resume_project", { target_project_id: projectId });
    }
    await expectRpc(managerClient, "complete_project", {
      target_project_id: projectId,
      target_outcome_summary: "Visual standards deployed and sustained on packaging lines.",
      target_lessons_learned: "Early operator involvement improved adoption.",
      target_sustainment_summary: "Weekly visual checks added to line leader checklist.",
    });
  }
}

async function ensureDemoProject(
  managerClient: SupabaseClient,
  operationsUnitId: string,
  project: (typeof DEMO_CI_PROJECTS)[number],
  methodologyVersionId: string,
  managerMembershipId: string | undefined,
  operatorMembershipId: string | undefined,
): Promise<void> {
  const { data: existing } = await managerClient
    .from("ci_projects")
    .select("id, status")
    .eq("title", project.title)
    .maybeSingle();

  if (existing) {
    if (existing.status === "draft") {
      await expectRpc(managerClient, "update_ci_project_draft", {
        target_project_id: existing.id,
        target_methodology_version_id: methodologyVersionId,
      });

      if (managerMembershipId) {
        await expectRpc(managerClient, "assign_ci_project_team_member", {
          target_project_id: existing.id,
          target_membership_id: managerMembershipId,
          target_team_role: "owner",
        });
      }

      if (operatorMembershipId) {
        await expectRpc(managerClient, "assign_ci_project_team_member", {
          target_project_id: existing.id,
          target_membership_id: operatorMembershipId,
          target_team_role: "member",
        });
      }
    }

    if (existing.status !== "completed") {
      await advanceDemoProjectToActive(managerClient, existing.id, existing.status);
      await expectRpc(managerClient, "create_project_action", {
        target_title: `Follow up: ${project.title}`,
        target_project_id: existing.id,
        target_description: "Track weekly progress on the primary measure.",
      });
    }

    await finalizeDemoProjectTarget(managerClient, existing.id, existing.status, project);
    return;
  }

  const projectId = (await expectRpc(managerClient, "create_improvement_project", {
    target_title: project.title,
    target_unit_id: operationsUnitId,
    target_problem_statement: project.problem,
    target_objective: project.objective,
  })) as string;

  await expectRpc(managerClient, "update_ci_project_draft", {
    target_project_id: projectId,
    target_methodology_version_id: methodologyVersionId,
  });

  if (managerMembershipId) {
    await expectRpc(managerClient, "assign_ci_project_team_member", {
      target_project_id: projectId,
      target_membership_id: managerMembershipId,
      target_team_role: "owner",
    });
  }

  if (operatorMembershipId) {
    await expectRpc(managerClient, "assign_ci_project_team_member", {
      target_project_id: projectId,
      target_membership_id: operatorMembershipId,
      target_team_role: "member",
    });
  }

  const metricId = (await expectRpc(managerClient, "create_ci_project_metric", {
    target_project_id: projectId,
    target_metric_key: project.metric.key,
    target_display_name: project.metric.name,
    target_unit_label: project.metric.unit,
    target_baseline_value: project.metric.baseline,
    target_target_value: project.metric.target,
  })) as string;

  await advanceDemoProjectToActive(managerClient, projectId, "draft");

  await expectRpc(managerClient, "record_metric_measurement", {
    target_metric_id: metricId,
    target_measured_value: project.metric.baseline - 2,
  });

  await expectRpc(managerClient, "create_project_action", {
    target_title: `Follow up: ${project.title}`,
    target_project_id: projectId,
    target_description: "Track weekly progress on the primary measure.",
  });

  await finalizeDemoProjectTarget(managerClient, projectId, "active", project);
}

async function ensureM9RecognitionAward(
  managerClient: SupabaseClient,
  signedInAdmin: SupabaseClient,
  operationsUnitId: string,
  apiUrl: string,
  publishableKey: string,
): Promise<void> {
  const { count: awardCount } = await managerClient
    .from("recognition_awards")
    .select("id", { count: "exact", head: true });

  if (awardCount && awardCount > 0) {
    return;
  }

  const operatorClient = await signInUser(apiUrl, publishableKey, "operator");
  await switchOrganisation(
    operatorClient,
    (await resolveOrganisationId(operatorClient)) as string,
  );

  const { data: operatorMembership, error: membershipError } = await operatorClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.operator.id)
    .single();

  const { data: implementedSuggestion } = await managerClient
    .from("improvement_suggestions")
    .select("id")
    .eq("title", "Pre-stage changeover tooling")
    .maybeSingle();

  const { data: greatIdeaType, error: typeError } = await signedInAdmin
    .from("recognition_types")
    .select("id")
    .eq("code", "great-idea")
    .single();

  if (membershipError || !operatorMembership) {
    throw membershipError ?? new Error("M9 recognition demo operator membership missing");
  }
  if (typeError || !greatIdeaType) {
    throw typeError ?? new Error("M9 recognition demo great-idea type missing");
  }
  if (!implementedSuggestion) {
    throw new Error("M9 recognition demo implemented suggestion missing");
  }

  await expectRpc(managerClient, "award_recognition", {
    target_recognition_type_id: greatIdeaType.id,
    target_title: "Great Idea",
    target_message: "Thank you for the pre-stage tooling improvement.",
    target_organisational_unit_id: operationsUnitId,
    target_visibility: "organisation",
    target_recipient_membership_ids: [operatorMembership.id],
    target_source_resource_id: implementedSuggestion.id,
  });
}

async function isM10DemoComplete(serviceAdmin: SupabaseClient): Promise<boolean> {
  const { count: categoryCount } = await serviceAdmin
    .from("benefit_categories")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { count: benefitCount } = await serviceAdmin
    .from("improvement_benefits")
    .select("id", { count: "exact", head: true });

  const { data: financeMembership } = await serviceAdmin
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.finance.id)
    .maybeSingle();

  return (
    categoryCount === DEMO_BENEFIT_CATEGORIES.length &&
    benefitCount === DEMO_BENEFITS.length &&
    Boolean(financeMembership)
  );
}

type DemoBenefitConfig = (typeof DEMO_BENEFITS)[number];

function buildMonthlyForecastPeriods(
  startDate: string,
  endDate: string,
  monthlyAmount: number,
) {
  const periods: Array<{
    period_start: string;
    period_end: string;
    forecast_amount: number;
    display_order: number;
  }> = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let displayOrder = 1;

  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const periodEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    );

    if (periodEnd > end) {
      break;
    }

    periods.push({
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      forecast_amount: monthlyAmount,
      display_order: displayOrder,
    });

    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    displayOrder += 1;
  }

  return periods;
}

async function ensureDemoBenefitCategories(
  managerClient: SupabaseClient,
): Promise<Record<string, string>> {
  const categoryIds: Record<string, string> = {};

  for (const category of DEMO_BENEFIT_CATEGORIES) {
    const { data: existing } = await managerClient
      .from("benefit_categories")
      .select("id")
      .eq("code", category.code)
      .maybeSingle();

    if (existing?.id) {
      categoryIds[category.code] = existing.id;
      continue;
    }

    const insertedId = (await expectRpc(managerClient, "create_benefit_category", {
      target_name: category.name,
      target_code: category.code,
      target_display_order: category.displayOrder,
    })) as string;

    categoryIds[category.code] = insertedId;
  }

  return categoryIds;
}

async function resolveDemoProjectId(
  client: SupabaseClient,
  projectCode: string,
): Promise<string> {
  const project = DEMO_CI_PROJECTS.find((row) => row.code === projectCode);
  if (!project) {
    throw new Error(`Unknown demo project code: ${projectCode}`);
  }

  const { data, error } = await client
    .from("ci_projects")
    .select("id")
    .eq("title", project.title)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error(`Demo project missing for code ${projectCode}`);
  }

  return data.id;
}

async function seedDemoBenefitForecast(
  managerClient: SupabaseClient,
  benefitId: string,
  config: DemoBenefitConfig,
) {
  const forecastArgs: Record<string, unknown> = {
    target_benefit_id: benefitId,
    target_realisation_pattern: config.realisationPattern,
    target_forecast_start_date: config.forecastStart,
    target_forecast_end_date: config.forecastEnd,
  };

  if (config.benefitClass === "financial") {
    forecastArgs.target_forecast_total_amount = config.forecastTotal;
    forecastArgs.target_calculation_basis = "Demo forecast for local development.";
  } else {
    forecastArgs.target_target_measure_value = config.targetMeasureValue;
    forecastArgs.target_target_measure_unit = config.targetMeasureUnit;
    forecastArgs.target_target_date = config.targetDate;
  }

  const forecastVersionId = (await expectRpc(
    managerClient,
    "create_benefit_forecast_draft",
    forecastArgs,
  )) as string;

  if (
    config.benefitClass === "financial" &&
    config.realisationPattern === "recurring" &&
    "monthlyForecastAmount" in config
  ) {
    await expectRpc(managerClient, "replace_benefit_forecast_periods", {
      target_forecast_version_id: forecastVersionId,
      target_periods: buildMonthlyForecastPeriods(
        config.forecastStart,
        config.forecastEnd,
        config.monthlyForecastAmount,
      ),
    });
  } else if (config.benefitClass === "financial") {
    await expectRpc(managerClient, "replace_benefit_forecast_periods", {
      target_forecast_version_id: forecastVersionId,
      target_periods: [
        {
          period_start: config.forecastStart,
          period_end: config.forecastEnd,
          forecast_amount: config.forecastTotal,
          display_order: 1,
        },
      ],
    });
  }

  await expectRpc(managerClient, "submit_benefit_forecast", {
    target_forecast_version_id: forecastVersionId,
  });

  return forecastVersionId;
}

async function submitDemoBenefitForValidation(
  managerClient: SupabaseClient,
  benefitId: string,
  managerMembershipId: string,
  financeMembershipId: string | null,
) {
  await expectRpc(managerClient, "submit_benefit", {
    target_benefit_id: benefitId,
    target_ci_validator_membership_id: managerMembershipId,
    target_finance_validator_membership_id: financeMembershipId,
  });
}

async function seedDemoBenefitRealisationEntries(
  managerClient: SupabaseClient,
  financeClient: SupabaseClient,
  benefitId: string,
  config: DemoBenefitConfig,
) {
  if (!("realisationEntries" in config) || !config.realisationEntries?.length) {
    return;
  }

  for (const entry of config.realisationEntries) {
    const entryId = (await expectRpc(managerClient, "create_benefit_realisation_entry", {
      target_benefit_id: benefitId,
      target_period_start: entry.periodStart,
      target_period_end: entry.periodEnd,
      target_financial_amount:
        "financialAmount" in entry ? entry.financialAmount : null,
      target_measure_value: "measureValue" in entry ? entry.measureValue : null,
      target_measure_unit: "measureUnit" in entry ? entry.measureUnit : null,
      target_data_source: entry.dataSource,
    })) as string;

    await expectRpc(managerClient, "submit_benefit_realisation_entry", {
      target_entry_id: entryId,
    });

    await expectRpc(financeClient, "validate_benefit_realisation_entry", {
      target_entry_id: entryId,
    });
  }
}

async function seedDemoBenefitStory(
  managerClient: SupabaseClient,
  financeClient: SupabaseClient,
  operationsUnitId: string,
  categoryIds: Record<string, string>,
  managerMembershipId: string,
  financeMembershipId: string,
  config: DemoBenefitConfig,
) {
  const { data: existing } = await managerClient
    .from("improvement_benefits")
    .select("id, status")
    .eq("title", config.title)
    .maybeSingle();

  if (existing) {
    return;
  }

  let benefitId: string;

  if ("standalone" in config && config.standalone) {
    benefitId = (await expectRpc(managerClient, "create_benefit_draft", {
      target_title: config.title,
      target_organisational_unit_id: operationsUnitId,
      target_benefit_class: config.benefitClass,
      target_financial_type: config.financialType,
      target_category_id: categoryIds[config.categoryCode],
      target_owner_membership_id: managerMembershipId,
      target_is_standalone_initiative: true,
      target_description: config.baselineDescription,
    })) as string;
  } else if ("projectCode" in config && config.projectCode) {
    const projectId = await resolveDemoProjectId(managerClient, config.projectCode);
    benefitId = (await expectRpc(managerClient, "create_benefit_from_ci_project", {
      target_project_id: projectId,
      target_benefit_class: config.benefitClass,
      target_title: config.title,
      target_financial_type:
        config.benefitClass === "financial" ? config.financialType : null,
      target_non_financial_type:
        config.benefitClass === "non_financial" ? config.nonFinancialType : null,
      target_category_id: categoryIds[config.categoryCode],
      target_organisational_unit_id: operationsUnitId,
      target_owner_membership_id: managerMembershipId,
    })) as string;
  } else {
    throw new Error(`Demo benefit ${config.key} is missing a source configuration`);
  }

  const updateArgs: Record<string, unknown> = {
    target_benefit_id: benefitId,
    target_title: config.title,
    target_description: config.baselineDescription,
    target_category_id: categoryIds[config.categoryCode],
    target_organisational_unit_id: operationsUnitId,
    target_owner_membership_id: managerMembershipId,
    target_baseline_description: config.baselineDescription,
  };

  if (config.benefitClass === "financial") {
    updateArgs.target_baseline_financial_value = config.baselineFinancialValue;
  } else {
    updateArgs.target_baseline_measure_value = config.baselineMeasureValue;
    updateArgs.target_baseline_measure_unit = config.baselineMeasureUnit;
  }

  await expectRpc(managerClient, "update_benefit_draft", updateArgs);
  await seedDemoBenefitForecast(managerClient, benefitId, config);

  const financeValidatorId =
    config.benefitClass === "financial" ? financeMembershipId : null;
  await submitDemoBenefitForValidation(
    managerClient,
    benefitId,
    managerMembershipId,
    financeValidatorId,
  );

  if ("ciValidated" in config && config.ciValidated) {
    await expectRpc(managerClient, "record_benefit_validation", {
      target_benefit_id: benefitId,
      target_validation_role: "ci",
      target_decision: "approve",
      target_rationale: "CI validation approved for demo seed.",
    });
    return;
  }

  await expectRpc(managerClient, "record_benefit_validation", {
    target_benefit_id: benefitId,
    target_validation_role: "ci",
    target_decision: "approve",
    target_rationale: "CI validation approved for demo seed.",
  });

  if (config.benefitClass === "financial") {
    await expectRpc(financeClient, "record_benefit_validation", {
      target_benefit_id: benefitId,
      target_validation_role: "finance",
      target_decision: "approve",
      target_rationale: "Finance validation approved for demo seed.",
    });
  }

  await expectRpc(managerClient, "start_benefit_realisation", {
    target_benefit_id: benefitId,
  });

  await seedDemoBenefitRealisationEntries(
    managerClient,
    financeClient,
    benefitId,
    config,
  );

  if (config.targetStatus === "realised") {
    await expectRpc(managerClient, "mark_benefit_realised", {
      target_benefit_id: benefitId,
      target_reason: "Target measure sustained for demo seed.",
    });
  }
}

async function upgradeDemoManagerProblemSolvingPermissions(): Promise<void> {
  const seedDir = dirname(fileURLToPath(import.meta.url));
  execSync(
    `npx supabase db query --local -f "${join(seedDir, "upgrade-demo-manager-ps-permissions.sql")}"`,
    { stdio: "inherit" },
  );
}

async function isM11DemoComplete(managerClient: SupabaseClient): Promise<boolean> {
  const result = (await expectRpc(managerClient, "get_problem_solving_list", {
    target_search: DEMO_PROBLEM_SOLVING_CASE.title,
    target_status: "closed",
    target_page_size: 10,
  })) as {
    items?: Array<{ title: string; closure_outcome: string | null }>;
  };

  return (
    result.items?.some(
      (item) =>
        item.title === DEMO_PROBLEM_SOLVING_CASE.title &&
        item.closure_outcome === "resolved_verified_cause",
    ) ?? false
  );
}

async function findDemoProblemSolvingCase(
  managerClient: SupabaseClient,
  options: { excludeClosed?: boolean } = {},
): Promise<{
  id: string;
  status: string;
  hypothesis_count?: number;
} | null> {
  const result = (await expectRpc(managerClient, "get_problem_solving_list", {
    target_search: DEMO_PROBLEM_SOLVING_CASE.title,
    target_page_size: 10,
  })) as {
    items?: Array<{
      id: string;
      title: string;
      status: string;
      hypothesis_count?: number;
    }>;
  };

  const match = result.items?.find(
    (item) => item.title === DEMO_PROBLEM_SOLVING_CASE.title,
  );

  if (!match) {
    return null;
  }

  if (options.excludeClosed && match.status === "closed") {
    return null;
  }

  return match;
}

async function resolveProblemSolvingMethodId(
  client: SupabaseClient,
  builtinCode: string,
): Promise<string> {
  const catalog = (await expectRpc(client, "get_problem_solving_methods", {})) as {
    items?: Array<{ id: string; code: string }>;
  };

  const codeByBuiltin: Record<string, string> = {
    a3_structured: "a3-structured",
    rapid_rca: "rapid-rca",
    five_why: "five-why",
  };
  const targetCode = codeByBuiltin[builtinCode] ?? builtinCode;

  const method = catalog.items?.find((row) => row.code === targetCode);
  if (!method?.id) {
    throw new Error(`Problem solving method missing for ${builtinCode}`);
  }

  return method.id;
}

async function seedDemoProblemSolvingCase(
  managerClient: SupabaseClient,
  operationsUnitId: string,
  managerMembershipId: string,
  operatorMembershipId: string | undefined,
): Promise<void> {
  const story = DEMO_PROBLEM_SOLVING_CASE;

  if (await isM11DemoComplete(managerClient)) {
    return;
  }

  const existing = await findDemoProblemSolvingCase(managerClient, {
    excludeClosed: true,
  });

  if (existing?.status === "closed") {
    return;
  }

  if (existing?.id && (existing.hypothesis_count ?? 0) > 0) {
    console.log("M11 demo case already in progress; skipping narrative re-seed.");
    return;
  }

  await expectRpc(managerClient, "ensure_problem_solving_methods_provisioned", {});

  const methodId = await resolveProblemSolvingMethodId(
    managerClient,
    story.methodBuiltinCode,
  );

  let caseId = existing?.id;

  if (!caseId) {
    caseId = (await expectRpc(managerClient, "create_problem_solving_case_draft", {
      target_title: story.title,
      target_organisation_unit_id: operationsUnitId,
      target_problem_statement: story.problemStatement,
      target_background: story.background,
      target_business_impact: story.businessImpact,
      target_scope_in: story.scopeIn,
      target_scope_out: story.scopeOut,
      target_target_condition: story.targetCondition,
      target_detected_at: new Date("2026-01-15T08:00:00Z").toISOString(),
      target_priority: story.priority,
      target_severity: story.severity,
      target_owner_membership_id: managerMembershipId,
      target_facilitator_membership_id: managerMembershipId,
    })) as string;

    try {
      const packagingWasteProjectId = await resolveDemoProjectId(
        managerClient,
        "packaging-waste",
      );
      await expectRpc(managerClient, "add_problem_solving_source_link", {
        target_case_id: caseId,
        target_source_resource_id: packagingWasteProjectId,
        target_link_role: "related",
      });
    } catch {
      // Optional related project link when M8 demo project is absent.
    }
  }

  if (existing?.status === "draft" || !existing) {
    await expectRpc(managerClient, "activate_problem_solving_case", {
      target_case_id: caseId,
      target_method_id: methodId,
    });
  }

  if (operatorMembershipId) {
    await expectRpc(managerClient, "add_problem_solving_participant", {
      target_case_id: caseId,
      target_membership_id: operatorMembershipId,
      target_participant_role: "contributor",
    });
  }

  const measuredFactId = (await expectRpc(
    managerClient,
    "create_current_condition_item",
    {
      target_case_id: caseId,
      target_category: "measured_fact",
      target_statement: story.currentCondition.measuredFact,
    },
  )) as string;

  await expectRpc(managerClient, "verify_current_condition_item", {
    target_item_id: measuredFactId,
    target_verification_rationale: "Supported by quality inspection run summaries.",
  });

  await expectRpc(managerClient, "create_current_condition_item", {
    target_case_id: caseId,
    target_category: "observation",
    target_statement: story.currentCondition.observation,
  });

  await expectRpc(managerClient, "create_current_condition_item", {
    target_case_id: caseId,
    target_category: "assumption",
    target_statement: story.currentCondition.assumption,
  });

  const containmentId = (await expectRpc(managerClient, "create_containment", {
    target_problem_solving_case_id: caseId,
    target_description: story.containment.description,
    target_rationale: story.containment.rationale,
  })) as string;

  await expectRpc(managerClient, "create_problem_solving_action", {
    target_title: story.containment.actionTitle,
    target_problem_solving_case_id: caseId,
    target_context_role: "containment",
    target_containment_id: containmentId,
    target_description: "Temporary containment task for Line 3 seal defects.",
  });

  const pressureHypothesisId = (await expectRpc(managerClient, "create_hypothesis", {
    target_problem_solving_case_id: caseId,
    target_statement: story.hypotheses.pressureVariation.statement,
    target_category: story.hypotheses.pressureVariation.category,
    target_rationale: "Pressure drift observed after maintenance intervention.",
  })) as string;

  const filmTensionHypothesisId = (await expectRpc(managerClient, "create_hypothesis", {
    target_problem_solving_case_id: caseId,
    target_statement: story.hypotheses.filmTension.statement,
    target_category: story.hypotheses.filmTension.category,
  })) as string;

  const setupHypothesisId = (await expectRpc(managerClient, "create_hypothesis", {
    target_problem_solving_case_id: caseId,
    target_statement: story.hypotheses.setupInconsistency.statement,
    target_category: story.hypotheses.setupInconsistency.category,
  })) as string;

  const analysisId = (await expectRpc(managerClient, "create_analysis", {
    target_problem_solving_case_id: caseId,
    target_analysis_type: "fishbone",
    target_title: "Line 3 seal defect fishbone",
  })) as string;

  const machineNodeId = (await expectRpc(managerClient, "add_analysis_node", {
    target_analysis_id: analysisId,
    target_label: "Machine",
    target_category: "Machine",
    target_sort_order: 1,
  })) as string;

  await expectRpc(managerClient, "link_node_hypothesis", {
    target_node_id: machineNodeId,
    target_hypothesis_id: pressureHypothesisId,
  });

  const materialNodeId = (await expectRpc(managerClient, "add_analysis_node", {
    target_analysis_id: analysisId,
    target_label: "Material",
    target_category: "Material",
    target_sort_order: 2,
  })) as string;

  await expectRpc(managerClient, "link_node_hypothesis", {
    target_node_id: materialNodeId,
    target_hypothesis_id: filmTensionHypothesisId,
  });

  const methodNodeId = (await expectRpc(managerClient, "add_analysis_node", {
    target_analysis_id: analysisId,
    target_label: "Method",
    target_category: "Method",
    target_sort_order: 3,
  })) as string;

  await expectRpc(managerClient, "link_node_hypothesis", {
    target_node_id: methodNodeId,
    target_hypothesis_id: setupHypothesisId,
  });

  await expectRpc(managerClient, "update_hypothesis_status", {
    target_hypothesis_id: pressureHypothesisId,
    target_status: "testing",
    target_reason: "Pressure logging test planned.",
  });

  const pressureTestId = (await expectRpc(managerClient, "create_hypothesis_test", {
    target_hypothesis_id: pressureHypothesisId,
    target_test_question: "Does sealing jaw pressure remain within validated limits across a full run?",
    target_expected_result: "Pressure remains within +/- 5% of setup target.",
    target_method: "Pressure trace logging during production run",
    target_owner_membership_id: managerMembershipId,
    target_planned_date: "2026-01-20",
  })) as string;

  await expectRpc(managerClient, "complete_hypothesis_test", {
    target_hypothesis_test_id: pressureTestId,
    target_actual_result:
      "Pressure dropped below validated minimum three times after splice events.",
    target_conclusion: "supports",
  });

  const filmTestId = (await expectRpc(managerClient, "create_hypothesis_test", {
    target_hypothesis_id: filmTensionHypothesisId,
    target_test_question: "Does film tension correlate with seal defect timing?",
    target_expected_result: "Defects increase when tension drifts high.",
    target_method: "Tension trend comparison against defect log",
    target_owner_membership_id: managerMembershipId,
    target_planned_date: "2026-01-21",
  })) as string;

  await expectRpc(managerClient, "complete_hypothesis_test", {
    target_hypothesis_test_id: filmTestId,
    target_actual_result: "Tension remained stable during defect clusters.",
    target_conclusion: "refutes",
  });

  await expectRpc(managerClient, "reject_cause_hypothesis", {
    target_hypothesis_id: filmTensionHypothesisId,
    target_rejection_rationale: "Film tension test did not support the hypothesis.",
  });

  await expectRpc(managerClient, "reject_cause_hypothesis", {
    target_hypothesis_id: setupHypothesisId,
    target_rejection_rationale: "Setup audit showed consistent jaw height settings between shifts.",
  });

  await expectRpc(managerClient, "update_hypothesis_status", {
    target_hypothesis_id: pressureHypothesisId,
    target_status: "supported",
    target_reason: "Pressure trace test supports pressure variation hypothesis.",
  });

  await expectRpc(managerClient, "verify_cause_hypothesis", {
    target_hypothesis_id: pressureHypothesisId,
    target_verification_rationale:
      "Completed pressure test and maintenance review confirm regulator-induced sealing jaw pressure instability as the verified cause.",
  });

  const countermeasureId = (await expectRpc(managerClient, "create_countermeasure", {
    target_case_id: caseId,
    target_title: story.countermeasure.title,
    target_description: story.countermeasure.description,
    target_rationale: story.countermeasure.rationale,
  })) as string;

  await expectRpc(managerClient, "link_countermeasure_causes", {
    target_countermeasure_id: countermeasureId,
    target_hypothesis_ids: [pressureHypothesisId],
  });

  await expectRpc(managerClient, "select_countermeasure", {
    target_countermeasure_id: countermeasureId,
    target_rationale: "Addresses verified regulator instability with standardised verification.",
  });

  await expectRpc(managerClient, "create_problem_solving_action", {
    target_title: story.countermeasure.actionTitle,
    target_problem_solving_case_id: caseId,
    target_context_role: "countermeasure",
    target_countermeasure_id: countermeasureId,
    target_description: "Implement regulator replacement and update PM checklist.",
  });

  const effectivenessCheckId = (await expectRpc(
    managerClient,
    "create_effectiveness_check",
    {
      target_case_id: caseId,
      target_criterion: story.effectiveness.criterion,
      target_baseline_description: "Average seal defect rate before countermeasure.",
      target_target_description: "Sustain seal defect rate below target after countermeasure.",
      target_baseline_numeric: story.effectiveness.baselineNumeric,
      target_target_numeric: story.effectiveness.targetNumeric,
      target_unit: story.effectiveness.unit,
      target_observation_window_start: story.effectiveness.observationWindowStart,
      target_observation_window_end: story.effectiveness.observationWindowEnd,
    },
  )) as string;

  await expectRpc(managerClient, "record_effectiveness_result", {
    target_effectiveness_check_id: effectivenessCheckId,
    target_result: "pass",
    target_actual_numeric: story.effectiveness.actualNumeric,
    target_verification_rationale: "February quality data shows sustained improvement below target.",
  });

  const sustainmentItemId = (await expectRpc(managerClient, "create_sustainment_item", {
    target_case_id: caseId,
    target_what: story.sustainment.what,
    target_owner_membership_id: managerMembershipId,
    target_check_method: story.sustainment.checkMethod,
    target_follow_up_date: "2026-03-15",
  })) as string;

  await expectRpc(managerClient, "record_sustainment_result", {
    target_sustainment_item_id: sustainmentItemId,
    target_result: story.sustainment.result,
    target_evidence: "Updated changeover standard and first PM audit record on file.",
  });

  await expectRpc(managerClient, "create_problem_solving_action", {
    target_title: "Audit Line 3 pressure verification standard work",
    target_problem_solving_case_id: caseId,
    target_context_role: "sustainment",
    target_sustainment_item_id: sustainmentItemId,
    target_description: "Confirm sustainment checks are performed on schedule.",
  });

  const sessionId = (await expectRpc(managerClient, "start_problem_solving_session", {
    target_case_id: caseId,
    target_title: story.session.title,
    target_facilitator_membership_id: managerMembershipId,
    target_scheduled_at: new Date("2026-02-05T13:00:00Z").toISOString(),
  })) as string;

  await expectRpc(managerClient, "add_session_entry", {
    target_session_id: sessionId,
    target_entry_type: "decision",
    target_body: story.session.decision,
    target_reference_hypothesis_id: pressureHypothesisId,
  });

  await expectRpc(managerClient, "add_session_entry", {
    target_session_id: sessionId,
    target_entry_type: "note",
    target_body:
      "Pressure trace review and maintenance history reviewed with engineering and operations.",
  });

  await expectRpc(managerClient, "complete_problem_solving_session", {
    target_session_id: sessionId,
    target_summary: story.session.summary,
  });

  await expectRpc(managerClient, "close_problem_solving_case", {
    target_case_id: caseId,
    target_closure_outcome: "resolved_verified_cause",
    target_closure_rationale: story.closureRationale,
  });
}

async function ensureM11Demo(
  apiUrl: string,
  publishableKey: string,
  unitIds: UnitMap,
): Promise<void> {
  await upgradeDemoManagerProblemSolvingPermissions();

  const managerClient = await signInUser(apiUrl, publishableKey, "manager");
  await switchOrganisation(
    managerClient,
    (await resolveOrganisationId(managerClient)) as string,
  );

  if (await isM11DemoComplete(managerClient)) {
    console.log("M11 demo already seeded.");
    return;
  }

  const operationsUnitId = unitIds.operations;
  if (!operationsUnitId) {
    throw new Error("Demo operations unit is missing.");
  }

  const { data: managerMembership } = await managerClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.manager.id)
    .maybeSingle();

  const { data: operatorMembership } = await managerClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.operator.id)
    .maybeSingle();

  if (!managerMembership?.id) {
    throw new Error("M11 demo manager membership missing");
  }

  await seedDemoProblemSolvingCase(
    managerClient,
    operationsUnitId,
    managerMembership.id,
    operatorMembership?.id,
  );

  console.log("M11 demo: Packaging Line 3 problem solving case seeded.");
}

async function ensureM10Demo(
  signedInAdmin: SupabaseClient,
  serviceAdmin: SupabaseClient,
  organisationId: string,
  unitIds: UnitMap,
  apiUrl: string,
  publishableKey: string,
) {
  if (await isM10DemoComplete(serviceAdmin)) {
    console.log("M10 demo already seeded.");
    return;
  }

  const operationsUnitId = unitIds.operations;
  if (!operationsUnitId) {
    throw new Error("Demo operations unit is missing.");
  }

  const adminClient = await signInUser(apiUrl, publishableKey, "admin");
  await switchOrganisation(
    adminClient,
    (await resolveOrganisationId(adminClient)) as string,
  );
  const categoryIds = await ensureDemoBenefitCategories(adminClient);

  const managerClient = await signInUser(apiUrl, publishableKey, "manager");
  await switchOrganisation(
    managerClient,
    (await resolveOrganisationId(managerClient)) as string,
  );

  const financeClient = await signInUser(apiUrl, publishableKey, "finance");
  await switchOrganisation(
    financeClient,
    (await resolveOrganisationId(financeClient)) as string,
  );

  const { data: managerMembership } = await managerClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.manager.id)
    .maybeSingle();
  const { data: financeMembership } = await financeClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.finance.id)
    .maybeSingle();

  if (!managerMembership?.id || !financeMembership?.id) {
    throw new Error("M10 demo memberships missing");
  }

  for (const benefit of DEMO_BENEFITS) {
    await seedDemoBenefitStory(
      managerClient,
      financeClient,
      operationsUnitId,
      categoryIds,
      managerMembership.id,
      financeMembership.id,
      benefit,
    );
  }

  console.log("M10 demo: benefit categories, finance persona, and benefits seeded.");
}

async function isM9DemoComplete(serviceAdmin: SupabaseClient): Promise<boolean> {
  const { count: programmeCount } = await serviceAdmin
    .from("suggestion_programmes")
    .select("id", { count: "exact", head: true })
    .eq("code", DEMO_SUGGESTION_PROGRAMME.code);

  const { count: awardCount } = await serviceAdmin
    .from("recognition_awards")
    .select("id", { count: "exact", head: true });

  return Boolean(programmeCount && programmeCount > 0 && awardCount && awardCount > 0);
}

async function ensureAuthUser(admin: SupabaseClient, userKey: DemoUserKey) {
  const user = DEMO_USERS[userKey];
  const existing = await admin.auth.admin.getUserById(user.id);

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.displayName },
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.displayName },
    });

    if (updated.error) {
      throw updated.error;
    }
  }

  const { error: enrolmentError } = await admin.rpc(
    "finalise_identity_enrolment",
    {
      target_user_id: user.id,
    },
  );

  if (enrolmentError) {
    throw enrolmentError;
  }
}

async function signInUser(
  apiUrl: string,
  publishableKey: string,
  userKey: DemoUserKey,
) {
  const user = DEMO_USERS[userKey];
  const client = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw error ?? new Error(`Unable to sign in ${user.email}`);
  }

  return client;
}

async function provisionOrganisation(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("provision_organisation", {
    owner_user_id: DEMO_USERS.admin.id,
    organisation_code: DEMO_ORGANISATION.code,
    organisation_name: DEMO_ORGANISATION.name,
  });

  if (error && !error.message.includes("duplicate key value")) {
    throw error;
  }

  return data as string | null;
}

async function resolveOrganisationId(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_eligible_organisations");

  if (error) {
    throw error;
  }

  const organisations = (data ?? []) as Array<{
    organisation_id: string;
    organisation_code: string;
  }>;

  const organisation = organisations.find(
    (row) => row.organisation_code === DEMO_ORGANISATION.code,
  );

  if (!organisation) {
    throw new Error("Demo organisation was not found after provisioning.");
  }

  return organisation.organisation_id;
}

async function switchOrganisation(
  client: SupabaseClient,
  organisationId: string,
) {
  const { data, error } = await client.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw error ?? new Error("Unable to select demo organisation.");
  }
}

async function ensureUnits(
  client: SupabaseClient,
  organisationId: string,
): Promise<UnitMap> {
  const unitIds: UnitMap = {};

  const { data: existingUnits, error: existingError } = await client
    .from("organisation_units")
    .select("id, code")
    .eq("organisation_id", organisationId);

  if (existingError) {
    throw existingError;
  }

  for (const unit of existingUnits ?? []) {
    unitIds[unit.code] = unit.id;
  }

  for (const unit of DEMO_UNITS) {
    if (unitIds[unit.code]) {
      continue;
    }

    const parentId = unit.parentKey ? unitIds[unit.parentKey] : null;
    const { data, error } = await client.rpc("create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: parentId,
      unit_code: unit.code,
      unit_name: unit.name,
      unit_type: unit.type,
    });

    if (error) {
      throw error;
    }

    unitIds[unit.code] = data as string;
  }

  return unitIds;
}

async function findPublishedRoleVersionId(
  client: SupabaseClient,
  organisationId: string,
  canonicalName: string,
) {
  const { data: roles, error: rolesError } = await client
    .from("roles")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("canonical_name", canonicalName)
    .maybeSingle();

  if (rolesError) {
    throw rolesError;
  }

  if (!roles) {
    return null;
  }

  const { data: version, error: versionError } = await client
    .from("role_versions")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("role_id", roles.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw versionError;
  }

  return version?.id ?? null;
}

async function ensurePublishedRole(
  client: SupabaseClient,
  organisationId: string,
  roleKey: keyof typeof DEMO_ROLES,
) {
  const role = DEMO_ROLES[roleKey];
  const existingVersionId = await findPublishedRoleVersionId(
    client,
    organisationId,
    role.canonicalName,
  );

  if (existingVersionId) {
    return existingVersionId;
  }

  const { data: draftVersionId, error: draftError } = await client.rpc(
    "create_role_draft",
    {
      target_organisation_id: organisationId,
      role_canonical_name: role.canonicalName,
      role_display_name: role.displayName,
      role_description: role.description,
    },
  );

  if (draftError) {
    throw draftError;
  }

  for (const permissionKey of role.permissions) {
    const { error } = await client.rpc("add_role_permission", {
      target_organisation_id: organisationId,
      target_role_version_id: draftVersionId,
      target_permission_key: permissionKey,
    });

    if (error) {
      throw error;
    }
  }

  const { error: publishError } = await client.rpc("publish_role_version", {
    target_organisation_id: organisationId,
    target_role_version_id: draftVersionId,
  });

  if (publishError) {
    throw publishError;
  }

  return draftVersionId as string;
}

async function userHasOrganisationMembership(
  ownerClient: SupabaseClient,
  organisationId: string,
  userId: string,
) {
  const { data, error } = await ownerClient
    .from("organisation_memberships")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function ensureInvitationAccepted(
  ownerClient: SupabaseClient,
  apiUrl: string,
  publishableKey: string,
  organisationId: string,
  userKey: Exclude<DemoUserKey, "admin">,
  roleVersionId: string,
  unitIds: UnitMap,
) {
  const alreadyMember = await userHasOrganisationMembership(
    ownerClient,
    organisationId,
    DEMO_USERS[userKey].id,
  );

  if (alreadyMember) {
    return;
  }

  const role = DEMO_ROLES[DEMO_USER_ROLE_KEY[userKey]];
  const token = invitationTokenFromSeed(role.invitationTokenSeed);
  const digest = invitationTokenDigest(token);
  const scopeUnitId =
    role.scopeUnitKey && unitIds[role.scopeUnitKey]
      ? unitIds[role.scopeUnitKey]
      : null;

  const invitee = await signInUser(apiUrl, publishableKey, userKey);
  const existingAccept = await invitee.rpc("accept_organisation_invitation", {
    invitation_token_digest: digest,
  });

  if (!existingAccept.error && existingAccept.data) {
    return;
  }

  const { error: inviteError } = await ownerClient.rpc(
    "issue_organisation_invitation",
    {
      target_organisation_id: organisationId,
      invitation_recipient_type: "email",
      invitation_canonical_recipient: DEMO_USERS[userKey].email,
      invitation_token_digest: digest,
      invitation_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      offered_role_version_id: roleVersionId,
      offered_scope_type: role.scopeType,
      offered_scope_unit_id: scopeUnitId,
    },
  );

  if (inviteError && inviteError.code !== "23505") {
    throw inviteError;
  }

  const { error: acceptError } = await invitee.rpc(
    "accept_organisation_invitation",
    {
      invitation_token_digest: digest,
    },
  );

  if (acceptError) {
    throw acceptError;
  }
}

async function ensureMaturityDemo(client: SupabaseClient, unitIds: UnitMap) {
  const { data: existing } = await client
    .from("maturity_models")
    .select("id")
    .eq("display_name", DEMO_PLATFORM_SAMPLES.maturityFrameworkName)
    .limit(1);

  if ((existing ?? []).length > 0) {
    return;
  }

  const { data: modelId, error: modelError } = await client.rpc(
    "create_maturity_model_draft",
    {
      target_display_name: DEMO_PLATFORM_SAMPLES.maturityFrameworkName,
      target_description: DEMO_PLATFORM_SAMPLES.maturityFrameworkDescription,
    },
  );

  if (modelError) {
    throw modelError;
  }

  const { data: version } = await client
    .from("maturity_model_versions")
    .select("id")
    .eq("model_id", modelId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!version) {
    throw new Error("Demo maturity version was not created.");
  }

  for (const level of DEMO_MATURITY_LEVELS) {
    await client.rpc("add_maturity_level", {
      target_model_version_id: version.id,
      target_level_number: level.number,
      target_name: level.name,
      target_color_token: level.color,
    });
  }

  let pillarPosition = 1;
  for (const pillar of DEMO_MATURITY_PILLARS) {
    const { data: pillarId, error: pillarError } = await client.rpc(
      "add_maturity_pillar",
      {
        target_model_version_id: version.id,
        target_name: pillar.name,
        target_position: pillarPosition,
        target_section_title: pillar.name,
      },
    );

    if (pillarError) {
      throw pillarError;
    }

    const { data: pillarRow } = await client
      .from("maturity_pillars")
      .select("section_id")
      .eq("id", pillarId)
      .maybeSingle();

    if (!pillarRow?.section_id) {
      throw new Error("Demo pillar section missing.");
    }

    let criterionPosition = 1;
    for (const criterionName of pillar.criteria) {
      const { data: criterionId, error: criterionError } = await client.rpc(
        "add_maturity_criterion",
        {
          target_pillar_id: pillarId,
          target_name: criterionName,
          target_position: criterionPosition,
        },
      );

      if (criterionError) {
        throw criterionError;
      }

      const { data: questionId, error: questionError } = await client.rpc(
        "add_maturity_question",
        {
          target_model_version_id: version.id,
          target_section_id: pillarRow.section_id,
          target_question_type: "score",
          target_prompt: `Rate: ${criterionName}`,
          target_position: criterionPosition,
          target_allows_not_applicable: true,
        },
      );

      if (questionError) {
        throw questionError;
      }

      await client.rpc("link_criterion_question", {
        target_criterion_id: criterionId,
        target_question_id: questionId,
        target_contributes_to_score: true,
        target_scoring_metadata: { type: "direct" },
      });

      criterionPosition += 1;
    }

    pillarPosition += 1;
  }

  await client.rpc("publish_maturity_model_version", {
    target_model_version_id: version.id,
  });

  const cornwallUnitId = unitIds["cornwall-plant"];
  if (!cornwallUnitId) {
    return;
  }

  const { data: historicalAssessmentId, error: histError } = await client.rpc(
    "start_maturity_assessment",
    {
      target_model_version_id: version.id,
      target_unit_id: cornwallUnitId,
      target_assessment_type: "formal",
    },
  );

  if (histError) {
    throw histError;
  }

  const { data: criteria } = await client
    .from("maturity_criteria")
    .select("id")
    .limit(3);

  for (const criterion of criteria ?? []) {
    const { data: links } = await client
      .from("maturity_criterion_questions")
      .select("question_id")
      .eq("criterion_id", criterion.id)
      .limit(1);

    const questionId = links?.[0]?.question_id;
    if (!questionId) continue;

    await client.rpc("upsert_maturity_assessment_answer", {
      target_assessment_id: historicalAssessmentId,
      target_question_id: questionId,
      target_number_value: 3.5,
    });
  }

  await client.rpc("submit_maturity_assessment", {
    target_assessment_id: historicalAssessmentId,
  });
  await client.rpc("begin_assessor_review", {
    target_assessment_id: historicalAssessmentId,
  });
  await client.rpc("approve_maturity_assessment", {
    target_assessment_id: historicalAssessmentId,
  });
  await client.rpc("publish_official_maturity_result", {
    target_assessment_id: historicalAssessmentId,
  });

  const { data: selfAssessmentId, error: selfError } = await client.rpc(
    "start_maturity_assessment",
    {
      target_model_version_id: version.id,
      target_unit_id: cornwallUnitId,
      target_assessment_type: "self",
    },
  );

  if (selfError) {
    throw selfError;
  }

  console.log(`Self assessment ready: ${selfAssessmentId}`);
}

async function ensureM6Demo(client: SupabaseClient, unitIds: UnitMap) {
  const operationsUnitId = unitIds[DEMO_FIVE_S_STANDARD.unitKey];
  if (!operationsUnitId) return;

  const { data: existing } = await client
    .from("five_s_standards")
    .select("id")
    .eq("display_name", DEMO_FIVE_S_STANDARD.name)
    .maybeSingle();

  if (existing) return;

  const { data: adminMembership } = await client
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.admin.id)
    .maybeSingle();

  if (!adminMembership?.id) return;

  const { data: fiveSStandardId, error: fiveSError } = await client.rpc(
    "create_five_s_standard_draft",
    {
      target_display_name: DEMO_FIVE_S_STANDARD.name,
      target_description: DEMO_FIVE_S_STANDARD.description,
      target_threshold_percent: 90,
    },
  );
  if (fiveSError) throw fiveSError;

  const { data: fiveSVersion } = await client
    .from("five_s_standard_versions")
    .select("id")
    .eq("standard_id", fiveSStandardId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!fiveSVersion?.id) throw new Error("Demo 5S version missing");

  let position = 1;
  for (const category of DEMO_FIVE_S_CATEGORIES) {
    const { data: sectionId, error: sectionError } = await client.rpc(
      "add_five_s_section",
      {
        target_standard_version_id: fiveSVersion.id,
        target_title: category,
        target_position: position,
      },
    );
    if (sectionError) throw sectionError;

    await client.rpc("add_five_s_question", {
      target_standard_version_id: fiveSVersion.id,
      target_section_id: sectionId,
      target_question_type: "yes_no",
      target_prompt: `${category}: area meets standard?`,
      target_position: 1,
      target_contributes_to_score: true,
      target_scoring_metadata: { type: "yes_no", yes_value: 100, no_value: 0 },
    });
    position += 1;
  }

  await client.rpc("publish_five_s_standard_version", {
    target_standard_version_id: fiveSVersion.id,
  });

  const { data: gembaDefinitionId, error: gembaError } = await client.rpc(
    "create_gemba_definition_draft",
    {
      target_display_name: DEMO_GEMBA_DEFINITION.name,
      target_description: DEMO_GEMBA_DEFINITION.description,
      target_expected_duration_minutes: 45,
    },
  );
  if (gembaError) throw gembaError;

  const { data: gembaVersion } = await client
    .from("gemba_definition_versions")
    .select("id")
    .eq("definition_id", gembaDefinitionId)
    .maybeSingle();

  if (gembaVersion?.id) {
    const { data: sectionId, error: gembaSectionError } = await client.rpc(
      "add_gemba_section",
      {
        target_definition_version_id: gembaVersion.id,
        target_title: "Operations floor",
        target_position: 1,
      },
    );
    if (gembaSectionError) throw gembaSectionError;

    const { error: gembaQuestionError } = await client.rpc(
      "add_gemba_question",
      {
        target_definition_version_id: gembaVersion.id,
        target_section_id: sectionId,
        target_question_type: "long_text",
        target_prompt: "What did you observe on the operations floor?",
        target_position: 1,
      },
    );
    if (gembaQuestionError) throw gembaQuestionError;
    await client.rpc("publish_gemba_definition_version", {
      target_definition_version_id: gembaVersion.id,
    });
  }

  await client.rpc("create_schedule_definition", {
    target_activity_resource_id: fiveSStandardId,
    target_title: "Weekly Production 5S",
    target_unit_id: operationsUnitId,
    target_owner_membership_id: adminMembership.id,
    target_recurrence: {
      frequency: "weekly",
      interval: 1,
      weekdays: ["monday"],
    },
    target_start_date: new Date().toISOString().slice(0, 10),
    target_is_all_day: true,
  });

  if (gembaDefinitionId) {
    await client.rpc("create_schedule_definition", {
      target_activity_resource_id: gembaDefinitionId,
      target_title: "Weekly Operations Gemba",
      target_unit_id: operationsUnitId,
      target_owner_membership_id: adminMembership.id,
      target_recurrence: {
        frequency: "weekly",
        interval: 1,
        weekdays: ["wednesday"],
      },
      target_start_date: new Date().toISOString().slice(0, 10),
      target_is_all_day: false,
      target_local_time: "09:00:00",
    });
  }

  const { data: completedAuditId } = await client.rpc("start_five_s_audit", {
    target_standard_id: fiveSStandardId,
    target_unit_id: operationsUnitId,
  });

  if (completedAuditId) {
    const { data: version } = await client
      .from("five_s_standard_versions")
      .select("template_version_id")
      .eq("id", fiveSVersion.id)
      .maybeSingle();

    const { data: questions } = await client
      .from("template_questions")
      .select("id")
      .eq("template_version_id", version?.template_version_id ?? "");

    for (const q of questions ?? []) {
      await client.rpc("upsert_five_s_audit_answer", {
        target_audit_id: completedAuditId,
        target_question_id: q.id,
        target_text_value: "yes",
      });
    }

    await client.rpc("complete_five_s_audit", {
      target_audit_id: completedAuditId,
    });
  }

  if (gembaDefinitionId) {
    const { data: walkId } = await client.rpc("start_gemba_walk", {
      target_definition_id: gembaDefinitionId,
      target_unit_id: operationsUnitId,
    });
    if (walkId) {
      await client.rpc("create_gemba_observation", {
        target_walk_id: walkId,
        target_observation_text:
          "Operator updated visual standard after improvement.",
        target_observation_type: "positive_practice",
      });
      await client.rpc("complete_gemba_walk", {
        target_walk_id: walkId,
        target_summary_notes: "Completed demo operations Gemba.",
      });
    }
  }
}

async function ensurePlatformSamples(client: SupabaseClient) {
  const { count: actionCount, error: actionCountError } = await client
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("title", DEMO_PLATFORM_SAMPLES.actionTitle);

  if (actionCountError) {
    throw actionCountError;
  }

  if ((actionCount ?? 0) === 0) {
    const { error } = await client.rpc("create_action", {
      target_title: DEMO_PLATFORM_SAMPLES.actionTitle,
      target_description:
        "Demonstration action seeded for local Milestone 4 development.",
      target_priority: "normal",
    });

    if (error) {
      throw error;
    }
  }

  const { data: templates, error: templateError } = await client
    .from("templates")
    .select("id")
    .eq("display_name", DEMO_PLATFORM_SAMPLES.templateName)
    .limit(1);

  if (templateError) {
    throw templateError;
  }

  if ((templates ?? []).length > 0) {
    return;
  }

  const { data: templateId, error: createTemplateError } = await client.rpc(
    "create_template_draft",
    {
      target_display_name: DEMO_PLATFORM_SAMPLES.templateName,
      target_description: DEMO_PLATFORM_SAMPLES.templateDescription,
    },
  );

  if (createTemplateError) {
    throw createTemplateError;
  }

  const { data: templateVersion, error: versionError } = await client
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("version_number", 1)
    .maybeSingle();

  if (versionError || !templateVersion) {
    throw versionError ?? new Error("Demo template version was not created.");
  }

  const { error: publishError } = await client.rpc("publish_template_version", {
    target_template_version_id: templateVersion.id,
  });

  if (publishError) {
    throw publishError;
  }
}

async function ensureM7Demo(client: SupabaseClient, unitIds: UnitMap) {
  const operationsUnitId = unitIds[DEMO_FIVE_S_STANDARD.unitKey];
  if (!operationsUnitId) return;

  const { data: existingCourse } = await client
    .from("training_courses")
    .select("id")
    .eq("code", "lean-basic")
    .maybeSingle();

  if (existingCourse) return;

  const jobFunctionIds: Record<string, string> = {};
  for (const jf of DEMO_JOB_FUNCTIONS) {
    const { data: id, error } = await client.rpc("create_job_function", {
      target_name: jf.name,
      target_code: jf.code,
    });
    if (error) throw error;
    jobFunctionIds[jf.code] = id as string;
  }

  const courseIds: Record<string, string> = {};
  const courseVersionIds: Record<string, string> = {};
  for (const course of DEMO_TRAINING_COURSES) {
    const { data: courseId, error } = await client.rpc(
      "create_training_course_draft",
      {
        target_name: course.name,
        target_code: course.code,
      },
    );
    if (error) throw error;
    courseIds[course.code] = courseId as string;

    const { data: version } = await client
      .from("training_course_versions")
      .select("id")
      .eq("course_id", courseId)
      .eq("version_number", 1)
      .maybeSingle();

    if (!version?.id) throw new Error(`Missing version for ${course.code}`);

    await client.rpc("update_training_course_draft_version", {
      target_course_version_id: version.id,
      target_validity_days: course.validityDays,
      target_delivery_method: "classroom",
    });
    await client.rpc("publish_training_course_version", {
      target_course_version_id: version.id,
    });
    courseVersionIds[course.code] = version.id;
  }

  const { data: curriculumId, error: curriculumError } = await client.rpc(
    "create_training_curriculum_draft",
    {
      target_name: "Apex Training Curriculum",
      target_code: "apex-curriculum",
    },
  );
  if (curriculumError) throw curriculumError;

  const { data: curriculumVersion } = await client
    .from("training_curriculum_versions")
    .select("id")
    .eq("curriculum_id", curriculumId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!curriculumVersion?.id)
    throw new Error("Demo curriculum version missing");

  const curriculumRules: Array<{ jobFunction: string; courses: string[] }> = [
    { jobFunction: "operator", courses: ["lean-basic"] },
    {
      jobFunction: "team-leader",
      courses: ["lean-basic", "white-belt", "five-s-practitioner"],
    },
    {
      jobFunction: "engineer",
      courses: ["lean-basic", "yellow-belt", "problem-solving"],
    },
    { jobFunction: "shift-manager", courses: ["lean-basic", "yellow-belt"] },
    { jobFunction: "department-manager", courses: ["green-belt"] },
  ];

  for (const rule of curriculumRules) {
    for (const courseCode of rule.courses) {
      await client.rpc("add_training_requirement", {
        target_curriculum_version_id: curriculumVersion.id,
        target_course_id: courseIds[courseCode],
        target_job_function_id: jobFunctionIds[rule.jobFunction],
        target_mandatory: true,
      });
    }
  }

  await client.rpc("publish_training_curriculum_version", {
    target_curriculum_version_id: curriculumVersion.id,
  });

  const { data: scaleId, error: scaleError } = await client.rpc(
    "create_skill_proficiency_scale_draft",
    {
      target_name: DEMO_PROFICIENCY_SCALE.name,
    },
  );
  if (scaleError) throw scaleError;

  const { data: scaleVersion } = await client
    .from("skill_proficiency_scale_versions")
    .select("id")
    .eq("scale_id", scaleId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!scaleVersion?.id) throw new Error("Demo scale version missing");

  const levelIds: Record<number, string> = {};
  for (const level of DEMO_PROFICIENCY_SCALE.levels) {
    const { data: levelId, error } = await client.rpc(
      "add_skill_proficiency_level",
      {
        target_scale_version_id: scaleVersion.id,
        target_order_value: level.order,
        target_label: level.label,
      },
    );
    if (error) throw error;
    levelIds[level.order] = levelId as string;
  }

  await client.rpc("publish_skill_proficiency_scale_version", {
    target_scale_version_id: scaleVersion.id,
  });

  const skillIds: Record<string, string> = {};
  for (const skill of DEMO_SKILLS) {
    const { data: skillId, error } = await client.rpc("create_skill", {
      target_name: skill.name,
      target_code: skill.code,
    });
    if (error) throw error;
    skillIds[skill.code] = skillId as string;
  }

  const { data: capabilitySetId, error: setError } = await client.rpc(
    "create_skill_capability_set_draft",
    {
      target_name: "Apex Capability Requirements",
      target_code: "apex-capability",
    },
  );
  if (setError) throw setError;

  const { data: capabilityVersion } = await client
    .from("skill_capability_set_versions")
    .select("id")
    .eq("capability_set_id", capabilitySetId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!capabilityVersion?.id)
    throw new Error("Demo capability set version missing");

  await client.rpc("add_skill_requirement", {
    target_capability_set_version_id: capabilityVersion.id,
    target_skill_id: skillIds["a3-facilitation"],
    target_job_function_id: jobFunctionIds["team-leader"],
    target_proficiency_scale_version_id: scaleVersion.id,
    target_target_proficiency_level_id: levelIds[3],
  });

  await client.rpc("add_skill_requirement", {
    target_capability_set_version_id: capabilityVersion.id,
    target_skill_id: skillIds["five-s-auditing"],
    target_job_function_id: jobFunctionIds["operator"],
    target_proficiency_scale_version_id: scaleVersion.id,
    target_target_proficiency_level_id: levelIds[4],
  });

  await client.rpc("publish_skill_capability_set_version", {
    target_capability_set_version_id: capabilityVersion.id,
  });

  const { data: memberships } = await client
    .from("organisation_memberships")
    .select("id, user_id")
    .in("user_id", [DEMO_USERS.manager.id, DEMO_USERS.operator.id]);

  const managerMembership = memberships?.find(
    (m) => m.user_id === DEMO_USERS.manager.id,
  );
  const operatorMembership = memberships?.find(
    (m) => m.user_id === DEMO_USERS.operator.id,
  );

  if (managerMembership?.id) {
    await client.rpc("assign_membership_job_function", {
      target_membership_id: managerMembership.id,
      target_job_function_id: jobFunctionIds["team-leader"],
      target_primary: true,
      target_organisational_unit_id: operationsUnitId,
    });
  }

  if (operatorMembership?.id) {
    await client.rpc("assign_membership_job_function", {
      target_membership_id: operatorMembership.id,
      target_job_function_id: jobFunctionIds["operator"],
      target_primary: true,
      target_organisational_unit_id: operationsUnitId,
    });

    await client.rpc("record_training_completion", {
      target_membership_id: operatorMembership.id,
      target_course_version_id: courseVersionIds["lean-basic"],
      target_completed_at: new Date().toISOString(),
      target_completion_method: "classroom",
    });

    await client.rpc("record_skill_validation", {
      target_membership_id: operatorMembership.id,
      target_skill_id: skillIds["five-s-auditing"],
      target_proficiency_scale_version_id: scaleVersion.id,
      target_proficiency_level_id: levelIds[3],
      target_assessment_method: "manager_assessment",
    });
  }

  if (managerMembership?.id) {
    const scheduledStart = new Date();
    scheduledStart.setDate(scheduledStart.getDate() + 7);
    const { data: sessionId, error: sessionError } = await client.rpc(
      "create_training_session",
      {
        target_course_version_id:
          courseVersionIds[DEMO_TRAINING_SESSION.courseCode],
        target_title: DEMO_TRAINING_SESSION.title,
        target_organisational_unit_id: operationsUnitId,
        target_scheduled_start: scheduledStart.toISOString(),
        target_scheduled_end: new Date(
          scheduledStart.getTime() + 2 * 60 * 60 * 1000,
        ).toISOString(),
        target_location: "Cornwall Plant Training Room",
      },
    );
    if (sessionError) throw sessionError;

    await client.rpc("add_training_session_participant", {
      target_session_id: sessionId as string,
      target_membership_id: managerMembership.id,
    });
  }

  console.log("M7 demo: job functions, training, and skills seeded.");
}

async function ensureM9Demo(
  signedInAdmin: SupabaseClient,
  serviceAdmin: SupabaseClient,
  unitIds: UnitMap,
  apiUrl: string,
  publishableKey: string,
) {
  if (await isM9DemoComplete(signedInAdmin)) {
    console.log("M9 demo already seeded.");
    return;
  }

  const operationsUnitId = unitIds["operations"];
  if (!operationsUnitId) {
    throw new Error("Demo operations unit is missing.");
  }

  const { data: existingProgramme } = await signedInAdmin
    .from("suggestion_programmes")
    .select("id")
    .eq("code", DEMO_SUGGESTION_PROGRAMME.code)
    .maybeSingle();

  if (existingProgramme) {
    const managerClient = await signInUser(apiUrl, publishableKey, "manager");
    await switchOrganisation(
      managerClient,
      (await resolveOrganisationId(managerClient)) as string,
    );
    await ensureM9RecognitionAward(
      managerClient,
      signedInAdmin,
      operationsUnitId,
      apiUrl,
      publishableKey,
    );
    console.log("M9 demo: recognition award repaired.");
    return;
  }

  const { data: programmeId, error: programmeError } = await signedInAdmin.rpc(
    "create_suggestion_programme_draft",
    {
      target_name: DEMO_SUGGESTION_PROGRAMME.name,
      target_code: DEMO_SUGGESTION_PROGRAMME.code,
      target_description: "Frontline everyday improvement programme.",
    },
  );
  if (programmeError) throw programmeError;

  const { data: programmeVersion, error: programmeVersionError } = await signedInAdmin
    .from("suggestion_programme_versions")
    .select("id")
    .eq("programme_id", programmeId as string)
    .eq("version_number", 1)
    .single();

  if (programmeVersionError || !programmeVersion) {
    throw programmeVersionError ?? new Error("programme version missing");
  }

  await signedInAdmin
    .from("suggestion_programme_versions")
    .update({
      review_target_days: DEMO_SUGGESTION_PROGRAMME.reviewTargetDays,
      applicable_unit_id: operationsUnitId,
    })
    .eq("id", programmeVersion.id);

  await signedInAdmin.rpc("publish_suggestion_programme_version", {
    target_programme_version_id: programmeVersion.id,
  });

  const categoryIds: Record<string, string> = {};
  for (const category of DEMO_SUGGESTION_CATEGORIES) {
    const { data: categoryId, error } = await signedInAdmin.rpc("create_suggestion_category", {
      target_name: category.name,
      target_code: category.code,
    });
    if (error) throw error;
    categoryIds[category.code] = categoryId as string;
  }

  for (const type of DEMO_RECOGNITION_TYPES) {
    await signedInAdmin.rpc("create_recognition_type", {
      target_name: type.name,
      target_code: type.code,
    });
  }

  const managerClient = await signInUser(apiUrl, publishableKey, "manager");
  await switchOrganisation(
    managerClient,
    (await resolveOrganisationId(managerClient)) as string,
  );

  const operatorClient = await signInUser(apiUrl, publishableKey, "operator");
  await switchOrganisation(
    operatorClient,
    (await resolveOrganisationId(operatorClient)) as string,
  );

  const { data: operatorMembership } = await operatorClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.operator.id)
    .single();

  const { data: draftSubmitted } = await operatorClient.rpc("create_suggestion_draft", {
    target_programme_version_id: programmeVersion.id,
    target_category_id: categoryIds.quality,
    target_title: "Visual defect sample board",
    target_problem_or_opportunity: "Operators struggle to judge minor defects consistently.",
    target_proposed_idea: "Install a visual defect sample board at the inspection station.",
    target_expected_benefit_summary: "Fewer customer complaints on appearance.",
  });
  await operatorClient.rpc("submit_suggestion", { target_suggestion_id: draftSubmitted as string });
  await managerClient.rpc("begin_suggestion_review", { target_suggestion_id: draftSubmitted as string });

  const { data: implementedId } = await operatorClient.rpc("create_suggestion_draft", {
    target_programme_version_id: programmeVersion.id,
    target_category_id: categoryIds.delivery,
    target_title: "Pre-stage changeover tooling",
    target_problem_or_opportunity: "Changeover team waits for required tooling.",
    target_proposed_idea: "Prepare tooling trolley before shutdown.",
    target_expected_benefit_summary: "Shorter changeover time.",
  });
  await operatorClient.rpc("submit_suggestion", { target_suggestion_id: implementedId as string });
  await managerClient.rpc("begin_suggestion_review", { target_suggestion_id: implementedId as string });
  await managerClient.rpc("record_suggestion_review", {
    target_suggestion_id: implementedId as string,
    target_decision: "accept",
    target_impact_level: "medium",
    target_effort_level: "low",
    target_rationale: "Quick win with clear benefit.",
  });
  await managerClient.rpc("begin_suggestion_implementation", { target_suggestion_id: implementedId as string });
  await managerClient.rpc("create_suggestion_action", {
    target_suggestion_id: implementedId as string,
    target_title: "Create standard pre-stage trolley",
    target_description: "Standardise tooling trolley layout before changeover.",
  });
  await managerClient.rpc("mark_suggestion_implemented", {
    target_suggestion_id: implementedId as string,
    target_implementation_summary: "Trolley pre-staged before each changeover.",
  });

  const { data: greatIdeaType, error: typeError } = await signedInAdmin
    .from("recognition_types")
    .select("id")
    .eq("code", "great-idea")
    .single();

  if (!operatorMembership || typeError || !greatIdeaType) {
    throw typeError ?? new Error("M9 recognition demo prerequisites missing");
  }

  await expectRpc(managerClient, "award_recognition", {
    target_recognition_type_id: greatIdeaType.id,
    target_title: "Great Idea",
    target_message: "Thank you for the pre-stage tooling improvement.",
    target_organisational_unit_id: operationsUnitId,
    target_visibility: "organisation",
    target_recipient_membership_ids: [operatorMembership.id],
    target_source_resource_id: implementedId as string,
  });

  console.log("M9 demo: suggestions and recognition seeded.");
}

async function ensureM8Demo(
  signedInAdmin: SupabaseClient,
  unitIds: UnitMap,
  apiUrl: string,
  publishableKey: string,
) {
  const managerClient = await signInUser(apiUrl, publishableKey, "manager");
  await switchOrganisation(
    managerClient,
    (await resolveOrganisationId(managerClient)) as string,
  );

  if (await isM8DemoComplete(managerClient)) {
    console.log("M8 demo already seeded.");
    return;
  }

  const operationsUnitId = unitIds["operations"];
  if (!operationsUnitId) {
    throw new Error("Demo operations unit is missing.");
  }

  const { data: memberships } = await managerClient
    .from("organisation_memberships")
    .select("id, user_id");
  const managerMembership = memberships?.find(
    (row) => row.user_id === DEMO_USERS.manager.id,
  );
  const operatorMembership = memberships?.find(
    (row) => row.user_id === DEMO_USERS.operator.id,
  );

  const methodologyVersionIds: Record<string, string> = {};

  for (const methodology of DEMO_CI_METHODOLOGIES) {
    methodologyVersionIds[methodology.code] = await ensurePublishedMethodology(
      managerClient,
      methodology,
    );
  }

  for (const project of DEMO_CI_PROJECTS) {
    const methodologyVersionId = methodologyVersionIds[project.methodologyCode];
    if (!methodologyVersionId) {
      throw new Error(`Missing published methodology for ${project.methodologyCode}`);
    }

    await ensureDemoProject(
      managerClient,
      operationsUnitId,
      project,
      methodologyVersionId,
      managerMembership?.id,
      operatorMembership?.id,
    );
  }

  console.log("M8 demo: methodologies and projects seeded.");
}

async function ensureDemoDisplayNames(apiUrl: string, publishableKey: string) {
  for (const userKey of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    const user = DEMO_USERS[userKey];
    const client = await signInUser(apiUrl, publishableKey, userKey);
    const { error } = await client
      .from("profiles")
      .update({ display_name: user.displayName })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
  }

  const seedDir = dirname(fileURLToPath(import.meta.url));
  execSync(
    `npx supabase db query --local -f "${join(seedDir, "set-membership-display-names.sql")}"`,
    { stdio: "inherit" },
  );
  execSync(
    `npx supabase db query --local -f "${join(seedDir, "set-profile-display-names.sql")}"`,
    { stdio: "inherit" },
  );
}

async function main() {
  const env = loadLocalSupabaseEnv();
  const admin = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(
    "Seeding Apex Manufacturing demo tenant (local development only)...",
  );

  for (const userKey of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    await ensureAuthUser(admin, userKey);
  }

  await provisionOrganisation(admin);

  const adminClient = await signInUser(env.apiUrl, env.publishableKey, "admin");
  const organisationId = await resolveOrganisationId(adminClient);
  await switchOrganisation(adminClient, organisationId);

  const unitIds = await ensureUnits(adminClient, organisationId);
  const managerRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "manager",
  );
  const operatorRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "operator",
  );
  const financeRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "financeValidator",
  );
  const psContributorRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "psContributor",
  );

  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "manager",
    managerRoleVersionId,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "operator",
    operatorRoleVersionId,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "finance",
    financeRoleVersionId,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "psContributor",
    psContributorRoleVersionId,
    unitIds,
  );

  await ensureDemoDisplayNames(env.apiUrl, env.publishableKey);

  await ensurePlatformSamples(adminClient);
  await ensureMaturityDemo(adminClient, unitIds);
  await ensureM6Demo(adminClient, unitIds);
  await ensureM7Demo(adminClient, unitIds);
  await ensureM8Demo(adminClient, unitIds, env.apiUrl, env.publishableKey);
  await ensureM9Demo(adminClient, admin, unitIds, env.apiUrl, env.publishableKey);
  await ensureM10Demo(
    adminClient,
    admin,
    organisationId,
    unitIds,
    env.apiUrl,
    env.publishableKey,
  );
  await ensureM11Demo(env.apiUrl, env.publishableKey, unitIds);

  console.log("Demo seed complete.");
  console.log(
    `Organisation: ${DEMO_ORGANISATION.name} (${DEMO_ORGANISATION.code})`,
  );
  console.log("Admin login: admin@apex.local");
  console.log(
    "Routes: /platform, /platform/maturity, /platform/5s, /platform/gemba, /platform/schedule, /platform/benefits, /platform/problem-solving",
  );
  console.log("Reset: npm run db:reset && npm run db:seed-demo");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
