"use server";

import { randomUUID } from "node:crypto";

import {
  LEANAI_ASSISTANT_HISTORY_WINDOW,
  LEANAI_ASSISTANT_INTERVENTION_KEY,
  LEANAI_ASSISTANT_MAX_MESSAGE_CHARS,
  LEANAI_ASSISTANT_MAX_TURNS,
  LEANAI_ASSISTANT_MODULE_KEY,
  LEANAI_PAGE_CONTEXT_CONTRACT_VERSION,
} from "@/modules/leanai-context/assistant/constants";
import { failClosedConversationStartedAt } from "@/modules/leanai-context/assistant/conversation-boundary";
import { messagesFromSessionDetail } from "@/modules/leanai-context/assistant/conversation-history";
import { loadLeanAiAssistantView } from "@/modules/leanai-context/assistant/load";
import { coachPageContextFromView } from "@/modules/leanai-context/assistant/page-context";
import { parseAssistantRoute } from "@/modules/leanai-context/assistant/route-map";
import type {
  LeanAiAssistantChatMessage,
  LeanAiAssistantView,
} from "@/modules/leanai-context/assistant/types";
import {
  assembleCoachExplainContext,
  COACH_ASSISTANT_CONTEXT_CONTRACT_VERSION,
} from "@/modules/leanai-context/coach/context-assembly";
import {
  assessCoachAiEligibility,
  mapCoachRpcError,
  type CoachAiDenialReason,
} from "@/modules/leanai-context/coach/eligibility";
import { readTrustedCoachConversation } from "@/modules/leanai-context/coach/session-validation";
import { loadLeanAiInterventionPermissions } from "@/modules/leanai-context/interventions/load";
import type { LeanAiInterventionCandidate } from "@/modules/leanai-context/interventions/types";
import { loadLeanAiContextualSnapshot } from "@/modules/leanai-context/queries";
import { runCoachAiTurn } from "@/platform/ai/coach-orchestrator";
import type { CoachEnvelope } from "@/platform/ai/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type AssistantViewResult =
  { ok: true; view: LeanAiAssistantView } | { ok: false; error: string };

export async function loadLeanAiAssistantViewAction(input: {
  pathname: string;
  search?: string;
}): Promise<AssistantViewResult> {
  try {
    if (
      typeof input.pathname !== "string" ||
      !input.pathname.startsWith("/platform") ||
      input.pathname.length > 200
    ) {
      return { ok: false, error: "That workspace page is not available." };
    }
    const view = await loadLeanAiAssistantView(
      input.search
        ? { pathname: input.pathname, search: input.search }
        : { pathname: input.pathname },
    );
    if (!view) {
      return { ok: false, error: "LeanAI could not load this page context." };
    }
    return { ok: true, view };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "LeanAI could not load this page context.",
    };
  }
}

export type AssistantConversationResult =
  | {
      ok: true;
      sessionId: string | null;
      messages: LeanAiAssistantChatMessage[];
    }
  | { ok: false; error: string };

function trustedAssistantConversation(
  detail: unknown,
  sessionId: string,
  conversationStartedAt: string | null,
) {
  return readTrustedCoachConversation(
    detail,
    conversationStartedAt
      ? {
          sessionId,
          moduleKey: LEANAI_ASSISTANT_MODULE_KEY,
          interventionKey: LEANAI_ASSISTANT_INTERVENTION_KEY,
          conversationStartedAt,
        }
      : {
          sessionId,
          moduleKey: LEANAI_ASSISTANT_MODULE_KEY,
          interventionKey: LEANAI_ASSISTANT_INTERVENTION_KEY,
        },
  );
}

async function resolveWorkspaceAssistantSession(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  sessionId: string | null | undefined,
): Promise<
  | { ok: true; sessionId: string; detail: unknown }
  | { ok: false; reason: CoachAiDenialReason; message: string }
> {
  const { data: resolvedId, error: sessionError } = await supabase.rpc(
    "create_ai_coach_session",
    {
      target_module_key: LEANAI_ASSISTANT_MODULE_KEY,
      target_intervention_key: LEANAI_ASSISTANT_INTERVENTION_KEY,
      target_title: "LeanAI workspace assistant",
      target_context_contract_version: LEANAI_PAGE_CONTEXT_CONTRACT_VERSION,
    },
  );
  if (sessionError || !resolvedId) {
    return {
      ok: false,
      reason: mapCoachRpcError(sessionError?.message ?? ""),
      message:
        sessionError?.message ?? "LeanAI could not start this conversation.",
    };
  }
  const canonicalId = String(resolvedId);
  if (sessionId && sessionId !== canonicalId) {
    return {
      ok: false,
      reason: "permission_denied",
      message:
        "This LeanAI conversation belongs to a different workspace. Start again from the current organisation.",
    };
  }
  const { data: detail, error: detailError } = await supabase.rpc(
    "get_ai_session_detail",
    { target_ai_session_id: resolvedId },
  );
  if (detailError) {
    return {
      ok: false,
      reason: mapCoachRpcError(detailError.message),
      message: detailError.message,
    };
  }
  const trusted = trustedAssistantConversation(detail, canonicalId, null);
  if (!trusted) {
    return {
      ok: false,
      reason: "permission_denied",
      message: "The LeanAI conversation could not be verified.",
    };
  }
  return { ok: true, sessionId: canonicalId, detail };
}

export async function loadLeanAiAssistantConversationAction(input: {
  sessionId?: string | null;
  conversationStartedAt?: string;
}): Promise<AssistantConversationResult> {
  if (!input.sessionId) {
    return { ok: true, sessionId: null, messages: [] };
  }
  try {
    const conversationStartedAt = failClosedConversationStartedAt(
      input.conversationStartedAt,
    );
    const supabase = await createServerSupabaseClient();
    const { data: detail, error: detailError } = await supabase.rpc(
      "get_ai_session_detail",
      { target_ai_session_id: input.sessionId },
    );
    if (detailError) {
      return { ok: false, error: detailError.message };
    }
    const trusted = trustedAssistantConversation(
      detail,
      input.sessionId,
      conversationStartedAt,
    );
    if (!trusted) {
      return {
        ok: false,
        error:
          "This LeanAI conversation is no longer available in the current organisation.",
      };
    }
    return {
      ok: true,
      sessionId: input.sessionId,
      messages: messagesFromSessionDetail(detail, conversationStartedAt),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "LeanAI could not load the conversation.",
    };
  }
}

export type AssistantChatResult =
  | {
      ok: true;
      sessionId: string;
      envelope: CoachEnvelope;
      modelClass: "standard";
      externalSources: Array<{ title: string; url: string }>;
    }
  | {
      ok: false;
      reason: CoachAiDenialReason;
      message: string;
    };

function syntheticWorkspaceRecommendation(
  view: LeanAiAssistantView,
): LeanAiInterventionCandidate {
  return (
    view.recommendation ?? {
      key: LEANAI_ASSISTANT_INTERVENTION_KEY,
      moduleKey: view.page.module,
      readinessKey: "organisation",
      status: "ready",
      priority: 0,
      title: view.page.pageTitle,
      body: view.summary,
      explain: view.summary,
      primaryCtaLabel: "Continue",
      targetRoute: view.page.route.split("?")[0] || "/platform",
      snoozeMinutes: 1440,
      organisationId: view.organisationId,
    }
  );
}

export async function sendLeanAiAssistantMessageAction(input: {
  pathname: string;
  search?: string;
  message: string;
  sessionId?: string | null;
  idempotencyKey?: string;
  conversationStartedAt?: string;
}): Promise<AssistantChatResult> {
  const message = input.message.trim();
  if (!message) {
    return {
      ok: false,
      reason: "provider_error",
      message: "Ask LeanAI a question first.",
    };
  }
  if (message.length > LEANAI_ASSISTANT_MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      reason: "provider_error",
      message: "Please ask a shorter question.",
    };
  }
  if (
    typeof input.pathname !== "string" ||
    !input.pathname.startsWith("/platform")
  ) {
    return {
      ok: false,
      reason: "permission_denied",
      message: "LeanAI can only help inside the workspace.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const eligibility = await assessCoachAiEligibility(supabase);
    if (!eligibility.ok) {
      return {
        ok: false,
        reason: eligibility.reason,
        message: eligibility.message,
      };
    }

    const view = await loadLeanAiAssistantView(
      input.search
        ? { pathname: input.pathname, search: input.search }
        : { pathname: input.pathname },
    );
    if (!view) {
      return {
        ok: false,
        reason: "provider_error",
        message: "LeanAI could not load the current page context.",
      };
    }
    if (!view.conversationAvailable) {
      return {
        ok: false,
        reason: view.applicationAiAvailable
          ? "permission_denied"
          : "application_unavailable",
        message:
          view.conversationUnavailableReason ??
          "LeanAI conversation is unavailable.",
      };
    }

    const [snapshot, permissions] = await Promise.all([
      loadLeanAiContextualSnapshot(),
      loadLeanAiInterventionPermissions(),
    ]);
    if (snapshot.journey.organisationId !== view.organisationId) {
      return {
        ok: false,
        reason: "permission_denied",
        message: "The workspace organisation changed. Reload LeanAI.",
      };
    }

    const identity = parseAssistantRoute(input.pathname, input.search);
    const recommendation = syntheticWorkspaceRecommendation(view);
    const { context, provenanceHash } = assembleCoachExplainContext({
      snapshot,
      recommendation,
      permissions,
      surface: identity.surface,
      canUseAi: true,
      organisationName: view.organisation.name,
      webSearchEnabled: view.capabilities.webSearchEnabled,
      page: coachPageContextFromView(view),
      contractVersion: COACH_ASSISTANT_CONTEXT_CONTRACT_VERSION,
    });

    const resolved = await resolveWorkspaceAssistantSession(
      supabase,
      input.sessionId,
    );
    if (!resolved.ok) {
      return {
        ok: false,
        reason: resolved.reason,
        message: resolved.message,
      };
    }

    const conversationStartedAt = failClosedConversationStartedAt(
      input.conversationStartedAt,
    );
    const trustedHistory = trustedAssistantConversation(
      resolved.detail,
      resolved.sessionId,
      conversationStartedAt,
    );
    if (!trustedHistory) {
      return {
        ok: false,
        reason: "permission_denied",
        message: "The LeanAI conversation could not be verified.",
      };
    }
    if (trustedHistory.priorTurnCount >= LEANAI_ASSISTANT_MAX_TURNS) {
      return {
        ok: false,
        reason: "usage_limit",
        message:
          "This LeanAI conversation has reached its turn limit. Start a new conversation to keep using setup guidance, or continue manually.",
      };
    }

    const conversationHistory = trustedHistory.conversationHistory.slice(
      -LEANAI_ASSISTANT_HISTORY_WINDOW,
    );

    const result = await runCoachAiTurn({
      supabase,
      sessionId: resolved.sessionId,
      task: "setup_conversation",
      userMessage: message,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      conversationHistory,
      context,
      provenanceHash,
      webSearchEnabled: view.capabilities.webSearchEnabled,
    });

    return {
      ok: true,
      sessionId: resolved.sessionId,
      envelope: result.envelope,
      modelClass: "standard",
      externalSources: result.externalSources,
    };
  } catch (error) {
    const messageText =
      error instanceof Error
        ? error.message
        : "LeanAI could not complete this reply.";
    return {
      ok: false,
      reason: mapCoachRpcError(messageText),
      message: messageText,
    };
  }
}
