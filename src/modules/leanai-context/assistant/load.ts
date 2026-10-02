import "server-only";

import { cache } from "react";

import { assessCoachAiEligibility } from "@/modules/leanai-context/coach/eligibility";
import { loadLeanAiInterventionPermissions } from "@/modules/leanai-context/interventions/load";
import { loadLeanAiContextualSnapshot } from "@/modules/leanai-context/queries";
import { AI_PERMISSIONS } from "@/modules/operational/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import {
  currentMemberHasPermission,
  prefetchMemberPermissions,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { isAssistantUuid } from "./constants";
import { buildMaturityAuthoringState } from "./maturity-state";
import { assistantPageDefinitionFor } from "./product-pages";
import { parseAssistantRoute } from "./route-map";
import { selectAssistantIntervention } from "./select-recommendation";
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
  const [snapshot, permissions, site, canUseAi, eligibility] =
    await Promise.all([
      loadLeanAiContextualSnapshot(),
      loadLeanAiInterventionPermissions(),
      loadActiveSiteContext(),
      currentMemberHasPermission(AI_PERMISSIONS.use),
      assessCoachAiEligibility(supabase),
    ]);

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
