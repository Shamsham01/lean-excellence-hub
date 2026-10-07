import { describe, expect, it } from "vitest";

import { organisationNameMatchesConfirmation } from "@/modules/organisation-ownership/confirmation";
import { toOwnershipTransferErrorMessage } from "@/modules/organisation-ownership/errors";

describe("organisation ownership confirmation", () => {
  it("requires the exact organisation name after trimming", () => {
    expect(
      organisationNameMatchesConfirmation(
        "Acme Foods Group",
        "Acme Foods Group",
      ),
    ).toBe(true);
    expect(
      organisationNameMatchesConfirmation(
        "Acme Foods Group",
        "  Acme Foods Group  ",
      ),
    ).toBe(true);
    expect(
      organisationNameMatchesConfirmation(
        "Acme Foods Group",
        "acme foods group",
      ),
    ).toBe(false);
    expect(
      organisationNameMatchesConfirmation("Acme Foods Group", "Acme"),
    ).toBe(false);
  });
});

describe("organisation ownership errors", () => {
  it("maps authority and eligibility failures to safe customer copy", () => {
    expect(
      toOwnershipTransferErrorMessage({
        message: "organisation ownership transfer is not authorised",
      }),
    ).toMatch(/current organisation owner/i);
    expect(
      toOwnershipTransferErrorMessage({
        message: "ownership transfer target is not eligible",
      }),
    ).toMatch(/invite them first/i);
    expect(
      toOwnershipTransferErrorMessage({ message: "unexpected database fault" }),
    ).toMatch(/no change was made/i);
  });
});
