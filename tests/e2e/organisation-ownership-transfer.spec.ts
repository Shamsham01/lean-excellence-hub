import { expect, test } from "@playwright/test";

import {
  completeFoundingCheckout,
  completeStructureFirstSetupToPlatform,
  loginAsFoundingUser,
  provisionFoundingE2eUser,
} from "./helpers/founding-onboarding";
import {
  addActiveMemberToOwnerOrganisation,
  createOwnershipTransferMember,
  loginAsOrganisationMember,
} from "./helpers/ownership-transfer";

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

test.describe("organisation ownership transfer", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("Plymouth CI Manager can transfer ownership to Group OpEx Director", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const owner = await provisionFoundingE2eUser();
    owner.organisationName = "Acme Foods Group";
    owner.firstSiteName = "Plymouth Factory";
    const director = createOwnershipTransferMember("Group OpEx Director");

    await loginAsFoundingUser(page, owner);
    await completeFoundingCheckout(page, owner, 1, "yes");
    await completeStructureFirstSetupToPlatform(page);

    await addActiveMemberToOwnerOrganisation({
      owner,
      member: director,
    });

    await page.goto("/platform/settings/organisation");
    await expect(page.getByTestId("organisation-settings-page")).toBeVisible();
    await expect(
      page.getByTestId("organisation-ownership-section"),
    ).toBeVisible();
    await expect(
      page.getByTestId("organisation-ownership-section"),
    ).toContainText("Plymouth CI Manager");
    await expect(
      page.getByTestId("transfer-organisation-ownership"),
    ).toBeVisible();
    await screenshotIfPossible(page, "01d-ownership-desktop.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/platform/settings/organisation");
    await expect(
      page.getByTestId("transfer-organisation-ownership"),
    ).toBeVisible();
    await screenshotIfPossible(page, "01d-ownership-mobile.png");
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.getByTestId("transfer-organisation-ownership").click();
    await expect(page.getByTestId("organisation-ownership-page")).toBeVisible();
    await expect(
      page.getByTestId("ownership-transfer-workspace"),
    ).toBeVisible();
    await expect(page.getByText("Group OpEx Director")).toBeVisible();
    await expect(page.getByText(director.email)).toBeVisible();
    await expect(page.getByText("Other Foods Group")).toHaveCount(0);
    await expect(page.getByText("Inactive Member")).toHaveCount(0);
    await expect(page.getByText("Pending Member")).toHaveCount(0);

    await page.getByText("Group OpEx Director").click();
    await page.getByTestId("ownership-choose-continue").click();
    await expect(page.getByTestId("ownership-review-from")).toContainText(
      "Plymouth CI Manager",
    );
    await expect(page.getByTestId("ownership-review-to")).toContainText(
      "Group OpEx Director",
    );
    await expect(page.getByTestId("ownership-review-to")).toContainText(
      director.email,
    );
    await page.getByTestId("ownership-review-continue").click();

    await page.getByTestId("ownership-confirmation-input").fill("Wrong Name");
    await expect(page.getByTestId("ownership-confirm-transfer")).toBeDisabled();
    await page
      .getByTestId("ownership-confirmation-input")
      .fill(owner.organisationName);
    await expect(page.getByTestId("ownership-confirm-transfer")).toBeEnabled();
    await screenshotIfPossible(page, "01d-ownership-confirm.png");
    await page.getByTestId("ownership-confirm-transfer").click();
    await expect(page.getByTestId("ownership-transfer-complete")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ownership-transfer-complete")).toContainText(
      "Ownership transferred successfully",
    );

    await page.getByTestId("ownership-complete-back").click();
    await expect(
      page.getByTestId("organisation-ownership-section"),
    ).toBeVisible();
    await expect(
      page.getByTestId("organisation-ownership-section"),
    ).toContainText("Group OpEx Director");
    await expect(
      page.getByTestId("transfer-organisation-ownership"),
    ).toHaveCount(0);
    await page.goto("/platform/settings/organisation/ownership");
    await expect(page.getByTestId("organisation-ownership-page")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();

    await page.goto("/platform/settings/organisation");
    await expect(page.getByTestId("organisation-settings-page")).toBeVisible();
    await expect(
      page
        .getByTestId("rollout-governance-panel")
        .getByText("Plymouth Factory", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("rollout-capacity-headline")).toHaveText(
      "1 of 1 subscribed sites active",
    );

    await loginAsOrganisationMember(page, director, owner.organisationName);
    await page.goto("/platform/settings/organisation");
    await expect(
      page.getByTestId("organisation-ownership-section"),
    ).toContainText("Group OpEx Director");
    await expect(
      page.getByTestId("transfer-organisation-ownership"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("rollout-governance-panel")
        .getByText("Plymouth Factory", { exact: true }),
    ).toBeVisible();
    await screenshotIfPossible(page, "01d-ownership-new-owner.png");
  });
});
