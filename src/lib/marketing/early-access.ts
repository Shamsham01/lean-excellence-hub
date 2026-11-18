/**
 * "Get free access" early-access form: field options, copy and validation.
 *
 * Shared by the client form (inline errors) and `/api/early-access` (the
 * authoritative check), so both apply exactly the same rules.
 */

export const EMPLOYEE_RANGES = ["1–49", "50–249", "250–999", "1,000+"] as const;

export const CI_AREAS = [
  "Maturity assessments",
  "5S audits",
  "Gemba walks",
  "Suggestions",
  "Actions",
  "Problem solving",
  "LeanAI",
] as const;

/** Versions recorded with every submission as the consent record. */
export const CONSENT_VERSION = "form-consent-v0.1-draft";
export const TERMS_VERSION = "terms-v0.1-draft";
export const PRIVACY_VERSION = "privacy-v0.1-draft";

/** LAUNCH form-consent-copy.md: required tick, unticked by default. */
export const CONSENT_LABEL =
  "I agree to the Terms and I'm happy for Lean Excellence Hub to contact me about early access and the product. I can withdraw at any time. See our Privacy Policy.";
/** LAUNCH form-consent-copy.md: optional second tick, unticked, not required. */
export const MARKETING_LABEL =
  "Also send me occasional product news and updates. You can unsubscribe at any time.";

export const earlyAccessMessages = {
  fullName: "Enter your full name.",
  workEmail: "Enter a valid work email.",
  company: "Enter your company name.",
  role: "Enter your role or job title.",
  sites: "Enter the number of sites.",
  employees: "Choose the number of employees.",
  ciAreas: "Choose at least one CI area.",
  consent: "Please tick the box to continue.",
  failed: "Something went wrong. Please try again.",
  notConfigured:
    "Early-access requests are not switched on yet. Please book a demo instead, and we will set up access with you.",
  rateLimited: "Too many requests. Please wait a minute and try again.",
} as const;

export type EarlyAccessField =
  | "fullName"
  | "workEmail"
  | "company"
  | "role"
  | "sites"
  | "employees"
  | "ciAreas"
  | "consent";

export type EarlyAccessInput = {
  fullName: string;
  workEmail: string;
  company: string;
  role: string;
  sites: number;
  employees: (typeof EMPLOYEE_RANGES)[number];
  ciAreas: (typeof CI_AREAS)[number][];
  consent: true;
  marketingOptIn: boolean;
};

export type EarlyAccessErrors = Partial<Record<EarlyAccessField, string>>;

export type EarlyAccessResult =
  | { ok: true; value: EarlyAccessInput }
  | { ok: false; errors: EarlyAccessErrors };

const MAX_TEXT = 160;
const MAX_EMAIL = 254;
const MAX_SITES = 100_000;
// Pragmatic address check: one @, a dot in the domain, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WHOLE_NUMBER = /^[0-9]+$/;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sites(value: unknown): number | null {
  const raw =
    typeof value === "number" ? String(value) : text(value).replace(/,/g, "");
  if (!WHOLE_NUMBER.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_SITES) {
    return null;
  }
  return parsed;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (typeof value === "string" && value) return [value];
  return [];
}

/** Validate one field (used by the client on blur). */
export function validateEarlyAccessField(
  field: EarlyAccessField,
  raw: Record<string, unknown>,
): string | undefined {
  const result = validateEarlyAccess(raw);
  return result.ok ? undefined : result.errors[field];
}

/** Validate a raw submission. Unknown keys are ignored. */
export function validateEarlyAccess(
  raw: Record<string, unknown>,
): EarlyAccessResult {
  const errors: EarlyAccessErrors = {};

  const fullName = text(raw.fullName);
  if (!fullName || fullName.length > MAX_TEXT) {
    errors.fullName = earlyAccessMessages.fullName;
  }

  const workEmail = text(raw.workEmail).toLowerCase();
  if (!EMAIL.test(workEmail) || workEmail.length > MAX_EMAIL) {
    errors.workEmail = earlyAccessMessages.workEmail;
  }

  const company = text(raw.company);
  if (!company || company.length > MAX_TEXT) {
    errors.company = earlyAccessMessages.company;
  }

  const role = text(raw.role);
  if (!role || role.length > MAX_TEXT) {
    errors.role = earlyAccessMessages.role;
  }

  const siteCount = sites(raw.sites);
  if (siteCount === null) errors.sites = earlyAccessMessages.sites;

  const employees = text(raw.employees);
  if (!(EMPLOYEE_RANGES as readonly string[]).includes(employees)) {
    errors.employees = earlyAccessMessages.employees;
  }

  const areas = [...new Set(list(raw.ciAreas))];
  if (
    areas.length === 0 ||
    !areas.every((area) => (CI_AREAS as readonly string[]).includes(area))
  ) {
    errors.ciAreas = earlyAccessMessages.ciAreas;
  }

  if (raw.consent !== true && raw.consent !== "on" && raw.consent !== "true") {
    errors.consent = earlyAccessMessages.consent;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      fullName,
      workEmail,
      company,
      role,
      sites: siteCount!,
      employees: employees as EarlyAccessInput["employees"],
      // Keep the canonical option order, whatever order they were ticked in.
      ciAreas: CI_AREAS.filter((area) => areas.includes(area)),
      consent: true,
      marketingOptIn:
        raw.marketingOptIn === true ||
        raw.marketingOptIn === "on" ||
        raw.marketingOptIn === "true",
    },
  };
}

/** Name of the hidden honeypot input. Real people never fill it. */
export const HONEYPOT_FIELD = "website";

export type EarlyAccessWebhookPayload = EarlyAccessInput & {
  termsAccepted: true;
  contactConsent: true;
  consentAt: string;
  consentLabel: string;
  consentVersion: string;
  termsVersion: string;
  privacyVersion: string;
  marketingOptInAt: string | null;
  marketingLabel: string | null;
  submittedAt: string;
  sourcePage: string;
};

export function buildWebhookPayload(
  value: EarlyAccessInput,
  {
    now,
    sourcePage,
  }: {
    now: Date;
    sourcePage: string;
  },
): EarlyAccessWebhookPayload {
  const at = now.toISOString();
  return {
    ...value,
    termsAccepted: true,
    contactConsent: true,
    consentAt: at,
    consentLabel: CONSENT_LABEL,
    consentVersion: CONSENT_VERSION,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    marketingOptInAt: value.marketingOptIn ? at : null,
    marketingLabel: value.marketingOptIn ? MARKETING_LABEL : null,
    submittedAt: at,
    sourcePage,
  };
}
