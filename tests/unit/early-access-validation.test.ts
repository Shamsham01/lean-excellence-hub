import { describe, expect, it } from "vitest";

import {
  buildWebhookPayload,
  CI_AREAS,
  CONSENT_LABEL,
  earlyAccessMessages,
  EMPLOYEE_RANGES,
  MARKETING_LABEL,
  validateEarlyAccess,
} from "@/lib/marketing/early-access";

const valid = {
  fullName: "  Alex Morgan ",
  workEmail: "Alex.Morgan@Example.co.uk",
  company: "Example Foods",
  role: "CI Manager",
  sites: "3",
  employees: "250–999",
  ciAreas: ["Gemba walks", "5S audits"],
  consent: true,
};

describe("early-access validation", () => {
  it("accepts a complete submission and normalises it", () => {
    const result = validateEarlyAccess(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      fullName: "Alex Morgan",
      workEmail: "alex.morgan@example.co.uk",
      company: "Example Foods",
      role: "CI Manager",
      sites: 3,
      employees: "250–999",
      ciAreas: ["5S audits", "Gemba walks"],
      consent: true,
      marketingOptIn: false,
    });
  });

  it("reports every missing field with the copy-v3 messages", () => {
    const result = validateEarlyAccess({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      fullName: earlyAccessMessages.fullName,
      workEmail: earlyAccessMessages.workEmail,
      company: earlyAccessMessages.company,
      role: earlyAccessMessages.role,
      sites: earlyAccessMessages.sites,
      employees: earlyAccessMessages.employees,
      ciAreas: earlyAccessMessages.ciAreas,
      consent: earlyAccessMessages.consent,
    });
  });

  it.each(["0", "-1", "1.5", "2e3", "abc", "", " ", "100001"])(
    "rejects %j as a number of sites",
    (sites) => {
      const result = validateEarlyAccess({ ...valid, sites });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.sites).toBe("Enter the number of sites.");
    },
  );

  it.each([
    ["1", 1],
    ["12", 12],
    ["1,200", 1200],
    [7, 7],
  ])("accepts %j sites as a free whole number", (sites, expected) => {
    const result = validateEarlyAccess({ ...valid, sites });
    expect(result.ok && result.value.sites).toBe(expected);
  });

  it.each(["not-an-email", "a@b", "a b@c.com", "@example.com"])(
    "rejects the email %j",
    (workEmail) => {
      const result = validateEarlyAccess({ ...valid, workEmail });
      expect(result.ok).toBe(false);
    },
  );

  it("only accepts the published employee ranges and CI areas", () => {
    expect(EMPLOYEE_RANGES).toEqual(["1–49", "50–249", "250–999", "1,000+"]);
    expect(CI_AREAS).toHaveLength(7);
    expect(validateEarlyAccess({ ...valid, employees: "10" }).ok).toBe(false);
    expect(validateEarlyAccess({ ...valid, ciAreas: ["Golf"] }).ok).toBe(false);
    expect(validateEarlyAccess({ ...valid, ciAreas: [] }).ok).toBe(false);
  });

  it("requires the consent tick and keeps marketing opt-in optional", () => {
    expect(validateEarlyAccess({ ...valid, consent: false }).ok).toBe(false);
    expect(validateEarlyAccess({ ...valid, consent: "yes" }).ok).toBe(false);
    const optedIn = validateEarlyAccess({ ...valid, marketingOptIn: true });
    expect(optedIn.ok && optedIn.value.marketingOptIn).toBe(true);
  });

  it("rejects over-long text", () => {
    expect(validateEarlyAccess({ ...valid, company: "x".repeat(161) }).ok).toBe(
      false,
    );
  });
});

describe("early-access webhook payload", () => {
  it("carries each consent flag separately with timestamps and versions", () => {
    const result = validateEarlyAccess({ ...valid, marketingOptIn: false });
    if (!result.ok) throw new Error("expected valid");
    const now = new Date("2026-11-18T07:00:00.000Z");
    const payload = buildWebhookPayload(result.value, {
      now,
      sourcePage: "/",
    });
    expect(payload).toMatchObject({
      fullName: "Alex Morgan",
      sites: 3,
      consent: true,
      termsAccepted: true,
      contactConsent: true,
      consentAt: "2026-11-18T07:00:00.000Z",
      consentLabel: CONSENT_LABEL,
      consentVersion: "form-consent-v0.1-draft",
      termsVersion: "terms-v0.1-draft",
      privacyVersion: "privacy-v0.1-draft",
      marketingOptIn: false,
      marketingOptInAt: null,
      marketingLabel: null,
      submittedAt: "2026-11-18T07:00:00.000Z",
      sourcePage: "/",
    });
  });

  it("records the marketing opt-in time and label only when ticked", () => {
    const result = validateEarlyAccess({ ...valid, marketingOptIn: true });
    if (!result.ok) throw new Error("expected valid");
    const payload = buildWebhookPayload(result.value, {
      now: new Date("2026-11-18T07:00:00.000Z"),
      sourcePage: "/",
    });
    expect(payload.marketingOptIn).toBe(true);
    expect(payload.marketingOptInAt).toBe("2026-11-18T07:00:00.000Z");
    expect(payload.marketingLabel).toBe(MARKETING_LABEL);
  });
});
