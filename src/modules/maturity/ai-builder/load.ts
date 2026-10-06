import "server-only";

import { cookies } from "next/headers";

import { parseConversationBoundary } from "@/modules/leanai-context/assistant/conversation-boundary";
import { assessCoachAiEligibility } from "@/modules/leanai-context/coach/eligibility";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { AI_PERMISSIONS } from "@/modules/operational/permissions";
import { loadAccessibleOrganisationUnits } from "@/modules/organisation/site-context-server";
import { loadCurrentOrganisationIdentity } from "@/modules/organisations/context";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import type { MaturityBuilderOrganisationFacts } from "./context";
import { deriveMaturityBuilderConversation } from "./conversation";
import {
  MATURITY_BUILDER_INTERVENTION_KEY,
  MATURITY_BUILDER_MODULE_KEY,
  type MaturityBuilderConversationState,
} from "./types";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type MaturityBuilderUnavailableReason =
  | "manage_permission_required"
  | "application_unavailable"
  | "organisation_ai_disabled"
  | "ai_permission_required"
  | "subscription_inactive"
  | "entitlement_denied";

export type MaturityBuilderAccess =
  | {
      canManage: false;
      available: false;
      reason: "manage_permission_required";
      message: string;
    }
  | {
      canManage: true;
      available: false;
      reason: Exclude<
        MaturityBuilderUnavailableReason,
        "manage_permission_required"
      >;
      message: string;
    }
  | { canManage: true; available: true; reason: null; message: null };

const UNAVAILABLE_MESSAGES: Record<MaturityBuilderUnavailableReason, string> = {
  manage_permission_required:
    "You need permission to manage Maturity Frameworks to build one with LeanAI.",
  application_unavailable: "LeanAI is not available in this environment.",
  organisation_ai_disabled:
    "LeanAI is turned off for this organisation. An administrator can enable it in LeanAI settings.",
  ai_permission_required:
    "Your role does not include LeanAI. Ask an administrator for access, or use Quick Start or manual setup.",
  subscription_inactive:
    "LeanAI is unavailable while organisation access cannot be verified.",
  entitlement_denied:
    "This organisation's plan does not currently include LeanAI usage.",
};

/**
 * Resolve builder availability without starting a session or calling a model.
 * The database repeats every check (`can_use_ai`, ceilings, RBAC) on use.
 */
export async function loadMaturityBuilderAccess(): Promise<MaturityBuilderAccess> {
  const canManage = await currentMemberHasOrganisationScopedPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );
  if (!canManage) {
    return {
      canManage: false,
      available: false,
      reason: "manage_permission_required",
      message: UNAVAILABLE_MESSAGES.manage_permission_required,
    };
  }

  const supabase = await createServerSupabaseClient();
  const [eligibility, canUseAi, settings] = await Promise.all([
    assessCoachAiEligibility(supabase),
    currentMemberHasPermission(AI_PERMISSIONS.use),
    supabase
      .from("organisation_ai_settings")
      .select("ai_enabled")
      .maybeSingle(),
  ]);

  let reason: Exclude<
    MaturityBuilderUnavailableReason,
    "manage_permission_required"
  > | null = null;
  if (!eligibility.ok) {
    reason =
      eligibility.reason === "application_unavailable" ||
      eligibility.reason === "entitlement_denied" ||
      eligibility.reason === "subscription_inactive"
        ? eligibility.reason
        : "application_unavailable";
  } else if (settings.data?.ai_enabled !== true) {
    reason = "organisation_ai_disabled";
  } else if (!canUseAi) {
    reason = "ai_permission_required";
  }

  if (reason) {
    return {
      canManage: true,
      available: false,
      reason,
      message: UNAVAILABLE_MESSAGES[reason],
    };
  }
  return { canManage: true, available: true, reason: null, message: null };
}

const BOUNDARY_COOKIE_PREFIX = "leh_maturity_builder_start_";
export const MATURITY_BUILDER_COOKIE_PATH = "/platform/maturity";

export function maturityBuilderBoundaryCookieName(organisationId: string) {
  return `${BOUNDARY_COOKIE_PREFIX}${organisationId.replace(/[^a-f0-9-]/gi, "")}`;
}

/** Logical restart point. Hides earlier turns only; never resets usage or limits. */
export async function readMaturityBuilderBoundary(
  organisationId: string,
): Promise<string | null> {
  const store = await cookies();
  const parsed = parseConversationBoundary(
    store.get(maturityBuilderBoundaryCookieName(organisationId))?.value,
  );
  return parsed.kind === "valid" ? parsed.startedAt : null;
}

export async function writeMaturityBuilderBoundary(
  organisationId: string,
  startedAt: string,
): Promise<void> {
  const store = await cookies();
  store.set(maturityBuilderBoundaryCookieName(organisationId), startedAt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: MATURITY_BUILDER_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** RLS limits Coach sessions to the creating membership in the current organisation. */
export async function findActiveMaturityBuilderSessionId(
  supabase: ServerSupabase,
  organisationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_sessions")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("context_type", "coach")
    .eq("module_key", MATURITY_BUILDER_MODULE_KEY)
    .eq("intervention_key", MATURITY_BUILDER_INTERVENTION_KEY)
    .eq("status", "active")
    .is("site_unit_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data.id;
}

export async function readMaturityBuilderSessionDetail(
  supabase: ServerSupabase,
  sessionId: string,
): Promise<unknown | null> {
  const { data, error } = await supabase.rpc("get_ai_session_detail", {
    target_ai_session_id: sessionId,
  });
  return error ? null : data;
}

export type MaturityBuilderPageData = {
  organisationId: string;
  organisationName: string;
  access: MaturityBuilderAccess;
  conversation: MaturityBuilderConversationState | null;
  conversationStartedAt: string | null;
};

/** Page load: reads existing state only. Never creates a session or calls a model. */
export async function loadMaturityBuilderPageData(): Promise<MaturityBuilderPageData | null> {
  const [identity, access] = await Promise.all([
    loadCurrentOrganisationIdentity(),
    loadMaturityBuilderAccess(),
  ]);
  if (!identity) {
    return null;
  }
  const conversationStartedAt = await readMaturityBuilderBoundary(
    identity.organisationId,
  );
  let conversation: MaturityBuilderConversationState | null = null;
  if (access.canManage) {
    const supabase = await createServerSupabaseClient();
    const sessionId = await findActiveMaturityBuilderSessionId(
      supabase,
      identity.organisationId,
    );
    if (sessionId) {
      const detail = await readMaturityBuilderSessionDetail(
        supabase,
        sessionId,
      );
      conversation = detail
        ? deriveMaturityBuilderConversation(detail, {
            sessionId,
            conversationStartedAt,
          })
        : null;
    }
  }
  return {
    organisationId: identity.organisationId,
    organisationName: identity.organisationName,
    access,
    conversation,
    conversationStartedAt,
  };
}

const MAX_JOB_FUNCTION_ROWS = 20;
const MAX_FRAMEWORK_ROWS = 10;

export async function loadMaturityBuilderOrganisationFacts(
  supabase: ServerSupabase,
  organisationName: string,
): Promise<MaturityBuilderOrganisationFacts> {
  const [units, jobFunctions, frameworks] = await Promise.all([
    loadAccessibleOrganisationUnits(),
    supabase
      .from("job_functions")
      .select("name")
      .eq("status", "active")
      .order("name")
      .limit(MAX_JOB_FUNCTION_ROWS),
    supabase
      .from("maturity_models")
      .select("display_name")
      .order("created_at", { ascending: false })
      .limit(MAX_FRAMEWORK_ROWS),
  ]);
  return {
    organisationName,
    units: units.map((unit) => ({
      name: unit.name,
      unit_type: unit.unit_type ?? null,
      parent_unit_id: unit.parent_unit_id ?? null,
    })),
    jobFunctionNames: (jobFunctions.data ?? []).map((row) => row.name),
    existingFrameworkNames: (frameworks.data ?? []).map(
      (row) => row.display_name,
    ),
  };
}
