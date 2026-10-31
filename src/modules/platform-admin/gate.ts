import "server-only";

import { createHmac } from "node:crypto";
import { cache } from "react";
import { headers } from "next/headers";

import { readRequestPathname } from "@/platform/http/request-path";
import { getServerEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { decidePlatformAdminAccess } from "./access-decision";
import {
  consumePlatformAdminRateLimit,
  platformAdminIdentityActive,
  recordPlatformAdminAccess,
} from "./data";

export type PlatformConsoleAccess =
  | { kind: "allowed"; userId: string }
  | { kind: "anonymous" }
  | { kind: "denied" }
  | { kind: "mfa"; userId: string }
  | { kind: "rate_limited" };

function limiterKey(value: string) {
  const { AUTH_RATE_LIMIT_PEPPER } = getServerEnvironment();
  return createHmac("sha256", AUTH_RATE_LIMIT_PEPPER)
    .update(value)
    .digest("hex");
}

async function sourceAddress() {
  const environment = getServerEnvironment();
  if (!environment.TRUSTED_PROXY_IP_HEADER) {
    return "untrusted";
  }
  const headerStore = await headers();
  return headerStore.get(environment.TRUSTED_PROXY_IP_HEADER) || "missing";
}

async function readAssuranceLevel() {
  const supabase = await createServerSupabaseClient();
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data.currentLevel !== "aal2") {
    return "aal1" as const;
  }
  return "aal2" as const;
}

export const resolvePlatformOperator = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  const userId = error ? null : (data.user?.id ?? null);
  const allowlisted = userId
    ? await platformAdminIdentityActive(userId)
    : false;
  const assuranceLevel = userId ? await readAssuranceLevel() : null;
  return {
    assuranceLevel,
    decision: decidePlatformAdminAccess({
      allowlisted,
      assuranceLevel,
      rateLimited: false,
      userId,
    }),
    userId,
  };
});

export const resolvePlatformConsoleAccess = cache(
  async (): Promise<PlatformConsoleAccess> => {
    const requestPath = await readRequestPathname();
    const operator = await resolvePlatformOperator();
    const address = await sourceAddress();
    const limitKey = limiterKey(
      operator.userId
        ? `platform-admin:user:${operator.userId}`
        : `platform-admin:address:${address}`,
    );
    const allowed = await consumePlatformAdminRateLimit({
      blockSeconds: 900,
      key: limitKey,
      maximumAttempts: operator.userId ? 120 : 30,
      windowSeconds: 300,
    });
    if (!allowed) {
      await recordPlatformAdminAccess({
        action: "console.read",
        actorUserId: operator.userId,
        outcome: "rate_limited",
        requestPath,
      });
      return { kind: "rate_limited" };
    }

    if (operator.decision === "denied") {
      await recordPlatformAdminAccess({
        action: "console.read",
        actorUserId: operator.userId,
        outcome: "denied",
        requestPath,
      });
      return { kind: "denied" };
    }

    if (operator.decision === "mfa" && operator.userId) {
      await recordPlatformAdminAccess({
        action: "console.read",
        actorUserId: operator.userId,
        outcome: "mfa_required",
        requestPath,
      });
      return { kind: "mfa", userId: operator.userId };
    }

    if (operator.decision === "allowed" && operator.userId) {
      return { kind: "allowed", userId: operator.userId };
    }

    return { kind: "anonymous" };
  },
);

export async function consumePlatformLoginRateLimit(email: string) {
  const address = await sourceAddress();
  const emailAllowed = await consumePlatformAdminRateLimit({
    blockSeconds: 900,
    key: limiterKey(`platform-admin:login-email:${email}`),
    maximumAttempts: 10,
    windowSeconds: 300,
  });
  const addressAllowed = await consumePlatformAdminRateLimit({
    blockSeconds: 900,
    key: limiterKey(`platform-admin:login-address:${address}`),
    maximumAttempts: 10,
    windowSeconds: 300,
  });
  return emailAllowed && addressAllowed;
}
