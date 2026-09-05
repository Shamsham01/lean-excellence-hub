import "server-only";

import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";
import { resolvePostAuthenticationRedirectPath } from "@/modules/identity/session";
import type { Database } from "@/platform/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionSupabaseClient = SupabaseClient<Database>;

export async function resolveEmailPasswordLoginRedirectPath(
  supabase: SessionSupabaseClient,
  next: string | null,
): Promise<string> {
  const identity = await supabase.rpc("current_identity_state");
  if (identity.data?.[0]?.password_change_required) {
    return "/update-password";
  }

  const invitationContinuation = safeInvitationContinuation(
    safeRelativeRedirect(next),
  );
  if (invitationContinuation) {
    return invitationContinuation;
  }

  return resolvePostAuthenticationRedirectPath(supabase);
}
