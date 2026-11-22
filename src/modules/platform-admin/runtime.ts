import "server-only";

export type PlatformBillingRuntime = {
  billingProvider: "fake" | "stripe" | "unconfigured";
  selfServiceCheckout: "stripe" | "not_in_this_environment";
  stripeSecretMode: "absent" | "live" | "test" | "unrecognised";
};

export function readPlatformBillingRuntime(
  environment: Record<string, string | undefined> = process.env,
): PlatformBillingRuntime {
  const provider = environment.BILLING_PROVIDER;
  const secret = environment.STRIPE_SECRET_KEY ?? "";
  const stripeSecretMode = secret.startsWith("sk_live")
    ? "live"
    : secret.startsWith("sk_test")
      ? "test"
      : secret
        ? "unrecognised"
        : "absent";

  return {
    billingProvider:
      provider === "stripe" || provider === "fake" ? provider : "unconfigured",
    selfServiceCheckout:
      provider === "stripe" ? "stripe" : "not_in_this_environment",
    stripeSecretMode,
  };
}
