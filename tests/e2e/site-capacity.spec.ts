import { expect, test } from "@playwright/test";

import {
  completeFoundingCheckout,
  completeStructureFirstSetupToPlatform,
  loginAsFoundingUser,
  provisionFoundingE2eUser,
} from "./helpers/founding-onboarding";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function screenshotIfPossible(
  page: import("@playwright/test").Page,
  name: string,
) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: true,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function addCustomSite(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByTestId("add-unit-button").click();
  await expect(page.getByTestId("add-unit-drawer")).toBeVisible();
  await expect(page.getByTestId("unit-create-form")).toBeVisible();
  await page.locator("#unit-name").fill(name);
  await page.getByTestId("unit-type-choice").selectOption("custom");
  await page.getByTestId("unit-type").fill("site");
  await page.getByTestId("unit-create-submit").click();
}

test.describe("subscribed site capacity", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("1 of 1 subscribed sites denies a second Site and directs the owner to Billing", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const user = await provisionFoundingE2eUser();
    await loginAsFoundingUser(page, user);
    await completeFoundingCheckout(page, user, 1);
    await completeStructureFirstSetupToPlatform(page);

    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(page.getByTestId("site-capacity-headline")).toHaveText(
      "1 of 1 subscribed sites active",
    );
    await expect(page.getByTestId("site-capacity-remaining")).toHaveText(
      "No additional site slots available",
    );
    await screenshotIfPossible(page, "structure-site-capacity-1-of-1.png");

    await addCustomSite(page, "Second Site");
    await expect(page.getByTestId("site-capacity-error")).toContainText(
      "used all subscribed site capacity",
    );
    await expect(page.getByTestId("site-capacity-error")).not.toContainText(
      /postgres|P0001|23514/i,
    );
    await expect(page.getByTestId("site-capacity-open-billing")).toBeVisible();
    await screenshotIfPossible(page, "structure-site-capacity-exhausted.png");
    await page.getByTestId("site-capacity-open-billing").click();
    await expect(page.getByTestId("billing-settings-page")).toBeVisible();
    await expect(page.getByTestId("billing-site-capacity-headline")).toHaveText(
      "1 of 1 active",
    );
    await expect(
      page.getByTestId("billing-site-capacity-remaining"),
    ).toHaveText("No additional site slots available");
    await expect(
      page.getByRole("button", { name: "Manage billing" }),
    ).toBeVisible();
    await screenshotIfPossible(page, "billing-site-capacity-1-of-1.png");
  });

  test("quantity 2 allows a second site under the same organisation", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const user = await provisionFoundingE2eUser();
    await loginAsFoundingUser(page, user);
    await completeFoundingCheckout(page, user, 2);
    await completeStructureFirstSetupToPlatform(page);

    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(page.getByTestId("site-capacity-headline")).toHaveText(
      "1 of 2 subscribed sites active",
    );
    await expect(page.getByTestId("site-capacity-remaining")).toHaveText(
      "1 additional site slot available",
    );

    await addCustomSite(page, "Second Site");
    await expect(
      page.locator('[data-testid^="org-unit-node-"]').filter({
        hasText: user.firstSiteName,
      }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid^="org-unit-node-"]').filter({
        hasText: "Second Site",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("site-capacity-headline")).toHaveText(
      "2 of 2 subscribed sites active",
    );
    await screenshotIfPossible(page, "structure-site-capacity-2-of-2.png");

    await page.goto("/platform/settings/billing");
    await expect(page.getByTestId("billing-site-capacity-headline")).toHaveText(
      "2 of 2 active",
    );
  });
});
