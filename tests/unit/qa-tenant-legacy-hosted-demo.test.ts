import { describe, expect, it } from "vitest";

import {
  HOSTED_PRELAUNCH_PROJECT_REF,
  LEGACY_HOSTED_DEMO_EXPECTED_MEMBERSHIPS,
  LEGACY_HOSTED_DEMO_ORGANISATION,
  QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN,
} from "../../scripts/qa-tenant/legacy-hosted-demo";
import { QA_ORGANISATION_CODE } from "../../scripts/qa-tenant/constants";

describe("legacy hosted demo constants", () => {
  it("pins the hosted pre-launch project ref", () => {
    expect(HOSTED_PRELAUNCH_PROJECT_REF).toBe("zsadfvjtknbbfomlmttv");
  });

  it("pins the legacy hosted demo organisation contract", () => {
    expect(LEGACY_HOSTED_DEMO_ORGANISATION).toEqual({
      id: "402811bb-aa05-4128-b7e5-a1e3b359b92e",
      code: "lean-excellence-demo",
      name: "Lean Excellence Demo",
    });
  });

  it("expects eight legacy memberships on current hosted pre-launch", () => {
    expect(LEGACY_HOSTED_DEMO_EXPECTED_MEMBERSHIPS).toBe(8);
  });

  it("uses a dedicated hosted replacement confirmation token", () => {
    expect(QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN).toBe(
      "DELETE_LEGACY_DEMO_AND_SEED_COOKIEWORKS",
    );
    expect(QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN).not.toBe(
      "DELETE_COOKIEWORKS_ONLY",
    );
  });

  it("keeps legacy and CookieWorks organisation codes distinct", () => {
    expect(LEGACY_HOSTED_DEMO_ORGANISATION.code).not.toBe(QA_ORGANISATION_CODE);
  });
});
