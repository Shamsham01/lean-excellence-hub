export type OrganisationAccessStatus =
  "provisioning" | "active" | "suspended" | "closed";

export function pathForOrganisationStatus(
  status: OrganisationAccessStatus | string | null | undefined,
) {
  if (status === "provisioning") {
    return "/onboarding";
  }
  if (status === "suspended") {
    return "/billing";
  }
  return "/platform";
}
