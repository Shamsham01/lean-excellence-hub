import { describe, expect, it } from "vitest";

import { pathForOrganisationStatus } from "@/modules/organisations/access-path";

describe("pathForOrganisationStatus", () => {
  it("sends provisioning organisations to onboarding, not the platform shell", () => {
    expect(pathForOrganisationStatus("provisioning")).toBe("/onboarding");
  });

  it("sends suspended organisations to billing recovery", () => {
    expect(pathForOrganisationStatus("suspended")).toBe("/billing");
  });

  it("sends active organisations that still require onboarding to the wizard", () => {
    expect(pathForOrganisationStatus("active", true)).toBe("/onboarding/setup");
  });

  it("keeps active organisations on the platform once onboarding is complete", () => {
    expect(pathForOrganisationStatus("active")).toBe("/platform");
  });

  it("does not invent a closed-organisation route", () => {
    expect(pathForOrganisationStatus("closed")).toBe("/platform");
  });
});
