import { expect, test, type Locator, type Page } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const TEMPLATE_NAME = "LEH Operational Excellence Standard";
const DAILY_MANAGEMENT_QUESTION =
  "Are teams using a consistent routine to review safety, quality, delivery, cost and people performance?";
const RISK_QUESTION =
  "Are operational risks systematically identified, assessed and controlled?";
const SKILLS_QUESTION =
  "Are required skills defined for roles and responsibilities?";

async function screenshotIfPossible(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: options.fullPage ?? true,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function expectPreviewCount(
  preview: Locator,
  label: string,
  value: number,
) {
  await expect(
    preview
      .locator("dt", { hasText: label })
      .locator("xpath=following-sibling::dd"),
  ).toHaveText(String(value));
}

test.describe("MAT-TEMPLATE-01 maturity Quick Start", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
  );

  test("admin can preview and deploy the Operational Excellence template as a draft", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/maturity/models");
    await expect(page.getByTestId("maturity-quick-start-card")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: TEMPLATE_NAME }),
    ).toBeVisible();
    await expect(page.getByTestId("maturity-quick-start-card")).toContainText(
      "Pillars",
    );
    await expect(page.getByTestId("maturity-quick-start-card")).toContainText(
      "30",
    );
    await expect(page.getByTestId("maturity-quick-start-card")).toContainText(
      "60",
    );
    await expect(
      page.getByRole("button", { name: "Create draft framework" }),
    ).toBeVisible();
    await screenshotIfPossible(
      page,
      "maturity-frameworks-quick-start-card.png",
    );

    await page.getByTestId("preview-quick-start-template").click();
    await expect(
      page.getByTestId("maturity-template-preview-page"),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("LEH Quick Start")).toBeVisible();
    await expect(page.getByText("Deploys as draft")).toBeVisible();
    await expect(page.getByTestId("template-preview-pillar-1")).toContainText(
      "Operations",
    );

    await page.getByTestId("template-preview-criterion-1-1").click();
    await expect(
      page.getByTestId("template-preview-question-1-1-1"),
    ).toContainText(DAILY_MANAGEMENT_QUESTION);

    await page.getByTestId("template-preview-criterion-2-2").click();
    await expect(
      page.getByTestId("template-preview-question-2-2-1"),
    ).toContainText(RISK_QUESTION);

    await page.getByTestId("template-preview-criterion-5-3").click();
    await expect(
      page.getByTestId("template-preview-question-5-3-1"),
    ).toContainText(SKILLS_QUESTION);
    await screenshotIfPossible(page, "maturity-template-preview-desktop.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByTestId("maturity-template-preview-page"),
    ).toBeVisible();
    await expect(page.getByTestId("use-quick-start-template")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshotIfPossible(page, "maturity-template-preview-mobile.png", {
      fullPage: false,
    });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.getByTestId("use-quick-start-template").click();
    await expect(page.getByTestId("use-quick-start-template")).toBeDisabled();
    await expect(page.getByTestId("framework-editor")).toBeVisible({
      timeout: 45_000,
    });
    await expect(page).toHaveURL(
      /\/platform\/maturity\/models\/.+[?&]step=review/,
    );
    await expect(page.getByText(/v1 · draft/i)).toBeVisible();
    await expect(
      page.getByTestId("draft-version-preview-heading"),
    ).toContainText("Draft version");

    const preview = page.getByTestId("draft-structure-preview");
    await expect(preview).toBeVisible();
    await expectPreviewCount(preview, "Levels", 5);
    await expectPreviewCount(preview, "Pillars", 5);
    await expectPreviewCount(preview, "Criteria", 30);
    await expectPreviewCount(preview, "Scored questions", 60);
    await expect(preview).toContainText("Operations");
    await expect(preview).toContainText("People & Leadership");
    await expect(preview).toContainText(DAILY_MANAGEMENT_QUESTION);
    await screenshotIfPossible(page, "maturity-quick-start-draft-review.png");

    await page.getByTestId("framework-step-levels").click();
    const levelForm = page.getByTestId("edit-level-1");
    await expect(levelForm).toBeVisible();
    await levelForm.getByLabel("Level name").fill("Initial tailored");
    await levelForm.getByRole("button", { name: "Save level" }).click();
    await expect(page.getByTestId("authoring-save-feedback")).toHaveText(
      "Saved.",
    );
    await expect(levelForm.getByLabel("Level name")).toHaveValue(
      "Initial tailored",
    );

    await page.reload();
    await expect(page.getByTestId("edit-level-1")).toBeVisible();
    await expect(
      page.getByTestId("edit-level-1").getByLabel("Level name"),
    ).toHaveValue("Initial tailored");

    await page.getByTestId("framework-step-review").click();
    await expect(page.getByTestId("draft-structure-preview")).toContainText(
      "Initial tailored",
    );
    await expect(page.getByTestId("framework-editor")).toBeVisible();
    await expect(page.getByTestId("active-version-heading")).toHaveCount(0);

    await page.getByTestId("framework-step-publish").click();
    await page.getByTestId("publish-framework").click();
    await expect(page.getByTestId("active-version-heading")).toContainText(
      /Active version \d+ — Published/,
      { timeout: 20_000 },
    );
  });
});
