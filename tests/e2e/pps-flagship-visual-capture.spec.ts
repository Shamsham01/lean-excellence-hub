import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  activateA3StructuredMethod,
  openProblemSolvingStage,
} from "./helpers/guided-problem-solving-workspace";

const capture = process.env.CAPTURE_PPS_SCREENSHOTS === "1";
const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const outDir =
  process.env.PPS_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/app-screenshots";

async function setTheme(
  page: import("@playwright/test").Page,
  mode: "light" | "dark",
) {
  await page.evaluate((m) => {
    document.documentElement.classList.toggle("dark", m === "dark");
    localStorage.setItem("theme", m);
  }, mode);
  await page.waitForTimeout(200);
}

test.describe("PPS flagship visual capture", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  test.skip(
    !capture || !hasSupabaseE2e,
    "Set CAPTURE_PPS_SCREENSHOTS=1 and E2E_WITH_SUPABASE=1",
  );

  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  test("capture platform shell and PPS workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAsDemoUser(page, "manager");

    await page.goto("/platform");
    await expect(page.getByTestId("platform-shell")).toBeVisible();
    await setTheme(page, "light");
    await page.screenshot({
      path: join(outDir, "app-platform-home-light.png"),
      fullPage: false,
    });
    await setTheme(page, "dark");
    await page.screenshot({
      path: join(outDir, "app-platform-home-dark.png"),
      fullPage: false,
    });

    const a3Title = `E2E A3 capture ${Date.now().toString(36)}`;
    await page.goto("/platform/problem-solving/new");
    const a3Wizard = page.getByTestId("create-problem-solving-wizard");
    await page.getByTestId("create-case-title").fill(a3Title);
    await a3Wizard.getByTestId("case-unit-select").selectOption({ index: 1 });
    await a3Wizard.getByTestId("create-case-owner").selectOption({ index: 1 });
    for (let i = 0; i < 4; i += 1) {
      await a3Wizard.getByRole("button", { name: "Next", exact: true }).click();
    }
    await a3Wizard.getByRole("button", { name: "Next", exact: true }).click();
    await a3Wizard.getByRole("button", { name: "Create draft case" }).click();
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible({
      timeout: 30_000,
    });
    await activateA3StructuredMethod(page);
    await expect(
      page.getByTestId("problem-solving-header").getByText("Active", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await openProblemSolvingStage(page, "TARGET_CONDITION");
    await expect(page.getByTestId("pps-stage-canvas")).toBeVisible();

    await setTheme(page, "light");
    await page.screenshot({
      path: join(outDir, "app-pps-a3-light.png"),
      fullPage: false,
    });
    await setTheme(page, "dark");
    await page.screenshot({
      path: join(outDir, "app-pps-a3-dark.png"),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, "light");
    await page.getByTestId("pps-mobile-copilot-trigger").click();
    await expect(page.getByTestId("pps-lean-ai-copilot")).toBeVisible();
    await page.screenshot({
      path: join(outDir, "app-pps-mobile-light.png"),
      fullPage: false,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    const rapidTitle = `E2E Rapid capture ${Date.now().toString(36)}`;
    await page.goto("/platform/problem-solving/new");
    const wizard = page.getByTestId("create-problem-solving-wizard");
    await page.getByTestId("create-case-title").fill(rapidTitle);
    await wizard.getByTestId("case-unit-select").selectOption({ index: 1 });
    await wizard.getByTestId("create-case-owner").selectOption({ index: 1 });
    for (let i = 0; i < 4; i += 1) {
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
    }
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await wizard.getByRole("button", { name: "Create draft case" }).click();
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByTestId("activate-method-select")
      .selectOption({ label: /rapid/i });
    await page.getByTestId("problem-solving-activate-button").click();
    await expect(
      page.getByTestId("problem-solving-header").getByText("Active", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await setTheme(page, "light");
    await page.screenshot({
      path: join(outDir, "app-pps-rapid-light.png"),
      fullPage: false,
    });
    await setTheme(page, "dark");
    await page.screenshot({
      path: join(outDir, "app-pps-rapid-dark.png"),
      fullPage: false,
    });
  });
});
