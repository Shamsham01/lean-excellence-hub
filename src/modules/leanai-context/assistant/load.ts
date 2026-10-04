import "server-only";

import { cache } from "react";

import { assessCoachAiEligibility } from "@/modules/leanai-context/coach/eligibility";
import { loadLeanAiInterventionPermissions } from "@/modules/leanai-context/interventions/load";
import { loadLeanAiContextualSnapshot } from "@/modules/leanai-context/queries";
import { AI_PERMISSIONS } from "@/modules/operational/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  getMaturityFrameworkTemplate,
  maturityTemplateCounts,
} from "@/modules/maturity/templates";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import {
  currentMemberHasPermission,
  prefetchMemberPermissions,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { isAssistantUuid } from "./constants";
import { buildMaturityAuthoringState } from "./maturity-state";
import { buildMaturityAssessmentAssistantState } from "./maturity-assessment-state";
import { assistantPageDefinitionFor } from "./product-pages";
import { parseAssistantRoute } from "./route-map";
import { selectAssistantIntervention } from "./select-recommendation";
import { buildStructureAssistantState } from "./structure-state";
import {
  buildSuggestionsSetupState,
  suggestionsSetupGuidance,
} from "./suggestions-state";
import type { AssistantRelevantState, LeanAiAssistantView } from "./types";

export type AssistantRouteInput = {
  pathname: string;
  search?: string;
};

function flattenRemaining(
  items: Array<{ key: string; status: string; reason: string }>,
): LeanAiAssistantView["remainingSetup"] {
  return items
    .filter((item) => item.status !== "ready")
    .slice(0, 8)
    .map((item) => ({
      key: item.key,
      status: item.status,
      reason: item.reason,
    }));
}

export const loadLeanAiAssistantView = cache(
  async (input: AssistantRouteInput): Promise<LeanAiAssistantView | null> => {
    try {
      return await resolveLeanAiAssistantView(input);
    } catch {
      return null;
    }
  },
);

export async function resolveLeanAiAssistantView(
  input: AssistantRouteInput,
): Promise<LeanAiAssistantView> {
  const identity = parseAssistantRoute(input.pathname, input.search ?? "");
  const definition = assistantPageDefinitionFor(identity);

  await prefetchMemberPermissions([
    AI_PERMISSIONS.use,
    MATURITY_PERMISSIONS.modelsManage,
    "suggestions.programmes.manage",
  ]);

  const supabase = await createServerSupabaseClient();
  const [snapshot, permissions, site, canUseAi, eligibility, organisation] =
    await Promise.all([
      loadLeanAiContextualSnapshot(),
      loadLeanAiInterventionPermissions(),
      loadActiveSiteContext(),
      currentMemberHasPermission(AI_PERMISSIONS.use),
      assessCoachAiEligibility(supabase),
      loadCurrentOrganisationIdentity(),
    ]);

  if (
    !organisation ||
    organisation.organisationId !== snapshot.journey.organisationId
  ) {
    throw new Error("Current organisation identity could not be verified.");
  }

  const leanAiItem = snapshot.readiness.items.find(
    (item) => item.key === "lean_ai",
  );
  const organisationAiEnabled =
    leanAiItem?.reasonCode !== "lean_ai_disabled" &&
    leanAiItem?.supportingMetrics.organisation_enabled !== false;
  const conversationAvailable =
    eligibility.ok &&
    snapshot.applicationAiAvailable &&
    organisationAiEnabled &&
    canUseAi &&
    leanAiItem?.supportingMetrics.current_user_can_use !== false;

  let conversationUnavailableReason: string | null = null;
  if (!conversationAvailable) {
    if (!eligibility.ok) {
      conversationUnavailableReason = eligibility.message;
    } else if (!snapshot.applicationAiAvailable) {
      conversationUnavailableReason =
        "LeanAI conversation is turned off in this environment. Setup guidance below still works.";
    } else if (!organisationAiEnabled) {
      conversationUnavailableReason =
        "LeanAI is turned off for this organisation. Deterministic setup guidance still works.";
    } else if (!canUseAi) {
      conversationUnavailableReason =
        "You do not have permission to use LeanAI conversation. Setup guidance below still works.";
    } else {
      conversationUnavailableReason =
        "LeanAI conversation is unavailable. Setup guidance below still works.";
    }
  }

  const recommendation = selectAssistantIntervention({
    snapshot,
    permissions,
    pageSurface: identity.surface,
  });

  const relevantState: AssistantRelevantState = {};
  const allowedActions: string[] = [];
  let contextLabel = definition.contextLabel;
  let summary = definition.summary;
  const extraRemaining: string[] = [];
  let entityValidated = false;

  const [canManageMaturity, canManageProgrammes] = await Promise.all([
    currentMemberHasPermission(MATURITY_PERMISSIONS.modelsManage),
    currentMemberHasPermission("suggestions.programmes.manage"),
  ]);

  if (identity.workflow === "structure") {
    const { data: units } = await supabase
      .from("organisation_units")
      .select("id, parent_unit_id, status");
    const structure = buildStructureAssistantState(units ?? []);
    Object.assign(relevantState, structure.relevantState);
    summary = structure.summary;
    allowedActions.push(
      "Recommend a structure conversationally",
      "Explain organisational units",
    );
  }

  if (
    identity.module === "suggestions" &&
    (identity.workflow === "programme_configuration" ||
      identity.workflow === "suggestions_overview")
  ) {
    const [{ data: programmes }, { data: versions }, { data: categories }] =
      await Promise.all([
        supabase
          .from("suggestion_programmes")
          .select("id, name, status")
          .order("name"),
        supabase
          .from("suggestion_programme_versions")
          .select("programme_id, lifecycle"),
        supabase
          .from("suggestion_categories")
          .select("id, name, status")
          .order("display_order"),
      ]);
    const suggestions = buildSuggestionsSetupState({
      programmes: programmes ?? [],
      versions: versions ?? [],
      categories: categories ?? [],
      canManageProgrammes,
    });
    Object.assign(relevantState, suggestions.relevantState);
    allowedActions.push(...suggestions.allowedActions);
    extraRemaining.push(...suggestions.remaining);
    if (identity.workflow === "programme_configuration") {
      summary = suggestionsSetupGuidance(suggestions);
    }
  }

  if (
    identity.workflow === "maturity_models" ||
    identity.workflow === "maturity_overview"
  ) {
    const maturityItem = snapshot.readiness.items.find(
      (item) => item.key === "maturity",
    );
    relevantState.maturityFrameworkCount = Number(
      maturityItem?.supportingMetrics.model_count ?? 0,
    );
    relevantState.publishedMaturityVersionCount = Number(
      maturityItem?.supportingMetrics.published_version_count ?? 0,
    );
    relevantState.quickStartAvailable = true;
    if (canManageMaturity) {
      allowedActions.push(
        "Preview the LEH Operational Excellence Standard",
        "Create an organisation-owned draft from Quick Start",
        "Create a framework manually",
      );
    }
    if (canManageMaturity && maturityItem?.reasonCode === "maturity_none") {
      extraRemaining.push(
        "You can start manually or deploy the LEH Operational Excellence Standard as a draft.",
      );
    }
  }

  if (identity.workflow === "maturity_template_preview") {
    const templateKey = identity.pathname.split("/").at(-1) ?? "";
    const template = getMaturityFrameworkTemplate(templateKey);
    if (template) {
      const counts = maturityTemplateCounts(template);
      relevantState.templateKey = template.key;
      relevantState.templateName = template.name;
      relevantState.levelCount = counts.levels;
      relevantState.pillarCount = counts.pillars;
      relevantState.criterionCount = counts.criteria;
      relevantState.questionCount = counts.scoredQuestions;
      relevantState.deploysAsDraft = true;
      allowedActions.push("Explain this Quick Start template");
      if (canManageMaturity) {
        allowedActions.push(
          "Use this template to create an organisation-owned draft. LeanAI will not deploy or publish it.",
        );
      }
    }
  }

  if (
    identity.workflow === "maturity_authoring" &&
    isAssistantUuid(identity.entityId)
  ) {
    const { data: model } = await supabase
      .from("maturity_models")
      .select("id, display_name, description")
      .eq("id", identity.entityId)
      .maybeSingle();

    if (model) {
      entityValidated = true;
      const { data: versions } = await supabase
        .from("maturity_model_versions")
        .select("id, status, display_name, description")
        .eq("model_id", model.id)
        .order("version_number", { ascending: false });
      const draftVersion = versions?.find((row) => row.status === "draft");
      const publishedVersion = versions?.find(
        (row) => row.status === "published",
      );
      const editorVersion = draftVersion ?? publishedVersion;
      const versionStatus = draftVersion
        ? "draft"
        : publishedVersion
          ? "published"
          : "none";
      const displayName =
        draftVersion?.display_name ||
        publishedVersion?.display_name ||
        model.display_name;
      const description =
        draftVersion?.description ??
        publishedVersion?.description ??
        model.description;

      let assessmentScopes: string[] = [];
      const levels: Array<{ name: string }> = [];
      const pillars: Array<{
        id: string;
        name: string;
        position: number;
        section_id: string;
      }> = [];
      const criteria: Array<{
        id: string;
        name: string;
        pillar_id: string;
        position: number;
      }> = [];
      const questions: Array<{
        id: string;
        prompt: string;
        criterion_id: string;
        position: number;
      }> = [];

      if (editorVersion) {
        const structure = await loadMaturityAuthoringStructure(
          supabase,
          editorVersion.id,
        );
        assessmentScopes = structure.assessmentScopes;
        levels.push(...structure.levels);
        pillars.push(...structure.pillars);
        criteria.push(...structure.criteria);
        questions.push(...structure.questions);
      }

      const maturity = buildMaturityAuthoringState({
        model: {
          id: model.id,
          displayName,
          description,
        },
        authoringStep: identity.authoringStep ?? "details",
        versionStatus,
        assessmentScopes,
        levels,
        pillars,
        criteria,
        questions,
        canManage: canManageMaturity,
      });
      contextLabel = maturity.contextLabel;
      Object.assign(relevantState, maturity.relevantState);
      allowedActions.push(...maturity.allowedActions);
      extraRemaining.push(...maturity.remaining);
    }
  }

  if (
    identity.workflow === "maturity_assessment" &&
    isAssistantUuid(identity.entityId)
  ) {
    const snapshotState = await loadMaturityAssessmentAssistantSnapshot(
      supabase,
      identity.entityId,
      identity.search,
    );
    if (snapshotState) {
      entityValidated = true;
      contextLabel = snapshotState.contextLabel;
      summary = definition.summary;
      Object.assign(relevantState, snapshotState.relevantState);
      allowedActions.push(...snapshotState.allowedActions);
      extraRemaining.push(...snapshotState.remaining);
    }
  }

  const remainingSetup = flattenRemaining(snapshot.readiness.items);
  for (const reason of extraRemaining) {
    if (
      !remainingSetup.some((item) => item.reason === reason) &&
      remainingSetup.length < 8
    ) {
      remainingSetup.push({
        key: identity.module,
        status: "incomplete",
        reason,
      });
    }
  }

  const grantedActions = Object.entries(permissions)
    .filter(([, granted]) => granted)
    .map(([key]) => key)
    .slice(0, 12);

  const activeSite =
    site.context.mode === "site"
      ? (site.context.sites.find(
          (entry) => entry.id === site.context.activeSiteId,
        )?.name ?? null)
      : null;

  return {
    organisationId: snapshot.journey.organisationId,
    membershipId: snapshot.journey.membershipId,
    organisation: {
      name: organisation.organisationName,
    },
    capabilities: {
      webSearchEnabled: snapshot.webSearchEnabled,
    },
    applicationAiAvailable: snapshot.applicationAiAvailable,
    conversationAvailable,
    conversationUnavailableReason,
    contextLabel,
    page: {
      module: identity.module,
      workflow: identity.workflow,
      route: `${identity.pathname}${identity.search}`,
      pageTitle: definition.pageTitle,
      authoringStep: identity.authoringStep,
      entityValidated,
    },
    site: {
      mode: site.context.mode,
      activeSiteName: activeSite,
    },
    terminology: [...definition.terminology],
    starterPrompts: [...definition.starterPrompts],
    summary,
    remainingSetup,
    relevantState,
    allowedActions:
      allowedActions.length > 0 ? allowedActions : grantedActions.slice(0, 6),
    recommendation,
  };
}

type AssistantSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function loadMaturityAssessmentAssistantSnapshot(
  supabase: AssistantSupabase,
  assessmentId: string,
  search: string,
): Promise<ReturnType<typeof buildMaturityAssessmentAssistantState> | null> {
  const { data: assessment } = await supabase
    .from("maturity_assessments")
    .select(
      "id, status, assessment_type, model_version_id, submission_id, unit_id",
    )
    .eq("id", assessmentId)
    .maybeSingle();
  if (!assessment) {
    return null;
  }

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const requestedCriterionId = params.get("criterion");
  const requestedQuestionId = params.get("question");

  const [
    { data: unit },
    { data: version },
    { data: pillars },
    { data: answers },
  ] = await Promise.all([
    supabase
      .from("organisation_units")
      .select("name")
      .eq("id", assessment.unit_id)
      .maybeSingle(),
    supabase
      .from("maturity_model_versions")
      .select("display_name")
      .eq("id", assessment.model_version_id)
      .maybeSingle(),
    supabase
      .from("maturity_pillars")
      .select("id, name, position")
      .eq("model_version_id", assessment.model_version_id)
      .order("position"),
    supabase
      .from("template_answers")
      .select("question_id, text_value, number_value, is_not_applicable")
      .eq("submission_id", assessment.submission_id),
  ]);

  const pillarRows = pillars ?? [];
  const pillarIds = pillarRows.map((pillar) => pillar.id);
  const { data: criterionRows } =
    pillarIds.length > 0
      ? await supabase
          .from("maturity_criteria")
          .select("id, name, pillar_id, position")
          .in("pillar_id", pillarIds)
          .order("position")
      : { data: [] };
  const criteria = criterionRows ?? [];
  const criterionIds = criteria.map((criterion) => criterion.id);
  const { data: linkRows } =
    criterionIds.length > 0
      ? await supabase
          .from("maturity_criterion_questions")
          .select("criterion_id, question_id")
          .in("criterion_id", criterionIds)
      : { data: [] };
  const links = linkRows ?? [];
  const questionIds = [...new Set(links.map((link) => link.question_id))];
  const { data: questionRows } =
    questionIds.length > 0
      ? await supabase
          .from("template_questions")
          .select("id, prompt, is_required")
          .in("id", questionIds)
      : { data: [] };
  const questionById = new Map(
    (questionRows ?? []).map((row) => [row.id, row]),
  );
  const answerById = new Map(
    (answers ?? []).map((row) => [
      row.question_id,
      {
        text_value: row.text_value,
        number_value: row.number_value,
        is_not_applicable: row.is_not_applicable,
      },
    ]),
  );

  let totalRequired = 0;
  let answeredRequired = 0;
  let currentPillarName: string | null = null;
  let currentCriterionName: string | null = null;
  let currentQuestionPrompt: string | null = null;
  const firstCriterion = criteria[0];
  const activeCriterionId =
    requestedCriterionId && criterionIds.includes(requestedCriterionId)
      ? requestedCriterionId
      : (firstCriterion?.id ?? null);

  for (const criterion of criteria) {
    const pillar = pillarRows.find((row) => row.id === criterion.pillar_id);
    if (criterion.id === activeCriterionId) {
      currentCriterionName = criterion.name;
      currentPillarName = pillar?.name ?? null;
    }
    for (const link of links.filter(
      (item) => item.criterion_id === criterion.id,
    )) {
      const question = questionById.get(link.question_id);
      if (!question) continue;
      if (
        criterion.id === activeCriterionId &&
        (requestedQuestionId
          ? question.id === requestedQuestionId
          : currentQuestionPrompt == null)
      ) {
        currentQuestionPrompt = question.prompt;
      }
      if (!question.is_required) continue;
      totalRequired += 1;
      const answer = answerById.get(question.id);
      const answered =
        Boolean(answer?.is_not_applicable) ||
        Boolean(answer?.text_value) ||
        answer?.number_value != null;
      if (answered) {
        answeredRequired += 1;
      }
    }
  }

  return buildMaturityAssessmentAssistantState({
    assessmentType: assessment.assessment_type,
    status: assessment.status,
    unitName: unit?.name ?? "Unknown unit",
    frameworkName: version?.display_name ?? null,
    currentPillarName,
    currentCriterionName,
    currentQuestionPrompt,
    answeredRequired,
    totalRequired,
    remainingRequired: Math.max(0, totalRequired - answeredRequired),
  });
}

async function loadMaturityAuthoringStructure(
  supabase: AssistantSupabase,
  versionId: string,
): Promise<{
  assessmentScopes: string[];
  levels: Array<{ name: string }>;
  pillars: Array<{
    id: string;
    name: string;
    position: number;
    section_id: string;
  }>;
  criteria: Array<{
    id: string;
    name: string;
    pillar_id: string;
    position: number;
  }>;
  questions: Array<{
    id: string;
    prompt: string;
    criterion_id: string;
    position: number;
  }>;
}> {
  const [{ data: scopeRows }, { data: levelRows }, { data: pillarRows }] =
    await Promise.all([
      supabase
        .from("maturity_model_version_assessment_scopes")
        .select("scope_type")
        .eq("model_version_id", versionId),
      supabase
        .from("maturity_levels")
        .select("name")
        .eq("model_version_id", versionId)
        .order("level_number"),
      supabase
        .from("maturity_pillars")
        .select("id, name, position, section_id")
        .eq("model_version_id", versionId)
        .order("position"),
    ]);

  const pillars = pillarRows ?? [];
  const pillarIds = pillars.map((pillar) => pillar.id);
  const { data: criterionRows } =
    pillarIds.length > 0
      ? await supabase
          .from("maturity_criteria")
          .select("id, name, pillar_id, position")
          .in("pillar_id", pillarIds)
          .order("position")
      : { data: [] };
  const criteria = criterionRows ?? [];
  const criterionIds = criteria.map((criterion) => criterion.id);

  const { data: linkRows } =
    criterionIds.length > 0
      ? await supabase
          .from("maturity_criterion_questions")
          .select("criterion_id, question_id")
          .in("criterion_id", criterionIds)
          .eq("contributes_to_score", true)
      : { data: [] };
  const links = linkRows ?? [];
  const questionIds = [...new Set(links.map((link) => link.question_id))];
  const { data: questionRows } =
    questionIds.length > 0
      ? await supabase
          .from("template_questions")
          .select("id, prompt, position")
          .in("id", questionIds)
      : { data: [] };
  const questionById = new Map(
    (questionRows ?? []).map((row) => [row.id, row]),
  );
  const questions = links.flatMap((link) => {
    const question = questionById.get(link.question_id);
    if (!question) {
      return [];
    }
    return [
      {
        id: question.id,
        prompt: question.prompt,
        criterion_id: link.criterion_id,
        position: question.position,
      },
    ];
  });

  return {
    assessmentScopes: (scopeRows ?? []).map((row) => row.scope_type),
    levels: levelRows ?? [],
    pillars,
    criteria,
    questions,
  };
}
