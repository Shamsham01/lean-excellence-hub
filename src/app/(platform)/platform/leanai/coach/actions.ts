"use server";

import { randomUUID } from "node:crypto";

import { assembleCoachExplainContext } from "@/modules/leanai-context/coach/context-assembly";
import {
  assessCoachAiEligibility,
  mapCoachRpcError,
  type CoachAiDenialReason,
} from "@/modules/leanai-context/coach/eligibility";
import { leanAiInterventionByKey } from "@/modules/leanai-context/interventions/catalogue";
import { loadLeanAiInterventionPermissions } from "@/modules/leanai-context/interventions/load";
import type {
  LeanAiCoachSurface,
  LeanAiInterventionCandidate,
} from "@/modules/leanai-context/interventions/types";
import { loadLeanAiContextualSnapshot } from "@/modules/leanai-context/queries";
import { runCoachAiTurn } from "@/platform/ai/coach-orchestrator";
import type { CoachEnvelope } from "@/platform/ai/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const MAX_FOLLOW_UP_TURNS = 6;
const MAX_FOLLOW_UP_CHARS = 2000;

export type CoachExplainResult =
  | {
      ok: true;
      source: "ai";
      sessionId: string;
      envelope: CoachEnvelope;
      modelClass: "economy";
    }
  | {
      ok: false;
      source: "static";
      reason: CoachAiDenialReason;
      message: string;
    };

export async function explainLeanAiCoachIntervention(input: {
  interventionKey: string;
  surface: LeanAiCoachSurface;
  sessionId?: string | null;
  followUp?: string | null;
  conversationTurns?: number;
  idempotencyKey?: string;
}): Promise<CoachExplainResult> {
  const followUp = input.followUp?.trim() ?? "";
  if (followUp.length > MAX_FOLLOW_UP_CHARS) {
    return {
      ok: false,
      source: "static",
      reason: "provider_error",
      message: "Please ask a shorter follow-up.",
    };
  }
  if ((input.conversationTurns ?? 0) >= MAX_FOLLOW_UP_TURNS) {
    return {
      ok: false,
      source: "static",
      reason: "usage_limit",
      message: "This explanation has reached its follow-up limit.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const eligibility = await assessCoachAiEligibility(supabase);
    if (!eligibility.ok) {
      return {
        ok: false,
        source: "static",
        reason: eligibility.reason,
        message: eligibility.message,
      };
    }

    const definition = leanAiInterventionByKey(input.interventionKey);
    if (!definition) {
      return {
        ok: false,
        source: "static",
        reason: "provider_error",
        message: "That setup recommendation is no longer available.",
      };
    }

    const [snapshot, permissions] = await Promise.all([
      loadLeanAiContextualSnapshot(),
      loadLeanAiInterventionPermissions(),
    ]);

    const readinessItem = snapshot.readiness.items.find(
      (item) => item.key === definition.readinessKey,
    );
    const recommendation: LeanAiInterventionCandidate = {
      key: definition.key,
      moduleKey: definition.moduleKey,
      readinessKey: definition.readinessKey,
      status: readinessItem?.status ?? "not_started",
      priority: definition.priority,
      title: definition.title,
      body: definition.body,
      explain: definition.explain,
      primaryCtaLabel: definition.primaryCtaLabel,
      targetRoute: definition.targetRoute,
      snoozeMinutes: definition.snoozeMinutes,
      organisationId: snapshot.journey.organisationId,
    };

    const leanAiItem = snapshot.readiness.items.find(
      (item) => item.key === "lean_ai",
    );
    if (
      leanAiItem?.reasonCode === "lean_ai_disabled" ||
      leanAiItem?.supportingMetrics.organisation_enabled === false
    ) {
      return {
        ok: false,
        source: "static",
        reason: "organisation_ai_disabled",
        message: "LeanAI is turned off for this organisation.",
      };
    }
    if (
      leanAiItem?.reasonCode === "lean_ai_no_permission" ||
      leanAiItem?.supportingMetrics.current_user_can_use === false
    ) {
      return {
        ok: false,
        source: "static",
        reason: "permission_denied",
        message: "You do not have permission to use LeanAI.",
      };
    }

    const { context, provenanceHash } = assembleCoachExplainContext({
      snapshot,
      recommendation,
      permissions,
      surface: input.surface,
      canUseAi: true,
    });

    const { data: sessionId, error: sessionError } = input.sessionId
      ? { data: input.sessionId, error: null }
      : await supabase.rpc("create_ai_coach_session", {
          target_module_key: definition.moduleKey,
          target_intervention_key: definition.key,
          target_title: definition.title,
          target_context_contract_version: context.contractVersion,
        });

    if (sessionError || !sessionId) {
      return {
        ok: false,
        source: "static",
        reason: mapCoachRpcError(sessionError?.message ?? ""),
        message:
          sessionError?.message ??
          "LeanAI could not start a Coach conversation.",
      };
    }

    const conversationHistory = await loadCoachConversationHistory(
      supabase,
      String(sessionId),
    );

    const userMessage = followUp
      ? followUp
      : `Explain this LeanAI Coach recommendation for the ${definition.moduleKey} module. Intervention: ${definition.key}.`;

    const result = await runCoachAiTurn({
      supabase,
      sessionId: String(sessionId),
      task: followUp ? "explain_follow_up" : "explain",
      userMessage,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      conversationHistory,
      context,
      provenanceHash,
    });

    return {
      ok: true,
      source: "ai",
      sessionId: String(sessionId),
      envelope: result.envelope,
      modelClass: "economy",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "LeanAI could not complete this explanation.";
    return {
      ok: false,
      source: "static",
      reason: mapCoachRpcError(message),
      message,
    };
  }
}

async function loadCoachConversationHistory(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  sessionId: string,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const { data } = await supabase.rpc("get_ai_session_detail", {
    target_ai_session_id: sessionId,
  });
  const record =
    data !== null && typeof data === "object" && !Array.isArray(data)
      ? (data as { messages?: Array<{ role?: string; content?: string }> })
      : {};
  return (record.messages ?? [])
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    }));
}
