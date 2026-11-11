import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_USERS } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Skill assessment methods", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("manager chooses practical observation and it is stored", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/people");
    await page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .click();
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();

    await page.getByTestId("open-skill-assessment").click();
    await expect(page.getByTestId("skill-assessment-dialog")).toBeVisible();

    const methodSelect = page.getByTestId("skill-assessment-method");
    await expect(methodSelect).toHaveValue("");

    await page
      .getByTestId("skill-assessment-skill")
      .selectOption({ label: "5S Auditing" });
    await page
      .getByTestId("skill-assessment-level")
      .selectOption({ label: "Advanced (4)" });
    await methodSelect.selectOption({ label: "Practical observation" });
    await page.getByTestId("skill-assessment-save").click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    await page.reload();
    await expect(page.getByText("practical_observation")).toBeVisible();
  });
});
