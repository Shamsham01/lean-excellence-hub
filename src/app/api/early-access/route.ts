import { type NextRequest, NextResponse } from "next/server";

import {
  buildWebhookPayload,
  earlyAccessMessages,
  HONEYPOT_FIELD,
  validateEarlyAccess,
} from "@/lib/marketing/early-access";
import { earlyAccessRateLimiter } from "@/lib/marketing/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;
const WEBHOOK_TIMEOUT_MS = 8_000;

function clientKey(request: NextRequest) {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Browsers send Origin on cross-site POSTs; it must match this host. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function sourcePage(request: NextRequest, claimed: unknown) {
  const fallback = "/";
  const value =
    typeof claimed === "string" && claimed.startsWith("/")
      ? claimed
      : (() => {
          try {
            return new URL(request.headers.get("referer") ?? "").pathname;
          } catch {
            return fallback;
          }
        })();
  return value.slice(0, 200) || fallback;
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return json({ error: earlyAccessMessages.failed }, 403);
  }

  if (
    !(request.headers.get("content-type") ?? "").includes("application/json")
  ) {
    return json({ error: earlyAccessMessages.failed }, 415);
  }

  if (!earlyAccessRateLimiter.hit(clientKey(request))) {
    return json({ error: earlyAccessMessages.rateLimited }, 429);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json({ error: earlyAccessMessages.failed }, 413);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: earlyAccessMessages.failed }, 400);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return json({ error: earlyAccessMessages.failed }, 400);
  }
  const body = raw as Record<string, unknown>;

  // Honeypot: pretend success so bots learn nothing, and forward nothing.
  const trap = body[HONEYPOT_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") {
    return json({ ok: true }, 200);
  }

  const result = validateEarlyAccess(body);
  if (!result.ok) {
    return json({ error: "invalid", fields: result.errors }, 422);
  }

  const webhook = process.env.MAKE_EARLY_ACCESS_WEBHOOK_URL?.trim();
  if (!webhook) {
    return json(
      { error: "not_configured", message: earlyAccessMessages.notConfigured },
      503,
    );
  }

  let url: URL;
  try {
    url = new URL(webhook);
    if (url.protocol !== "https:") throw new Error("insecure");
  } catch {
    console.error("[early-access] MAKE_EARLY_ACCESS_WEBHOOK_URL is invalid");
    return json(
      { error: "not_configured", message: earlyAccessMessages.notConfigured },
      503,
    );
  }

  const payload = buildWebhookPayload(result.value, {
    now: new Date(),
    sourcePage: sourcePage(request, body.sourcePage),
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `[early-access] webhook responded with status ${response.status}`,
      );
      return json({ error: earlyAccessMessages.failed }, 502);
    }
  } catch {
    console.error("[early-access] webhook request failed");
    return json({ error: earlyAccessMessages.failed }, 502);
  }

  return json({ ok: true }, 200);
}
