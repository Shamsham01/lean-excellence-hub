"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  mapCoachRpcError,
  type CoachAiDenialReason,
} from "@/modules/leanai-context/coach/eligibility";
import {
  buildMaturityBuilderContext,
  deriveMaturityBuilderConversation,
  maturityBuilderHistory,
  maturityBuilderProposalToDefinition,
  nextMaturityBuilderBoundary,
  resolveMaturityBuilderFocus,
  MATURITY_BUILDER_CONTEXT_CONTRACT_VERSION,
  MATURITY_BUILDER_DECLARED_KEY,
  MATURITY_BUILDER_HISTORY_WINDOW,
  MATURITY_BUILDER_INTERVENTION_KEY,
  MATURITY_BUILDER_MAX_MESSAGE_CHARS,
  MATURITY_BUILDER_MAX_TURNS,
  MATURITY_BUILDER_MODULE_KEY,
  MATURITY_BUILDER_ROUTE,
  MATURITY_BUILDER_SESSION_TITLE,
  type MaturityBuilderAssistantTurn,
  type MaturityBuilderConversationState,
  type MaturityBuilderFocus,
  type MaturityBuilderIntent,
  type MaturityBuilderRequestIntent,
} from "@/modules/maturity/ai-builder";
import {
  findActiveMaturityBuilderSessionId,
  loadMaturityBuilderAccess,
  loadMaturityBuilderOrganisationFacts,
  readMaturityBuilderBoundary,
  readMaturityBuilderSessionDetail,
  writeMaturityBuilderBoundary,
  type MaturityBuilderAccess,
} from "@/modules/maturity/ai-builder/load";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import { runMaturityBuilderTurn } from "@/platform/ai/maturity-builder-orchestrator";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type MaturityBuilderFailureReason =
  CoachAiDenialReason | "invalid_request" | "stale_proposal";

export type MaturityBuilderTurnResult =
  | {
      ok: true;
      outcome: "ok" | "invalid_response" | "invalid_proposal";
      conversation: MaturityBuilderConversationState;
    }
  | {
      ok: false;
      reason: MaturityBuilderFailureReason;
      message: string;
      conversation: MaturityBuilderConversationState | null;
    };

const REQUEST_INTENTS = new Set<MaturityBuilderRequestIntent>([
  "answer",
  "propose",
  "refine",
  "retry",
]);
const DEFAULT_PROPOSE_REQUEST =
  "Please draft the full framework proposal now, using what you know so far.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function accessFailure(access: MaturityBuilderAccess): {
  reason: MaturityBuilderFailureReason;
  message: string;
} {
  switch (access.reason) {
    case "manage_permission_required":
    case "ai_permission_required":
      return { reason: "permission_denied", message: access.message };
    case "organisation_ai_disabled":
      return { reason: "organisation_ai_disabled", message: access.message };
    case "entitlement_denied":
      return { reason: "entitlement_denied", message: access.message };
    case "subscription_inactive":
      return { reason: "subscription_inactive", message: access.message };
    case "application_unavailable":
      return { reason: "application_unavailable", message: access.message };
    default:
      return {
        reason: "application_unavailable",
        message: "LeanAI is not available.",
      };
  }
}

async function readConversation(
  supabase: ServerSupabase,
  sessionId: string,
  organisationId: string,
): Promise<MaturityBuilderConversationState | null> {
  const [detail, conversationStartedAt] = await Promise.all([
    readMaturityBuilderSessionDetail(supabase, sessionId),
    readMaturityBuilderBoundary(organisationId),
  ]);
  if (!detail) {
    return null;
  }
  return deriveMaturityBuilderConversation(detail, {
    sessionId,
    conversationStartedAt,
  });
}

type PlannedTurn = {
  intent: MaturityBuilderIntent;
  focus: MaturityBuilderFocus | null;
  focusLabel: string | null;
  userRequest: string;
  retry: boolean;
};

function planTurn(
  requested: MaturityBuilderRequestIntent,
  message: string,
  focusInput: unknown,
  conversation: MaturityBuilderConversationState,
): PlannedTurn | { error: string } {
  const currentProposal = conversation.currentProposal?.proposal ?? null;

  if (requested === "retry") {
    let lastUserIndex = -1;
    conversation.turns.forEach((turn, index) => {
      if (turn.role === "user") {
        lastUserIndex = index;
      }
    });
    const lastUser = conversation.turns[lastUserIndex];
    if (!lastUser || lastUser.role !== "user") {
      return { error: "There is no earlier request to try again." };
    }
    const previous = conversation.turns
      .slice(lastUserIndex + 1)
      .find(
        (turn): turn is MaturityBuilderAssistantTurn =>
          turn.role === "assistant",
      );
    const resolved =
      previous?.intent === "refine"
        ? resolveMaturityBuilderFocus(previous.focus, currentProposal)
        : null;
    const intent: MaturityBuilderIntent =
      previous?.intent === "refine"
        ? resolved
          ? "refine"
          : "answer"
        : (previous?.intent ?? "answer");
    return {
      intent,
      focus: resolved?.focus ?? null,
      focusLabel: resolved?.label ?? null,
      userRequest: lastUser.text,
      retry: true,
    };
  }

  if (requested === "propose") {
    return {
      intent: "propose",
      focus: null,
      focusLabel: null,
      userRequest: message || DEFAULT_PROPOSE_REQUEST,
      retry: false,
    };
  }

  if (!message) {
    return { error: "Tell LeanAI a little more first." };
  }

  if (requested === "refine") {
    const resolved = resolveMaturityBuilderFocus(focusInput, currentProposal);
    if (!resolved) {
      return {
        error:
          "That part of the proposal is no longer available. Choose it again from the latest proposal.",
      };
    }
    return {
      intent: "refine",
      focus: resolved.focus,
      focusLabel: resolved.label,
      userRequest: `Refine ${resolved.label}: ${message}`,
      retry: false,
    };
  }

  return {
    intent: "answer",
    focus: null,
    focusLabel: null,
    userRequest: message,
    retry: false,
  };
}

/**
 * One builder turn. The model can only return a proposal envelope stored in
 * the member's own Coach session; it never writes framework records.
 */
export async function sendMaturityBuilderMessageAction(input: {
  message?: string;
  intent: MaturityBuilderRequestIntent;
  focus?: unknown;
  idempotencyKey?: string;
}): Promise<MaturityBuilderTurnResult> {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!REQUEST_INTENTS.has(input.intent)) {
    return {
      ok: false,
      reason: "invalid_request",
      message: "That builder action is not available.",
      conversation: null,
    };
  }
  if (message.length > MATURITY_BUILDER_MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      reason: "invalid_request",
      message: `Keep each message under ${MATURITY_BUILDER_MAX_MESSAGE_CHARS} characters.`,
      conversation: null,
    };
  }
  const idempotencyKey =
    typeof input.idempotencyKey === "string" &&
    UUID_PATTERN.test(input.idempotencyKey)
      ? input.idempotencyKey
      : randomUUID();

  let supabase: ServerSupabase | null = null;
  let sessionId: string | null = null;
  let organisationId: string | null = null;
  try {
    const [identity, access] = await Promise.all([
      loadCurrentOrganisationIdentity(),
      loadMaturityBuilderAccess(),
    ]);
    if (!identity) {
      return {
        ok: false,
        reason: "permission_denied",
        message: "Select an organisation before using LeanAI.",
        conversation: null,
      };
    }
    if (!access.available) {
      return { ok: false, ...accessFailure(access), conversation: null };
    }
    organisationId = identity.organisationId;
    supabase = await createServerSupabaseClient();

    const { data: resolvedSessionId, error: sessionError } = await supabase.rpc(
      "create_ai_coach_session",
      {
        target_module_key: MATURITY_BUILDER_MODULE_KEY,
        target_intervention_key: MATURITY_BUILDER_INTERVENTION_KEY,
        target_title: MATURITY_BUILDER_SESSION_TITLE,
        target_context_contract_version:
          MATURITY_BUILDER_CONTEXT_CONTRACT_VERSION,
      },
    );
    if (sessionError || !resolvedSessionId) {
      return {
        ok: false,
        reason: mapCoachRpcError(sessionError?.message ?? ""),
        message: "LeanAI could not start the framework builder.",
        conversation: null,
      };
    }
    sessionId = String(resolvedSessionId);

    const conversation = await readConversation(
      supabase,
      sessionId,
      organisationId,
    );
    if (!conversation) {
      return {
        ok: false,
        reason: "permission_denied",
        message: "The builder conversation could not be verified.",
        conversation: null,
      };
    }
    if (conversation.userTurnCount >= MATURITY_BUILDER_MAX_TURNS) {
      return {
        ok: false,
        reason: "usage_limit",
        message:
          "This builder conversation has reached its turn limit. Create the draft and continue in the editor, or start over.",
        conversation,
      };
    }

    const plan = planTurn(input.intent, message, input.focus, conversation);
    if ("error" in plan) {
      return {
        ok: false,
        reason: "invalid_request",
        message: plan.error,
        conversation,
      };
    }

    const facts = await loadMaturityBuilderOrganisationFacts(
      supabase,
      identity.organisationName,
    );
    const context = buildMaturityBuilderContext({
      facts,
      understanding: conversation.understanding,
      currentProposal: conversation.currentProposal?.proposal ?? null,
      intent: plan.intent,
      focusLabel: plan.focusLabel,
      retry: plan.retry,
    });

    const result = await runMaturityBuilderTurn({
      supabase,
      sessionId,
      userRequest: plan.userRequest,
      intent: plan.intent,
      focus: plan.focus,
      idempotencyKey,
      conversationHistory: maturityBuilderHistory(
        conversation,
        MATURITY_BUILDER_HISTORY_WINDOW,
      ),
      context,
    });

    const updated = await readConversation(supabase, sessionId, organisationId);
    if (!updated) {
      return {
        ok: false,
        reason: "provider_error",
        message: "LeanAI replied, but the conversation could not be reloaded.",
        conversation: null,
      };
    }
    return {
      ok: true,
      outcome:
        result.responseStatus === "invalid_response"
          ? "invalid_response"
          : result.proposalStatus === "invalid"
            ? "invalid_proposal"
            : "ok",
      conversation: updated,
    };
  } catch (error) {
    const rawMessage =
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "";
    const reason = mapCoachRpcError(rawMessage);
    const conversation =
      supabase && sessionId && organisationId
        ? await readConversation(supabase, sessionId, organisationId).catch(
            () => null,
          )
        : null;
    return {
      ok: false,
      reason,
      message: builderFailureMessage(reason),
      conversation,
    };
  }
}

function builderFailureMessage(reason: CoachAiDenialReason): string {
  switch (reason) {
    case "usage_limit":
      return "LeanAI usage limits have been reached for now. Your conversation is saved; try again later or continue manually.";
    case "organisation_ai_disabled":
      return "LeanAI is turned off for this organisation.";
    case "permission_denied":
      return "You do not have access to LeanAI for this action.";
    case "timeout":
      return "LeanAI took too long to reply. Nothing changed. Try again.";
    default:
      return "LeanAI could not reply just now. Nothing changed. Try again.";
  }
}

export type CreateDraftFromProposalResult =
  | { ok: true; modelId: string; redirectTo: string }
  | { ok: false; reason: MaturityBuilderFailureReason; message: string };

function draftCreationError(message: string): string {
  if (message.includes("not authorised")) {
    return "You do not have permission to create Maturity Frameworks.";
  }
  return "The draft could not be created. Nothing was saved or published. You can try again.";
}

/**
 * Explicit human acceptance. The proposal is re-read from the member's own
 * trusted session (never from the browser), re-validated, and created as a
 * DRAFT through the same RBAC-checked bulk RPC used by Quick Start.
 */
export async function createMaturityDraftFromBuilderProposalAction(input: {
  proposalMessageId: string;
}): Promise<CreateDraftFromProposalResult> {
  const proposalMessageId =
    typeof input.proposalMessageId === "string"
      ? input.proposalMessageId.trim()
      : "";
  if (!UUID_PATTERN.test(proposalMessageId)) {
    return {
      ok: false,
      reason: "invalid_request",
      message: "Choose a proposal to create.",
    };
  }

  const [identity, access] = await Promise.all([
    loadCurrentOrganisationIdentity(),
    loadMaturityBuilderAccess(),
  ]);
  if (!identity) {
    return {
      ok: false,
      reason: "permission_denied",
      message: "Select an organisation first.",
    };
  }
  if (!access.available) {
    return { ok: false, ...accessFailure(access) };
  }

  const supabase = await createServerSupabaseClient();
  const sessionId = await findActiveMaturityBuilderSessionId(
    supabase,
    identity.organisationId,
  );
  const conversation = sessionId
    ? await readConversation(supabase, sessionId, identity.organisationId)
    : null;
  const current = conversation?.currentProposal ?? null;
  if (!conversation || !current || current.messageId !== proposalMessageId) {
    return {
      ok: false,
      reason: "stale_proposal",
      message:
        "This proposal is no longer the latest one. Review the current proposal before creating a draft.",
    };
  }

  const definition = maturityBuilderProposalToDefinition(current.proposal);
  const { data, error } = await supabase.rpc(
    "create_maturity_model_draft_from_definition",
    {
      target_declared_template_key: MATURITY_BUILDER_DECLARED_KEY,
      target_definition: definition as unknown as Json,
    },
  );
  if (error || !data) {
    return {
      ok: false,
      reason: error?.message.includes("not authorised")
        ? "permission_denied"
        : "provider_error",
      message: draftCreationError(error?.message ?? ""),
    };
  }

  const boundary = nextMaturityBuilderBoundary(conversation.latestMessageAt);
  if (boundary) {
    await writeMaturityBuilderBoundary(identity.organisationId, boundary);
  }
  const modelId = String(data);
  revalidatePath("/platform/maturity");
  revalidatePath("/platform/maturity/models");
  revalidatePath(MATURITY_BUILDER_ROUTE);
  return {
    ok: true,
    modelId,
    redirectTo: `/platform/maturity/models/${modelId}?step=review`,
  };
}

/** Logical restart only: hides earlier turns; usage and limits are unchanged. */
export async function discardMaturityBuilderConversationAction(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const [identity, access] = await Promise.all([
    loadCurrentOrganisationIdentity(),
    loadMaturityBuilderAccess(),
  ]);
  if (!identity || !access.canManage) {
    return {
      ok: false,
      message: "You do not have access to the framework builder.",
    };
  }
  const supabase = await createServerSupabaseClient();
  const sessionId = await findActiveMaturityBuilderSessionId(
    supabase,
    identity.organisationId,
  );
  if (sessionId) {
    const conversation = await readConversation(
      supabase,
      sessionId,
      identity.organisationId,
    );
    const boundary = nextMaturityBuilderBoundary(
      conversation?.latestMessageAt ?? null,
    );
    if (boundary) {
      await writeMaturityBuilderBoundary(identity.organisationId, boundary);
    }
  }
  revalidatePath(MATURITY_BUILDER_ROUTE);
  return { ok: true };
}
