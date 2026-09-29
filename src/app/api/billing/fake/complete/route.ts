import { NextRequest, NextResponse } from "next/server";

import { completeFakeCheckoutSession } from "@/modules/billing/complete-fake-checkout";
import { isFakeBillingEnabled } from "@/modules/billing/env";
import { BillingProviderError } from "@/modules/billing/provider";
import { getServerEnvironment } from "@/platform/env";
import { createRouteHandlerSupabaseClient } from "@/platform/supabase/route-handler";

export const runtime = "nodejs";

async function sessionIdFrom(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { session_id?: string };
    return body.session_id ?? null;
  }
  const form = await request.formData();
  const value = form.get("session_id");
  return typeof value === "string" ? value : null;
}

function statusFor(cause: BillingProviderError) {
  if (cause.code === "unauthorized") {
    return 401;
  }
  if (cause.code === "forbidden") {
    return 403;
  }
  if (cause.code === "not_found") {
    return 404;
  }
  return 400;
}

export async function POST(request: NextRequest) {
  if (!isFakeBillingEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sessionId = await sessionIdFrom(request);
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session" }, { status: 400 });
  }

  try {
    await completeFakeCheckoutSession(sessionId);
  } catch (cause) {
    if (cause instanceof BillingProviderError) {
      return NextResponse.json(
        { error: cause.code },
        { status: statusFor(cause) },
      );
    }
    throw cause;
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json") && !accept.includes("text/html")) {
    return NextResponse.json({ received: true });
  }

  const origin = getServerEnvironment().APP_ORIGIN;
  const response = NextResponse.redirect(
    new URL("/onboarding/confirm", origin),
    { status: 303 },
  );
  const supabase = createRouteHandlerSupabaseClient(request, response);
  await supabase.auth.getClaims();
  return response;
}
