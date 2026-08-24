"use server";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerEnvironment } from "@/platform/env";
import {
  consumeAuthenticationRateLimit,
  recordAuthenticationRateLimitFailure,
  recordAuthenticationSecurityEvent,
  releaseAuthenticationRateLimit,
} from "@/platform/supabase/secret";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function requestRecovery(formData: FormData) {
  const parsed = z.email().max(320).safeParse(formData.get("email"));
  if (parsed.success) {
    const environment = getServerEnvironment();
    const hash = (dimension: string, value: string) =>
      `\\x${createHmac("sha256", environment.AUTH_RATE_LIMIT_PEPPER)
        .update(`${dimension}:${value}`)
        .digest("hex")}`;
    const recipient = parsed.data.trim().toLowerCase();
    const signals: Array<{
      dimension: "ip" | "recipient";
      keyHash: string;
      maximumAttempts: number;
    }> = [
      {
        dimension: "recipient",
        keyHash: hash("recipient", recipient),
        maximumAttempts: 5,
      },
    ];
    if (environment.TRUSTED_PROXY_IP_HEADER) {
      const requestHeaders = await headers();
      const sourceIp = requestHeaders.get(environment.TRUSTED_PROXY_IP_HEADER);
      if (sourceIp) {
        signals.push({
          dimension: "ip",
          keyHash: hash("ip", sourceIp),
          maximumAttempts: 20,
        });
      }
    }

    const reservations: typeof signals = [];
    for (const signal of signals) {
      const limit = await consumeAuthenticationRateLimit(
        "password_recovery",
        signal.dimension,
        signal.keyHash,
        signal.maximumAttempts,
      );
      if (limit.error || limit.data !== true) {
        await Promise.all(
          reservations.map((reservation) =>
            releaseAuthenticationRateLimit(
              "password_recovery",
              reservation.dimension,
              reservation.keyHash,
              reservation.maximumAttempts,
            ),
          ),
        );
        await recordAuthenticationSecurityEvent(
          "authentication.password_recovery_requested",
          "denied",
        );
        redirect("/recover?sent=true");
      }
      reservations.push(signal);
    }

    const supabase = await createServerSupabaseClient();
    const recovery = await supabase.auth.resetPasswordForEmail(recipient, {
      redirectTo: `${environment.APP_ORIGIN}/update-password`,
    });
    await Promise.all(
      reservations.map((reservation) =>
        recordAuthenticationRateLimitFailure(
          "password_recovery",
          reservation.dimension,
          reservation.keyHash,
          reservation.maximumAttempts,
        ),
      ),
    );
    await recordAuthenticationSecurityEvent(
      "authentication.password_recovery_requested",
      recovery.error ? "failed" : "succeeded",
    );
  }

  redirect("/recover?sent=true");
}
