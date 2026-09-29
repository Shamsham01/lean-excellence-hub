import "server-only";

import { z } from "zod";

import { getServerEnvironment } from "@/platform/env";
import { STRIPE_PRICE_ENV_KEYS } from "./catalogue";
import type { BillingInterval, CheckoutPlanCode } from "./types";

const billingEnvironmentSchema = z
  .object({
    BILLING_PROVIDER: z.enum(["fake", "stripe"]).optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ESSENTIALS_MONTHLY: z.string().optional(),
    STRIPE_PRICE_ESSENTIALS_ANNUAL: z.string().optional(),
    STRIPE_PRICE_PROFESSIONAL_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PROFESSIONAL_ANNUAL: z.string().optional(),
    STRIPE_PRICE_FOUNDER_MONTHLY: z.string().optional(),
    STRIPE_PRICE_FOUNDER_ANNUAL: z.string().optional(),
  })
  .superRefine((value, context) => {
    const provider =
      value.BILLING_PROVIDER ??
      (process.env.NODE_ENV === "test" || !value.STRIPE_SECRET_KEY
        ? "fake"
        : "stripe");

    if (value.STRIPE_SECRET_KEY?.startsWith("sk_live")) {
      context.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "Live Stripe keys are not permitted in this environment.",
      });
    }

    if (provider === "stripe") {
      if (!value.STRIPE_SECRET_KEY) {
        context.addIssue({
          code: "custom",
          path: ["STRIPE_SECRET_KEY"],
          message:
            "STRIPE_SECRET_KEY is required when BILLING_PROVIDER=stripe.",
        });
      }
      if (!value.STRIPE_WEBHOOK_SECRET) {
        context.addIssue({
          code: "custom",
          path: ["STRIPE_WEBHOOK_SECRET"],
          message:
            "STRIPE_WEBHOOK_SECRET is required when BILLING_PROVIDER=stripe.",
        });
      }
    }
  });

export type BillingEnvironment = {
  BILLING_PROVIDER: "fake" | "stripe";
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  STRIPE_PRICE_ESSENTIALS_MONTHLY?: string | undefined;
  STRIPE_PRICE_ESSENTIALS_ANNUAL?: string | undefined;
  STRIPE_PRICE_PROFESSIONAL_MONTHLY?: string | undefined;
  STRIPE_PRICE_PROFESSIONAL_ANNUAL?: string | undefined;
  STRIPE_PRICE_FOUNDER_MONTHLY?: string | undefined;
  STRIPE_PRICE_FOUNDER_ANNUAL?: string | undefined;
};

export function parseBillingEnvironment(
  environment: Record<string, string | undefined>,
): BillingEnvironment {
  const parsed = billingEnvironmentSchema.parse(environment);
  const provider =
    parsed.BILLING_PROVIDER ??
    (process.env.NODE_ENV === "test" || !parsed.STRIPE_SECRET_KEY
      ? "fake"
      : "stripe");

  return {
    ...parsed,
    BILLING_PROVIDER: provider,
  };
}

export function getBillingEnvironment(): BillingEnvironment {
  return parseBillingEnvironment({
    BILLING_PROVIDER: process.env.BILLING_PROVIDER,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ESSENTIALS_MONTHLY:
      process.env.STRIPE_PRICE_ESSENTIALS_MONTHLY,
    STRIPE_PRICE_ESSENTIALS_ANNUAL: process.env.STRIPE_PRICE_ESSENTIALS_ANNUAL,
    STRIPE_PRICE_PROFESSIONAL_MONTHLY:
      process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    STRIPE_PRICE_PROFESSIONAL_ANNUAL:
      process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
    STRIPE_PRICE_FOUNDER_MONTHLY: process.env.STRIPE_PRICE_FOUNDER_MONTHLY,
    STRIPE_PRICE_FOUNDER_ANNUAL: process.env.STRIPE_PRICE_FOUNDER_ANNUAL,
  });
}

export function requireStripePriceId(
  planCode: CheckoutPlanCode,
  interval: BillingInterval,
  environment = getBillingEnvironment(),
) {
  const envKey = STRIPE_PRICE_ENV_KEYS[planCode][interval];
  const priceId = environment[envKey];
  if (!priceId) {
    throw new Error(`${envKey} is required to start Stripe Checkout.`);
  }
  return priceId;
}

export function applicationOrigin() {
  return getServerEnvironment().APP_ORIGIN;
}
