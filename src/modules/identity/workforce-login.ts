import "server-only";

import { createHmac } from "node:crypto";

import { workforceLoginSchema } from "@/modules/identity/auth-input";
import { getServerEnvironment } from "@/platform/env";
import {
  consumeAuthenticationRateLimit,
  recordAuthenticationRateLimitFailure,
  recordAuthenticationSecurityEvent,
  releaseAuthenticationRateLimit,
  resolveWorkforceLogin,
} from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const GENERIC_FAILURE = "Unable to sign in with those credentials.";

function limiterHash(value: string) {
  const { AUTH_RATE_LIMIT_PEPPER } = getServerEnvironment();
  return `\\x${createHmac("sha256", AUTH_RATE_LIMIT_PEPPER).update(value).digest("hex")}`;
}

type LimitSignal = {
  dimension: "ip" | "organisation_code" | "alias" | "account";
  maximumAttempts: number;
  value: string;
};

async function reserve(signal: LimitSignal) {
  const { data, error } = await consumeAuthenticationRateLimit(
    "workforce_login",
    signal.dimension,
    limiterHash(`${signal.dimension}:${signal.value}`),
    signal.maximumAttempts,
  );
  return !error && data === true;
}

async function releaseReservations(signals: LimitSignal[]) {
  await Promise.all(
    signals.map((signal) =>
      releaseAuthenticationRateLimit(
        "workforce_login",
        signal.dimension,
        limiterHash(`${signal.dimension}:${signal.value}`),
        signal.maximumAttempts,
      ),
    ),
  );
}

async function recordFailures(signals: LimitSignal[]) {
  await Promise.all(
    signals.map((signal) =>
      recordAuthenticationRateLimitFailure(
        "workforce_login",
        signal.dimension,
        limiterHash(`${signal.dimension}:${signal.value}`),
        signal.maximumAttempts,
      ),
    ),
  );
}

async function reserveSignals(signals: LimitSignal[]) {
  const reserved: LimitSignal[] = [];
  for (const signal of signals) {
    if (!(await reserve(signal))) {
      await releaseReservations(reserved);
      return null;
    }
    reserved.push(signal);
  }
  return reserved;
}

export async function authenticateWorkforce(
  input: unknown,
  sourceIp: string | null,
) {
  const parsed = workforceLoginSchema.safeParse(input);
  if (!parsed.success) {
    await recordAuthenticationSecurityEvent(
      "authentication.workforce",
      "denied",
    );
    return { ok: false as const, message: GENERIC_FAILURE };
  }

  const { organisationCode, workforceAlias, password } = parsed.data;
  const preliminarySignals: LimitSignal[] = [
    {
      dimension: "alias",
      maximumAttempts: 10,
      value: `${organisationCode}:${workforceAlias}`,
    },
  ];
  if (sourceIp) {
    preliminarySignals.push({
      dimension: "ip",
      maximumAttempts: 30,
      value: sourceIp,
    });
  }

  const preliminaryReservations = await reserveSignals(preliminarySignals);
  if (!preliminaryReservations) {
    await recordAuthenticationSecurityEvent(
      "authentication.workforce",
      "denied",
    );
    return { ok: false as const, message: GENERIC_FAILURE };
  }

  const resolution = await resolveWorkforceLogin(
    organisationCode,
    workforceAlias,
  );
  const account = resolution.data?.[0];
  if (resolution.error || !account) {
    await recordFailures(preliminaryReservations);
    await recordAuthenticationSecurityEvent(
      "authentication.workforce",
      "denied",
    );
    return { ok: false as const, message: GENERIC_FAILURE };
  }

  const accountSignal: LimitSignal = {
    dimension: "account",
    maximumAttempts: 50,
    value: account.workforce_account_id,
  };
  if (!(await reserve(accountSignal))) {
    await releaseReservations(preliminaryReservations);
    await recordAuthenticationSecurityEvent(
      "authentication.workforce",
      "denied",
      account.organisation_id,
    );
    return { ok: false as const, message: GENERIC_FAILURE };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.internal_login_identifier,
    password,
  });
  if (error) {
    await recordFailures([...preliminaryReservations, accountSignal]);
    await recordAuthenticationSecurityEvent(
      "authentication.workforce",
      "denied",
      account.organisation_id,
    );
    return { ok: false as const, message: GENERIC_FAILURE };
  }

  await releaseReservations([...preliminaryReservations, accountSignal]);
  if (!account.password_change_required) {
    const switched = await supabase.rpc("switch_organisation", {
      target_organisation_id: account.organisation_id,
    });
    if (switched.error || switched.data !== true) {
      await supabase.auth.signOut({ scope: "local" });
      await recordAuthenticationSecurityEvent(
        "authentication.workforce",
        "failed",
        account.organisation_id,
      );
      return { ok: false as const, message: GENERIC_FAILURE };
    }
  }

  await recordAuthenticationSecurityEvent(
    "authentication.workforce",
    "succeeded",
    account.organisation_id,
  );
  return {
    ok: true as const,
    next: account.password_change_required ? "/update-password" : "/",
  };
}
