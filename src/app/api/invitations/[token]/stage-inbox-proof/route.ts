import { createHmac } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
import {
  authenticationRateLimitAllows,
  consumeAuthenticationRateLimit,
  recordAuthenticationRateLimitFailure,
} from "@/platform/supabase/secret";

const stageBodySchema = z.object({
  inbox_proof: z.string().refine(isInvitationInboxProofValue, {
    message: "Invalid inbox proof.",
  }),
});

function hashStagingRateLimitKey(
  token: string,
  dimension: string,
  value: string,
) {
  const pepper = getServerEnvironment().AUTH_RATE_LIMIT_PEPPER;
  return `\\x${createHmac("sha256", pepper)
    .update(`invitation-stage:${dimension}:${token}:${value}`)
    .digest("hex")}`;
}

async function stagingRateLimitAllows(token: string) {
  const environment = getServerEnvironment();
  const requestHeaders = await headers();
  const signals: Array<{
    dimension: "ip" | "recipient";
    keyHash: string;
    maximumAttempts: number;
  }> = [
    {
      dimension: "recipient",
      keyHash: hashStagingRateLimitKey(token, "recipient", token),
      maximumAttempts: 40,
    },
  ];

  if (environment.TRUSTED_PROXY_IP_HEADER) {
    const sourceIp = requestHeaders.get(environment.TRUSTED_PROXY_IP_HEADER);
    if (sourceIp) {
      signals.push({
        dimension: "ip",
        keyHash: hashStagingRateLimitKey(token, "ip", sourceIp.trim()),
        maximumAttempts: 80,
      });
    }
  }

  for (const signal of signals) {
    const allowed = await authenticationRateLimitAllows(
      "invitation",
      signal.dimension,
      signal.keyHash,
      signal.maximumAttempts,
    );
    if (allowed.error || allowed.data !== true) {
      return false;
    }
  }

  return true;
}

async function consumeStagingRateLimit(token: string) {
  const environment = getServerEnvironment();
  const requestHeaders = await headers();
  const signals: Array<{
    dimension: "ip" | "recipient";
    keyHash: string;
    maximumAttempts: number;
  }> = [
    {
      dimension: "recipient",
      keyHash: hashStagingRateLimitKey(token, "recipient", token),
      maximumAttempts: 40,
    },
  ];

  if (environment.TRUSTED_PROXY_IP_HEADER) {
    const sourceIp = requestHeaders.get(environment.TRUSTED_PROXY_IP_HEADER);
    if (sourceIp) {
      signals.push({
        dimension: "ip",
        keyHash: hashStagingRateLimitKey(token, "ip", sourceIp.trim()),
        maximumAttempts: 80,
      });
    }
  }

  for (const signal of signals) {
    const consumed = await consumeAuthenticationRateLimit(
      "invitation",
      signal.dimension,
      signal.keyHash,
      signal.maximumAttempts,
    );
    if (consumed.error || consumed.data !== true) {
      return false;
    }
  }

  return true;
}

async function stageInboxProof(
  token: string,
  inboxProof: string,
): Promise<NextResponse> {
  const appOrigin = getServerEnvironment().APP_ORIGIN;
  const activatePath = `/invitations/${token}/activate`;

  if (!(await stagingRateLimitAllows(token))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!(await consumeStagingRateLimit(token))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

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
    await Promise.all([
      recordAuthenticationRateLimitFailure(
        "invitation",
        "recipient",
        hashStagingRateLimitKey(token, "recipient", token),
        40,
      ),
    ]);
    return NextResponse.json(
      { error: "Invalid inbox proof." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const secure = getServerEnvironment().NODE_ENV === "production";
  const response = NextResponse.json(
    { ok: true as const },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
  response.cookies.set(
    INVITATION_INBOX_PROOF_COOKIE,
    inboxProof,
    invitationInboxProofCookieOptions(token, secure),
  );

  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const appOrigin = getServerEnvironment().APP_ORIGIN;

  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    return NextResponse.redirect(new URL("/login", appOrigin));
  }

  const activatePath = `/invitations/${token}/activate`;
  const rawInboxProof = request.nextUrl.searchParams.get("inbox_proof")?.trim();

  if (rawInboxProof && isInvitationInboxProofValue(rawInboxProof)) {
    const redirectUrl = new URL(activatePath, appOrigin);
    redirectUrl.hash = `inbox_proof=${encodeURIComponent(rawInboxProof)}`;
    const response = NextResponse.redirect(redirectUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  return NextResponse.redirect(new URL(activatePath, appOrigin), {
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const appOrigin = getServerEnvironment().APP_ORIGIN;

  if (!INVITATION_TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = stageBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/invitations/${token}/activate`, appOrigin),
      303,
    );
  }

  return stageInboxProof(token, parsed.data.inbox_proof);
}
