export type PlatformAssuranceLevel = "aal1" | "aal2";

export type PlatformAccessDecision =
  "anonymous" | "denied" | "mfa" | "rate_limited" | "allowed";

export function decidePlatformAdminAccess(input: {
  allowlisted: boolean;
  assuranceLevel: PlatformAssuranceLevel | null;
  rateLimited: boolean;
  userId: string | null;
}): PlatformAccessDecision {
  if (input.rateLimited) {
    return "rate_limited";
  }
  if (!input.userId) {
    return "anonymous";
  }
  if (!input.allowlisted) {
    return "denied";
  }
  if (input.assuranceLevel !== "aal2") {
    return "mfa";
  }
  return "allowed";
}
