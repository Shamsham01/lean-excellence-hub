import "server-only";

import { z } from "zod";

import { getServerEnvironment } from "@/platform/env";
import { STRIPE_PRICE_ENV_KEYS } from "./catalogue";
import type { BillingInterval, CheckoutPlanCode } from "./types";

export class BillingConfigurationError extends Error {
  constructor(message = "Billing is unavailable.") {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

const BILLING_PROVIDER_UNAVAILABLE =
  "Billing is unavailable: BILLING_PROVIDER must be set to 'fake' or 'stripe'.";

const billingEnvironmentSchema = z
  .object({
    BILLING_PROVIDER: z.enum(["fake", "stripe"], {
      error: BILLING_PROVIDER_UNAVAILABLE,
    }),
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
    if (value.STRIPE_SECRET_KEY?.startsWith("sk_live")) {
      context.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "Live Stripe keys are not permitted in this environment.",
      });
    }

    if (value.BILLING_PROVIDER === "stripe") {
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

function configurationErrorFromIssues(
  issues: readonly { message: string }[],
): BillingConfigurationError {
  const liveKeyIssue = issues.find((issue) =>
    issue.message.includes("Live Stripe keys"),
  );
  if (liveKeyIssue) {
    return new BillingConfigurationError(liveKeyIssue.message);
  }

  const stripeSecretIssue = issues.find((issue) =>
    issue.message.includes("STRIPE_SECRET_KEY is required"),
  );
  if (stripeSecretIssue) {
    return new BillingConfigurationError(stripeSecretIssue.message);
  }

  const webhookIssue = issues.find((issue) =>
    issue.message.includes("STRIPE_WEBHOOK_SECRET is required"),
  );
  if (webhookIssue) {
    return new BillingConfigurationError(webhookIssue.message);
  }

  return new BillingConfigurationError(
    issues[0]?.message ?? BILLING_PROVIDER_UNAVAILABLE,
  );
}

export function parseBillingEnvironment(
  environment: Record<string, string | undefined>,
): BillingEnvironment {
  const parsed = billingEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw configurationErrorFromIssues(parsed.error.issues);
  }

  return {
    ...parsed.data,
    BILLING_PROVIDER: parsed.data.BILLING_PROVIDER,
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

export function tryGetBillingEnvironment(): BillingEnvironment | null {
  try {
    return getBillingEnvironment();
  } catch (cause) {
    if (cause instanceof BillingConfigurationError) {
      return null;
    }
    throw cause;
  }
}

export function isFakeBillingEnabled() {
  return tryGetBillingEnvironment()?.BILLING_PROVIDER === "fake";
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
