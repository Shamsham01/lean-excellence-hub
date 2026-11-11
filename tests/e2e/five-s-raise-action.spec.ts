import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("5S raise action from audit question", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("raises an action with photo, filters by audit, and shows back-link", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s");
    await page
      .getByTestId(/^five-s-overview-start-audit-form-/)
      .first()
      .click();
    await page.getByTestId("five-s-unit-select").selectOption({ index: 1 });
    await page.getByTestId("five-s-start-audit").click();
    await expect(page.getByTestId("five-s-audit-workspace")).toBeVisible({
      timeout: 30_000,
    });

    const raiseBtn = page
      .locator('[data-testid^="five-s-raise-action-"]')
      .first();
    await expect(raiseBtn).toBeVisible();
    await raiseBtn.click();
    await expect(page.getByTestId("actions-create-dialog")).toBeVisible();

    const unique = `E2E 5S action ${Date.now()}`;
    await page.getByTestId("action-create-file-input").setInputFiles({
      name: "five-s-action.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await page.locator("#action-create-title").fill(unique);
    await page.getByTestId("five-s-action-create-submit").click();
    await expect(page.getByTestId("actions-create-dialog")).toBeHidden({
      timeout: 30_000,
    });

    const auditUrl = page.url();
    const auditId = auditUrl.split("/audits/")[1]?.split(/[?#]/)[0];
    expect(auditId).toBeTruthy();

    await page.goto(`/platform/actions?source=five_s_audit&audit=${auditId}`);
    await expect(page.getByTestId("actions-planner-shell")).toBeVisible();
    await expect(page.getByText(unique)).toBeVisible({ timeout: 30_000 });

    await page.getByText(unique).click();
    await expect(page.getByTestId("action-five-s-source-chip")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("action-five-s-source-chip").click();
    await expect(page).toHaveURL(new RegExp(`/platform/5s/audits/${auditId}`));
  });
});
