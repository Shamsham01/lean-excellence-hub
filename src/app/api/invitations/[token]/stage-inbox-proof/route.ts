import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  INVITATION_INBOX_PROOF_COOKIE,
  invitationInboxProofCookieOptions,
  isInvitationInboxProofValue,
} from "@/modules/identity/invitation-inbox-cookie";
import { invitationInboxProofDigest } from "@/modules/identity/invitation-inbox-proof";
import { INVITATION_TOKEN_PATTERN } from "@/modules/identity/invitation-constants";
import { invitationTokenDigest } from "@/modules/identity/invitations";
import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import type { Database } from "@/platform/supabase/database.types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const rawInboxProof = request.nextUrl.searchParams.get("inbox_proof")?.trim();
  const appOrigin = getServerEnvironment().APP_ORIGIN;

  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    return NextResponse.redirect(new URL("/login", appOrigin));
  }

  const activatePath = `/invitations/${token}/activate`;

  if (!isInvitationInboxProofValue(rawInboxProof)) {
    return NextResponse.redirect(new URL(activatePath, appOrigin));
  }

  const inboxProof: string = rawInboxProof;

  const publicEnvironment = getPublicEnvironment();
  const supabase = createClient<Database>(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const { data: valid, error } = await supabase.rpc(
    "validate_organisation_invitation_inbox_proof_staging",
    {
      invitation_token_digest: invitationTokenDigest(token),
      target_inbox_proof_digest: invitationInboxProofDigest(inboxProof),
    },
  );

  if (error || valid !== true) {
    return NextResponse.redirect(new URL(activatePath, appOrigin));
  }

  const secure = getServerEnvironment().NODE_ENV === "production";
  const response = NextResponse.redirect(new URL(activatePath, appOrigin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(
    INVITATION_INBOX_PROOF_COOKIE,
    inboxProof,
    invitationInboxProofCookieOptions(token, secure),
  );

  return response;
}
