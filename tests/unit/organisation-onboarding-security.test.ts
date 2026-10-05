import { describe, expect, it } from "vitest";

import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import { isSkippableStructureFirstStep } from "@/modules/organisation-onboarding/progress";

describe("structure-first onboarding security gates", () => {
  it("keeps suspended organisations on billing recovery instead of guided setup", () => {
    expect(pathForOrganisationStatus("suspended", true)).toBe("/billing");
  });

  it("keeps provisioning organisations on plan checkout instead of structure setup", () => {
    expect(pathForOrganisationStatus("provisioning", true)).toBe("/onboarding");
  });

  it("does not allow skipping organisation, site, or structure", () => {
    expect(isSkippableStructureFirstStep("organisation")).toBe(false);
    expect(isSkippableStructureFirstStep("site")).toBe(false);
    expect(isSkippableStructureFirstStep("structure")).toBe(false);
    expect(isSkippableStructureFirstStep("readiness")).toBe(false);
  });
});
