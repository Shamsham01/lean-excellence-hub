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

test.describe("first-customer onboarding and rollout governance", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("Acme Foods Ltd keeps Plymouth history while rolling out Bristol", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const user = await provisionFoundingE2eUser();
    user.organisationName = "Acme Foods Ltd";
    user.firstSiteName = "Plymouth Factory";

    await loginAsFoundingUser(page, user);
    await expect(page.getByTestId("create-organisation-page")).toBeVisible();
    await expect(
      page.getByText(
        /What company, business or group does this site belong to/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/Which site are you setting up first/),
    ).toBeVisible();
    await page.getByLabel("Organisation name").fill(user.organisationName);
    await page.getByLabel("First site").fill(user.firstSiteName);
    await page
      .getByLabel("Yes, part of a wider multi-site organisation")
      .check();
    await screenshotIfPossible(page, "01c-founder-onboarding.png");
    await completeFoundingCheckout(page, user, 1, "yes");
    await completeStructureFirstSetupToPlatform(page);

    await expect(page.getByTestId("setup-page")).toBeVisible();
    await expect(page.getByTestId("first-customer-setup-intro")).toContainText(
      "Acme Foods Ltd",
    );
    await expect(page.getByTestId("first-customer-setup-intro")).toContainText(
      "Plymouth Factory",
    );
    await expect(page.getByTestId("first-customer-setup-intro")).toContainText(
      "Yes, part of a wider multi-site organisation",
    );
    await screenshotIfPossible(page, "01c-first-site-setup.png");

    await page.goto("/platform/settings/organisation");
    await expect(page.getByTestId("organisation-settings-page")).toBeVisible();
    await expect(page.getByTestId("rollout-governance-panel")).toBeVisible();
    await expect(page.getByTestId("rollout-capacity-headline")).toHaveText(
      "1 of 1 subscribed sites active",
    );
    await expect(page.getByTestId("rollout-state")).toHaveText(
      "Single-site pilot in a wider organisation",
    );
    await expect(
      page
        .getByTestId("rollout-governance-panel")
        .getByText("Plymouth Factory", {
          exact: true,
        }),
    ).toBeVisible();
    await screenshotIfPossible(page, "01c-rollout-governance.png");

    await page.getByTestId("roll-out-another-site").click();
    await expect(page.getByTestId("organisation-rollout-page")).toBeVisible();
    await expect(page.getByTestId("rollout-step-capacity")).toBeVisible();
    await expect(page.getByTestId("rollout-capacity-headline")).toContainText(
      "1 of 1",
    );
    await screenshotIfPossible(page, "01c-capacity-exhausted.png");
    await page.getByTestId("rollout-add-capacity").click();
    await expect(page.getByTestId("billing-settings-page")).toBeVisible();
    await expect(page.getByTestId("desired-site-quantity")).toHaveValue("2");
    await page.getByTestId("site-capacity-continue").click();
    await page.getByTestId("site-capacity-confirm").click();
    await expect(page.getByTestId("site-capacity-pending")).toBeVisible();
    await page.getByTestId("site-capacity-confirm-sandbox").click();
    await expect(page.getByTestId("billing-site-capacity-headline")).toHaveText(
      "1 of 2 active",
      { timeout: 30_000 },
    );

    await page.goto("/platform/settings/organisation/rollout");
    await expect(page.getByTestId("rollout-workspace")).toBeVisible();
    if (await page.getByTestId("rollout-step-capacity").isVisible()) {
      await page.getByRole("button", { name: "Continue" }).click();
    }
    await expect(page.getByTestId("rollout-step-site")).toBeVisible();
    await page.getByLabel("Site name").fill("Bristol Factory");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByTestId("rollout-step-leadership")).toBeVisible({
      timeout: 30_000,
    });
    await screenshotIfPossible(page, "01c-new-site-rollout.png");
    if (await page.getByRole("button", { name: "Skip for now" }).isVisible()) {
      await page.getByRole("button", { name: "Skip for now" }).click();
    } else {
      await page.getByRole("button", { name: "Continue to standards" }).click();
    }
    await expect(page.getByTestId("rollout-step-standards")).toBeVisible();
    await expect(page.getByTestId("rollout-step-standards")).toContainText(
      "Maturity Frameworks belong to Acme Foods Ltd",
    );
    await screenshotIfPossible(page, "01c-shared-standards.png");

    await page.goto("/platform/settings/organisation");
    await expect(page.getByTestId("rollout-capacity-headline")).toHaveText(
      "2 of 2 subscribed sites active",
    );
    await expect(
      page
        .getByTestId("rollout-governance-panel")
        .getByText("Plymouth Factory", {
          exact: true,
        }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("rollout-governance-panel")
        .getByText("Bristol Factory", {
          exact: true,
        }),
    ).toBeVisible();
    await expect(page.getByTestId("rollout-state")).toHaveText(
      "Multi-site organisation",
    );

    await page.goto("/platform/settings/structure");
    await expect(
      page.locator('[data-testid^="org-unit-node-"]').filter({
        hasText: "Plymouth Factory",
      }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid^="org-unit-node-"]').filter({
        hasText: "Bristol Factory",
      }),
    ).toBeVisible();

    await page.goto("/platform/maturity/models");
    await expect(page.getByTestId("maturity-quick-start-card")).toBeVisible();
    await screenshotIfPossible(page, "01c-shared-maturity-framework.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/platform/settings/organisation");
    await expect(page.getByTestId("rollout-governance-panel")).toBeVisible();
    await expect(page.getByTestId("rollout-site-list")).toBeVisible();
    await expect(page.getByTestId("roll-out-another-site")).toBeVisible();
    await screenshotIfPossible(page, "01c-rollout-mobile.png");
  });
});
