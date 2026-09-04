import { describe, expect, it } from "vitest";

import {
  DEMO_ORGANISATION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import {
  QA_ORGANISATION,
  QA_ORGANISATION_CODE,
  QA_HOSTED_RESET_CONFIRM_TOKEN,
  QA_UNITS,
  QA_USERS,
} from "../../scripts/qa-tenant/constants";

describe("CookieWorks QA constants", () => {
  it("uses a dedicated organisation code separate from Apex demo", () => {
    expect(QA_ORGANISATION.code).toBe("cookieworks-manufacturing");
    expect(QA_ORGANISATION.code).not.toBe(DEMO_ORGANISATION.code);
  });

  it("uses deterministic QA user IDs separate from Apex demo IDs", () => {
    const qaIds = new Set<string>(
      Object.values(QA_USERS).map((user) => user.id),
    );
    const demoIds = new Set<string>(
      Object.values(DEMO_USERS).map((user) => user.id),
    );

    for (const id of qaIds) {
      expect(demoIds.has(id)).toBe(false);
      expect(id.startsWith("b0000000-")).toBe(true);
    }
  });

  it("models the Bodmin hierarchy with ten organisational units", () => {
    expect(QA_UNITS).toHaveLength(10);
    expect(QA_UNITS[0]?.code).toBe("bodmin-cookie-factory");
    expect(QA_UNITS.find((unit) => unit.code === "operations")?.parentKey).toBe(
      "bodmin-cookie-factory",
    );
    expect(
      QA_UNITS.filter((unit) => unit.parentKey === "operations"),
    ).toHaveLength(4);
  });

  it("uses fictional @cookieworks.local email domain", () => {
    for (const user of Object.values(QA_USERS)) {
      expect(user.email.endsWith("@cookieworks.local")).toBe(true);
    }
  });

  it("exposes the exact hosted confirmation token contract", () => {
    expect(QA_HOSTED_RESET_CONFIRM_TOKEN).toBe("DELETE_COOKIEWORKS_ONLY");
    expect(QA_ORGANISATION_CODE).toBe("cookieworks-manufacturing");
  });
});

describe("Apex demo constants contract", () => {
  it("retains the existing Apex demo organisation and user contract", () => {
    expect(DEMO_ORGANISATION).toEqual({
      code: "apex-manufacturing",
      name: "Apex Manufacturing",
    });
    expect(DEMO_USERS.admin.email).toBe("admin@apex.local");
    expect(DEMO_USERS.manager.id).toBe("a0000000-0000-0000-0000-000000000002");
  });
});
