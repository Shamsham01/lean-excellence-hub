import { describe, expect, it } from "vitest";

import { toCustomerErrorMessage } from "@/modules/people/customer-errors";

describe("customer error hygiene", () => {
  it("maps primary unit prerequisite errors to friendly copy", () => {
    expect(
      toCustomerErrorMessage(
        { message: "author has no primary organisational unit" },
        "fallback",
      ),
    ).toContain("organisation assignment is incomplete");
  });

  it("hides developer terminology", () => {
    expect(
      toCustomerErrorMessage(
        { message: "role version delegation picker API unavailable" },
        "Something went wrong",
      ),
    ).toBe("Something went wrong");
  });
});
