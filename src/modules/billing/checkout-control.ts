/**
 * Production is closed to new self-service checkouts until explicitly enabled.
 * Local development and CI retain their existing test flows by default.
 *
 * This intentionally does not gate webhook processing, customer portal access,
 * or existing subscription lifecycle operations.
 */
export function isSelfServiceCheckoutEnabled(
  environment: {
    NODE_ENV?: string;
    LEH_SELF_SERVICE_CHECKOUT_ENABLED?: string;
  } = process.env,
): boolean {
  if (environment.LEH_SELF_SERVICE_CHECKOUT_ENABLED === "false") return false;
  if (environment.LEH_SELF_SERVICE_CHECKOUT_ENABLED === "true") return true;
  return environment.NODE_ENV !== "production";
}
