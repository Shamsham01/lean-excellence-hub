import type { SupabaseClient } from "@supabase/supabase-js";

import {
  invitationContinuePath,
  isInvitationSignupBindingId,
} from "@/modules/identity/invitation-constants";
import type { Database } from "@/platform/supabase/database.types";

type SessionSupabaseClient = SupabaseClient<Database>;

export type InvitationContinuation =
  | { kind: "redirect"; path: string }
  | {
      kind: "unavailable";
      detail: "invitation_expired" | "invitation_revoked";
    }
  | { kind: "none" };

export function parseInvitationContinuation(
  payload: unknown,
): InvitationContinuation {
  if (!payload || typeof payload !== "object") {
    return { kind: "none" };
  }

  const record = payload as Record<string, unknown>;
  const bindingId =
    typeof record.binding_id === "string" ? record.binding_id : "";

  if (
    (record.outcome === "continue" || record.outcome === "rebind") &&
    isInvitationSignupBindingId(bindingId)
  ) {
    return {
      kind: "redirect",
      path: invitationContinuePath(bindingId),
    };
  }

  if (
    record.outcome === "unavailable" &&
    record.detail === "invitation_expired"
  ) {
    return { kind: "unavailable", detail: "invitation_expired" };
  }

  if (
    record.outcome === "unavailable" &&
    record.detail === "invitation_revoked"
  ) {
    return { kind: "unavailable", detail: "invitation_revoked" };
  }

  return { kind: "none" };
}

export async function resolveAuthenticatedInvitationContinuation(
  supabase: SessionSupabaseClient,
): Promise<InvitationContinuation> {
  const { data, error } = await supabase.rpc(
    "resolve_my_invitation_continuation",
  );

  if (error) {
    return { kind: "none" };
  }

  return parseInvitationContinuation(data);
}
