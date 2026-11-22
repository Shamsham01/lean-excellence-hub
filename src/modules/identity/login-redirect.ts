import { safeInvitationContinuation } from "@/modules/identity/invitation-constants";
import { safeRelativeRedirect } from "@/modules/identity/redirects";

export function loginFailureRedirectPath(next: string | null): string {
  const continuation = safeInvitationContinuation(
    safeRelativeRedirect(next, ""),
  );
  if (!continuation) {
    return "/login?error=invalid";
  }

  return `/login?error=invalid&next=${encodeURIComponent(continuation)}`;
}
