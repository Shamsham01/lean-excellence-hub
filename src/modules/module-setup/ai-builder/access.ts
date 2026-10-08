import "server-only";

import { cookies } from "next/headers";

import { parseConversationBoundary } from "@/modules/leanai-context/assistant/conversation-boundary";
import { assessCoachAiEligibility } from "@/modules/leanai-context/coach/eligibility";
import { AI_PERMISSIONS } from "@/modules/operational/permissions";
import {
  currentMemberHasOrganisationScopedPermission,
  currentMemberHasPermission,
} from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type ModuleSetupBuilderUnavailableReason =
  | "manage_permission_required"
  | "application_unavailable"
  | "organisation_ai_disabled"
  | "ai_permission_required"
  | "subscription_inactive"
  | "entitlement_denied";

export type ModuleSetupBuilderAccess =
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
        ModuleSetupBuilderUnavailableReason,
        "manage_permission_required"
      >;
      message: string;
    }
  | { canManage: true; available: true; reason: null; message: null };

export async function loadModuleSetupBuilderAccess(input: {
  managePermission: string;
  moduleLabel: string;
}): Promise<ModuleSetupBuilderAccess> {
  const canManage = await currentMemberHasOrganisationScopedPermission(
    input.managePermission,
  );
  if (!canManage) {
    return {
      canManage: false,
      available: false,
      reason: "manage_permission_required",
      message: `You need permission to manage ${input.moduleLabel} before using guided setup.`,
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
    ModuleSetupBuilderUnavailableReason,
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

  if (!reason) {
    return { canManage: true, available: true, reason: null, message: null };
  }

  return {
    canManage: true,
    available: false,
    reason,
    message: unavailableMessage(reason, input.moduleLabel),
  };
}

function unavailableMessage(
  reason: Exclude<
    ModuleSetupBuilderUnavailableReason,
    "manage_permission_required"
  >,
  moduleLabel: string,
): string {
  switch (reason) {
    case "application_unavailable":
      return "LeanAI is not available in this environment. Manual setup and LEH Quick Start remain available.";
    case "organisation_ai_disabled":
      return "LeanAI is turned off for this organisation. An administrator can enable it in LeanAI settings. Manual setup and LEH Quick Start remain available.";
    case "ai_permission_required":
      return `Your role does not include LeanAI. Ask an administrator for access, or use Manual setup or LEH Quick Start for ${moduleLabel}.`;
    case "subscription_inactive":
      return "LeanAI is unavailable while organisation access cannot be verified. Manual setup and LEH Quick Start remain available.";
    case "entitlement_denied":
      return "This organisation's plan does not currently include LeanAI usage. Manual setup and LEH Quick Start remain available.";
  }
}

export function moduleSetupBuilderBoundaryCookieName(
  moduleKey: string,
  organisationId: string,
) {
  const safeModule = moduleKey.replace(/[^a-z0-9_]/gi, "");
  const safeOrg = organisationId.replace(/[^a-f0-9-]/gi, "");
  return `leh_${safeModule}_setup_builder_start_${safeOrg}`;
}

export async function readModuleSetupBuilderBoundary(
  moduleKey: string,
  organisationId: string,
): Promise<string | null> {
  const store = await cookies();
  const parsed = parseConversationBoundary(
    store.get(moduleSetupBuilderBoundaryCookieName(moduleKey, organisationId))
      ?.value,
  );
  return parsed.kind === "valid" ? parsed.startedAt : null;
}

export async function writeModuleSetupBuilderBoundary(input: {
  moduleKey: string;
  organisationId: string;
  cookiePath: string;
  startedAt: string;
}): Promise<void> {
  const store = await cookies();
  store.set(
    moduleSetupBuilderBoundaryCookieName(input.moduleKey, input.organisationId),
    input.startedAt,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: input.cookiePath,
      maxAge: 60 * 60 * 24 * 30,
    },
  );
}
