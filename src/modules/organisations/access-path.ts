export type OrganisationAccessStatus =
  "provisioning" | "active" | "suspended" | "closed";

export function pathForOrganisationStatus(
  status: OrganisationAccessStatus | string | null | undefined,
  onboardingRequired = false,
) {
  if (status === "provisioning") {
    return "/onboarding";
  }
  if (status === "suspended") {
    return "/billing";
  }
  if (status === "active" && onboardingRequired) {
    return "/onboarding/setup";
  }
  return "/platform";
}
