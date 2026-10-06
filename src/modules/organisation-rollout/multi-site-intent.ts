export const MULTI_SITE_INTENTS = ["yes", "no", "not_sure"] as const;

export type MultiSiteIntent = (typeof MULTI_SITE_INTENTS)[number];

export const MULTI_SITE_INTENT_LABELS: Record<MultiSiteIntent, string> = {
  yes: "Yes, part of a wider multi-site organisation",
  no: "No, this is a single-site organisation",
  not_sure: "Not sure yet",
};

export function isMultiSiteIntent(
  value: string | null | undefined,
): value is MultiSiteIntent {
  return value === "yes" || value === "no" || value === "not_sure";
}

export function parseMultiSiteIntent(value: unknown): MultiSiteIntent | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalised = value.trim().toLowerCase();
  return isMultiSiteIntent(normalised) ? normalised : null;
}

/**
 * Legacy organisations have no stored value. Treat missing as "not sure"
 * in product UX only — never as security or billing authority.
 */
export function resolveMultiSiteIntent(
  value: string | null | undefined,
): MultiSiteIntent {
  return isMultiSiteIntent(value) ? value : "not_sure";
}

export function namesLookAccidentalDuplicate(
  organisationName: string,
  siteName: string,
  intent: MultiSiteIntent,
) {
  if (intent !== "yes") {
    return false;
  }

  const organisation = organisationName.trim().toLowerCase();
  const site = siteName.trim().toLowerCase();
  return organisation.length > 0 && organisation === site;
}

export function identicalNameGuidance(
  organisationName: string,
  siteName: string,
) {
  const organisation = organisationName.trim() || "the organisation";
  const site = siteName.trim() || "this site";
  return `“${organisation}” and “${site}” are the same. If ${site} belongs to a wider group, use the company or group name for the organisation — for example Acme Foods Ltd — and keep ${site} as the site.`;
}

export function rolloutStateLabel(
  intent: MultiSiteIntent,
  activeSiteCount: number,
) {
  if (activeSiteCount > 1) {
    return "Multi-site organisation";
  }
  if (intent === "yes") {
    return "Single-site pilot in a wider organisation";
  }
  if (intent === "no") {
    return "Single-site organisation";
  }
  return "Not specified yet";
}

export function rolloutStateDescription(
  intent: MultiSiteIntent,
  activeSiteCount: number,
) {
  if (activeSiteCount > 1) {
    return "Several operational sites share this organisation. Standards can be reused while work stays local to each site.";
  }
  if (intent === "yes") {
    return "This organisation expects further sites later. Additional sites still require subscribed capacity and an authorised create step.";
  }
  if (intent === "no") {
    return "This organisation is currently set up around one operational site. You can add another site later if that changes.";
  }
  return "You can add another site to this organisation later without creating a separate Lean Excellence Hub organisation.";
}
