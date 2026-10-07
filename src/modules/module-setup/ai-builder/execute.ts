import "server-only";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  mapCoachRpcError,
  type CoachAiDenialReason,
} from "@/modules/leanai-context/coach/eligibility";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import type { ModuleSetupBuilderAdapter } from "@/platform/ai/module-setup-builder-orchestrator";
import { runModuleSetupBuilderTurn } from "@/platform/ai/module-setup-builder-orchestrator";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import {
  loadModuleSetupBuilderAccess,
  readModuleSetupBuilderBoundary,
  writeModuleSetupBuilderBoundary,
  type ModuleSetupBuilderAccess,
} from "./access";
import {
  buildModuleSetupBuilderContext,
  type ModuleSetupOrganisationFacts,
} from "./context";
import {
  deriveModuleSetupBuilderConversation,
  moduleSetupBuilderHistory,
  nextModuleSetupBuilderBoundary,
  resolveModuleSetupBuilderFocus,
} from "./conversation";
import {
  MODULE_SETUP_BUILDER_HISTORY_WINDOW,
  MODULE_SETUP_BUILDER_MAX_MESSAGE_CHARS,
  MODULE_SETUP_BUILDER_MAX_TURNS,
  type ModuleSetupBuilderAssistantTurn,
  type ModuleSetupBuilderConversationState,
  type ModuleSetupBuilderRequestIntent,
} from "./types";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type ModuleSetupBuilderFailureReason =
  CoachAiDenialReason | "invalid_request" | "stale_proposal";

export type ModuleSetupTurnResult<TProposal> =
  | {
      ok: true;
      outcome: "ok" | "invalid_response" | "invalid_proposal";
      conversation: ModuleSetupBuilderConversationState<TProposal>;
    }
  | {
      ok: false;
      reason: ModuleSetupBuilderFailureReason;
      message: string;
      conversation: ModuleSetupBuilderConversationState<TProposal> | null;
    };

const REQUEST_INTENTS = new Set<ModuleSetupBuilderRequestIntent>([
  "answer",
  "propose",
  "refine",
  "retry",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ModuleSetupBuilderModule<TProposal> = {
  moduleKey: "five_s" | "gemba";
  interventionKey: "setup_builder";
  sessionTitle: string;
  contextContract: string;
  cookiePath: string;
  managePermission: string;
  moduleLabel: string;
  route: string;
  overviewPath: string;
  payloadKind: string;
  declaredKey: string;
  namesTable: "five_s_standards" | "gemba_definitions";
  adapter: ModuleSetupBuilderAdapter;
  limits: Record<string, unknown>;
  revalidateProposal: (value: unknown) => TProposal | null;
  counts: (proposal: TProposal) => { sections: number; items: number };
  sectionCount: (proposal: TProposal) => number;
  toContextProposal: (proposal: TProposal) => unknown;
  definitionFromAcceptance: (
    proposal: TProposal,
    formData: FormData,
  ) => { definition: Json } | { error: string };
  rpc:
    | "create_five_s_standard_draft_from_definition"
    | "create_gemba_definition_draft_from_definition";
  draftPath: (id: string) => string;
};

function accessFailure(access: ModuleSetupBuilderAccess): {
  reason: ModuleSetupBuilderFailureReason;
  message: string;
} {
  if (access.available) {
    return {
      reason: "application_unavailable",
      message: "LeanAI is not available.",
    };
  }
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
    default:
      return { reason: "application_unavailable", message: access.message };
  }
}

async function readConversation<TProposal>(
  supabase: ServerSupabase,
  module: ModuleSetupBuilderModule<TProposal>,
  sessionId: string,
  organisationId: string,
): Promise<ModuleSetupBuilderConversationState<TProposal> | null> {
  const [detailResult, conversationStartedAt] = await Promise.all([
    supabase.rpc("get_ai_session_detail", { target_ai_session_id: sessionId }),
    readModuleSetupBuilderBoundary(module.moduleKey, organisationId),
  ]);
  if (detailResult.error || !detailResult.data) {
    return null;
  }
  return deriveModuleSetupBuilderConversation(
    detailResult.data,
    {
      sessionId,
      conversationStartedAt,
      moduleKey: module.moduleKey,
      interventionKey: module.interventionKey,
      payloadKind: module.payloadKind,
    },
    module.revalidateProposal,
    module.counts,
  );
}

async function loadFacts<TProposal>(
  supabase: ServerSupabase,
  module: ModuleSetupBuilderModule<TProposal>,
  organisationName: string,
): Promise<ModuleSetupOrganisationFacts> {
  const [{ data: rows }, counted, site] = await Promise.all([
    supabase
      .from(module.namesTable)
      .select("display_name")
      .order("display_name")
      .limit(20),
    supabase
      .from(module.namesTable)
      .select("id", { count: "exact", head: true }),
    loadActiveSiteContext(),
  ]);
  const names = (rows ?? [])
    .map((row) => row.display_name)
    .filter(
      (name): name is string => typeof name === "string" && name.length > 0,
    );
  return {
    organisationName,
    activeSiteName:
      site.context.mode === "site"
        ? (site.context.sites.find(
            (item) => item.id === site.context.activeSiteId,
          )?.name ?? null)
        : null,
    unitNames: site.units.map((unit) => unit.name).slice(0, 24),
    existingConfigurationNames: names,
    configurationCount: counted.count ?? names.length,
  };
}

export async function sendModuleSetupBuilderMessage<TProposal>(
  module: ModuleSetupBuilderModule<TProposal>,
  input: {
    message?: string;
    intent: ModuleSetupBuilderRequestIntent;
    focus?: unknown;
    idempotencyKey?: string;
  },
): Promise<ModuleSetupTurnResult<TProposal>> {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!REQUEST_INTENTS.has(input.intent)) {
    return {
      ok: false,
      reason: "invalid_request",
      message: "That builder action is not available.",
      conversation: null,
    };
  }
  if (message.length > MODULE_SETUP_BUILDER_MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      reason: "invalid_request",
      message: `Keep each message under ${MODULE_SETUP_BUILDER_MAX_MESSAGE_CHARS} characters.`,
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
      loadModuleSetupBuilderAccess({
        managePermission: module.managePermission,
        moduleLabel: module.moduleLabel,
      }),
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
        target_module_key: module.moduleKey,
        target_intervention_key: module.interventionKey,
        target_title: module.sessionTitle,
        target_context_contract_version: module.contextContract,
      },
    );
    if (sessionError || !resolvedSessionId) {
      return {
        ok: false,
        reason: mapCoachRpcError(sessionError?.message ?? ""),
        message: "LeanAI could not start setup.",
        conversation: null,
      };
    }
    sessionId = String(resolvedSessionId);
    const conversation = await readConversation(
      supabase,
      module,
      sessionId,
      organisationId,
    );
    if (!conversation) {
      return {
        ok: false,
        reason: "permission_denied",
        message: "The setup conversation could not be verified.",
        conversation: null,
      };
    }
    if (conversation.userTurnCount >= MODULE_SETUP_BUILDER_MAX_TURNS) {
      return {
        ok: false,
        reason: "usage_limit",
        message:
          "This setup conversation has reached its turn limit. Create the draft and continue in the editor, or start over.",
        conversation,
      };
    }

    const planned = planTurn(
      input.intent,
      message,
      input.focus,
      conversation,
      module,
    );
    if ("error" in planned) {
      return {
        ok: false,
        reason: "invalid_request",
        message: planned.error,
        conversation,
      };
    }

    const facts = await loadFacts(supabase, module, identity.organisationName);
    const context = buildModuleSetupBuilderContext({
      contract: module.contextContract,
      facts,
      understanding: conversation.understanding,
      currentProposal: conversation.currentProposal
        ? module.toContextProposal(conversation.currentProposal.proposal)
        : null,
      intent: planned.intent,
      focusLabel: planned.focusLabel,
      retry: planned.retry,
      limits: module.limits,
    });

    await runModuleSetupBuilderTurn({
      supabase,
      adapter: module.adapter,
      sessionId,
      userRequest: planned.userRequest,
      intent: planned.intent,
      focus: planned.focus,
      idempotencyKey,
      conversationHistory: moduleSetupBuilderHistory(
        conversation,
        MODULE_SETUP_BUILDER_HISTORY_WINDOW,
      ),
      context,
    });

    const updated = await readConversation(
      supabase,
      module,
      sessionId,
      organisationId,
    );
    if (!updated) {
      return {
        ok: false,
        reason: "provider_error",
        message: "LeanAI replied, but the conversation could not be reloaded.",
        conversation: null,
      };
    }
    const last = [...updated.turns]
      .reverse()
      .find((turn) => turn.role === "assistant");
    return {
      ok: true,
      outcome:
        last?.role === "assistant" && last.responseStatus === "invalid_response"
          ? "invalid_response"
          : last?.role === "assistant" && last.proposalStatus === "invalid"
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
        ? await readConversation(
            supabase,
            module,
            sessionId,
            organisationId,
          ).catch(() => null)
        : null;
    return {
      ok: false,
      reason,
      message: failureMessage(reason),
      conversation,
    };
  }
}

function planTurn<TProposal>(
  requested: ModuleSetupBuilderRequestIntent,
  message: string,
  focusInput: unknown,
  conversation: ModuleSetupBuilderConversationState<TProposal>,
  module: ModuleSetupBuilderModule<TProposal>,
):
  | {
      intent: "answer" | "propose" | "refine";
      focus:
        { kind: "whole" } | { kind: "section"; sectionIndex: number } | null;
      focusLabel: string | null;
      userRequest: string;
      retry: boolean;
    }
  | { error: string } {
  if (requested === "retry") {
    let lastUserIndex = -1;
    conversation.turns.forEach((turn, index) => {
      if (turn.role === "user") lastUserIndex = index;
    });
    const lastUser = conversation.turns[lastUserIndex];
    if (!lastUser || lastUser.role !== "user") {
      return { error: "There is no earlier request to try again." };
    }
    const previous = conversation.turns
      .slice(lastUserIndex + 1)
      .find(
        (turn): turn is ModuleSetupBuilderAssistantTurn =>
          turn.role === "assistant",
      );
    return {
      intent: previous?.intent ?? "answer",
      focus: previous?.focus ?? null,
      focusLabel:
        previous?.focus?.kind === "section"
          ? `section ${previous.focus.sectionIndex + 1}`
          : null,
      userRequest: lastUser.text,
      retry: true,
    };
  }
  if (requested === "propose") {
    return {
      intent: "propose",
      focus: null,
      focusLabel: null,
      userRequest:
        message || "Please draft the proposal now from what you know so far.",
      retry: false,
    };
  }
  if (!message) {
    return { error: "Tell LeanAI a little more first." };
  }
  if (requested === "refine") {
    const resolved = resolveModuleSetupBuilderFocus(
      focusInput,
      conversation.currentProposal
        ? module.sectionCount(conversation.currentProposal.proposal)
        : 0,
    );
    if (!resolved || !conversation.currentProposal) {
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

function failureMessage(reason: CoachAiDenialReason): string {
  switch (reason) {
    case "usage_limit":
      return "LeanAI usage limits have been reached for now. Manual setup and LEH Quick Start are still available.";
    case "organisation_ai_disabled":
      return "LeanAI is turned off for this organisation. Manual setup and LEH Quick Start are still available.";
    case "permission_denied":
      return "You do not have access to LeanAI for this action. Manual setup and LEH Quick Start are still available.";
    case "timeout":
      return "LeanAI took too long to reply. Nothing changed. Try again.";
    default:
      return "LeanAI could not reply just now. Nothing was saved. Try again.";
  }
}

export async function createModuleSetupDraftFromProposal<TProposal>(
  module: ModuleSetupBuilderModule<TProposal>,
  formData: FormData,
): Promise<
  | { ok: true; redirectTo: string }
  | { ok: false; reason: ModuleSetupBuilderFailureReason; message: string }
> {
  const proposalMessageId = String(
    formData.get("proposalMessageId") ?? "",
  ).trim();
  if (!UUID_PATTERN.test(proposalMessageId)) {
    return {
      ok: false,
      reason: "invalid_request",
      message: "Choose a proposal to create.",
    };
  }
  const [identity, access] = await Promise.all([
    loadCurrentOrganisationIdentity(),
    loadModuleSetupBuilderAccess({
      managePermission: module.managePermission,
      moduleLabel: module.moduleLabel,
    }),
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
  const { data: sessionRow } = await supabase
    .from("ai_sessions")
    .select("id")
    .eq("organisation_id", identity.organisationId)
    .eq("context_type", "coach")
    .eq("module_key", module.moduleKey)
    .eq("intervention_key", module.interventionKey)
    .eq("status", "active")
    .is("site_unit_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const conversation = sessionRow
    ? await readConversation(
        supabase,
        module,
        sessionRow.id,
        identity.organisationId,
      )
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

  const defined = module.definitionFromAcceptance(current.proposal, formData);
  if ("error" in defined) {
    return { ok: false, reason: "invalid_request", message: defined.error };
  }
  const unitIds = formData
    .getAll("applicableUnitIds")
    .map((value) => String(value))
    .filter((value) => UUID_PATTERN.test(value));
  if (unitIds.length === 0) {
    return {
      ok: false,
      reason: "invalid_request",
      message:
        "Select at least one applicable area. LeanAI does not choose applicability.",
    };
  }

  const { data, error } = await supabase.rpc(module.rpc, {
    target_declared_template_key: module.declaredKey,
    target_definition: defined.definition,
    target_unit_ids: unitIds,
  });
  if (error || !data) {
    return {
      ok: false,
      reason: error?.message.includes("not authorised")
        ? "permission_denied"
        : "provider_error",
      message:
        "The draft could not be created. Nothing was saved or published. You can try again from this proposal.",
    };
  }

  const boundary = nextModuleSetupBuilderBoundary(conversation.latestMessageAt);
  if (boundary) {
    await writeModuleSetupBuilderBoundary({
      moduleKey: module.moduleKey,
      organisationId: identity.organisationId,
      cookiePath: module.cookiePath,
      startedAt: boundary,
    });
  }
  revalidatePath(module.overviewPath);
  revalidatePath(module.route);
  return { ok: true, redirectTo: module.draftPath(String(data)) };
}

export async function discardModuleSetupBuilderConversation<TProposal>(
  module: ModuleSetupBuilderModule<TProposal>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [identity, access] = await Promise.all([
    loadCurrentOrganisationIdentity(),
    loadModuleSetupBuilderAccess({
      managePermission: module.managePermission,
      moduleLabel: module.moduleLabel,
    }),
  ]);
  if (!identity || !access.canManage) {
    return {
      ok: false,
      message: "You do not have access to this setup builder.",
    };
  }
  const supabase = await createServerSupabaseClient();
  const { data: sessionRow } = await supabase
    .from("ai_sessions")
    .select("id")
    .eq("organisation_id", identity.organisationId)
    .eq("context_type", "coach")
    .eq("module_key", module.moduleKey)
    .eq("intervention_key", module.interventionKey)
    .eq("status", "active")
    .is("site_unit_id", null)
    .limit(1)
    .maybeSingle();
  if (sessionRow) {
    const conversation = await readConversation(
      supabase,
      module,
      sessionRow.id,
      identity.organisationId,
    );
    const boundary = nextModuleSetupBuilderBoundary(
      conversation?.latestMessageAt ?? null,
    );
    if (boundary) {
      await writeModuleSetupBuilderBoundary({
        moduleKey: module.moduleKey,
        organisationId: identity.organisationId,
        cookiePath: module.cookiePath,
        startedAt: boundary,
      });
    }
  }
  revalidatePath(module.route);
  return { ok: true };
}

export async function loadModuleSetupBuilderConversation<TProposal>(
  module: ModuleSetupBuilderModule<TProposal>,
  organisationId: string,
): Promise<ModuleSetupBuilderConversationState<TProposal> | null> {
  const supabase = await createServerSupabaseClient();
  const { data: sessionRow } = await supabase
    .from("ai_sessions")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("context_type", "coach")
    .eq("module_key", module.moduleKey)
    .eq("intervention_key", module.interventionKey)
    .eq("status", "active")
    .is("site_unit_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sessionRow) {
    return null;
  }
  return readConversation(supabase, module, sessionRow.id, organisationId);
}
