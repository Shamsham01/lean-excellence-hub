import { describe, expect, it } from "vitest";

import {
  loadFoundingOrganisationDomainHint,
  parseFoundingOrganisationDomainHint,
} from "@/modules/onboarding/founding-organisation-hint";

describe("founding organisation domain hint", () => {
  it("parses the generic possible-organisation state", () => {
    expect(
      parseFoundingOrganisationDomainHint({
        state: "possible_existing_organisation",
      }),
    ).toBe("possible_existing_organisation");
  });

  it("fails closed to none for malformed payloads", () => {
    expect(parseFoundingOrganisationDomainHint(null)).toBe("none");
    expect(parseFoundingOrganisationDomainHint({ state: "acme-foods" })).toBe(
      "none",
    );
  });

  it("fails closed when the rpc errors", async () => {
    await expect(
      loadFoundingOrganisationDomainHint(async () => ({
        data: null,
        error: new Error("denied"),
      })),
    ).resolves.toBe("none");
  });
});
