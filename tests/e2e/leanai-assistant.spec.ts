import { expect, test, type Page } from "@playwright/test";

import {
  ensureLeanAiAssistantOpen,
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function screenshotIfPossible(page: Page, name: string) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: false,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function waitForAssistantContext(page: Page) {
  const pane = await ensureLeanAiAssistantOpen(page);
  await expect(
    page.getByTestId("leanai-assistant-context-label"),
  ).not.toHaveText(/Loading context/i, { timeout: 15_000 });
  return pane;
}

test.describe("LeanAI persistent workspace assistant", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
  });

  test("desktop pane can collapse and reopen", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    const pane = await waitForAssistantContext(page);
    await expect(pane).toBeVisible();
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toBeVisible();
    await screenshotIfPossible(page, "leanai-assistant-desktop-open.png");

    await page.getByTestId("leanai-assistant-close").click();
    await expect(page.getByTestId("leanai-assistant-rail")).toBeVisible();
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveCount(0);
    await screenshotIfPossible(page, "leanai-assistant-desktop-collapsed.png");

    await page.getByTestId("leanai-assistant-open").click();
    await expect(page.getByTestId("leanai-assistant-pane")).toBeVisible();
  });

  test("Suggestions configuration and Maturity questions update context", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);

    await page.goto("/platform/suggestions/programmes");
    await expect(page.getByTestId("suggestion-programmes-page")).toBeVisible();
    await waitForAssistantContext(page);
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toContainText(/Suggestions/i);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-workflow",
      "programme_configuration",
    );
    await expect(page.getByTestId("leanai-assistant-summary")).toContainText(
      /Programme/i,
    );
    await screenshotIfPossible(page, "leanai-assistant-suggestions-config.png");

    await page.goto("/platform/maturity/models");
    await expect(page.getByTestId("maturity-models-page")).toBeVisible();
    await page.getByLabel("Name").fill("Assistant Framework");
    await page.getByRole("button", { name: "Create draft framework" }).click();
    await expect(page).toHaveURL(/\/platform\/maturity\/models\/[0-9a-f-]+/i, {
      timeout: 30_000,
    });
    await waitForAssistantContext(page);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-workflow",
      "maturity_authoring",
    );

    await page.getByTestId("framework-step-questions").click();
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-authoring-step",
      "questions",
      { timeout: 15_000 },
    );
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toContainText(/Questions/i);
    await screenshotIfPossible(page, "leanai-assistant-maturity-questions.png");
  });

  test("mobile assistant is an accessible drawer", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    await expect(page.getByTestId("leanai-assistant-open")).toBeVisible();
    await page.getByTestId("leanai-assistant-open").focus();
    await expect(page.getByTestId("leanai-assistant-open")).toBeFocused();
    await page.keyboard.press("Enter");
    const pane = page.getByTestId("leanai-assistant-pane");
    await expect(pane).toBeVisible();
    await expect(page.getByLabel("Ask LeanAI")).toBeVisible();
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).not.toHaveText(/Loading context/i, { timeout: 15_000 });
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    await screenshotIfPossible(page, "leanai-assistant-mobile.png");
  });
});
