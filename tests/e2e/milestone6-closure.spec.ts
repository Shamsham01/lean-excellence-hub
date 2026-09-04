import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  DEMO_FIVE_S_STANDARD,
  DEMO_GEMBA_DEFINITION,
} from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Milestone 6 closure journeys", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("admin: create recurring 5S schedule through UI", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");
    await page.getByRole("link", { name: DEMO_FIVE_S_STANDARD.name }).click();

    await page.getByTestId("create-schedule-link").click();
    await expect(page.getByTestId("schedule-form")).toBeVisible();

    const scheduleTitle = `E2E Weekly 5S Schedule ${Date.now()}`;
    await page.getByTestId("schedule-title").fill(scheduleTitle);
    await page.getByTestId("schedule-frequency").selectOption("weekly");
    await page.getByTestId("schedule-submit").click();

    await expect(page).toHaveURL(/\/platform\/5s\/standards\//);
    await page.goto("/platform/schedule");
    await expect(
      page
        .locator('a[href^="/platform/schedule/"]')
        .filter({ hasText: scheduleTitle })
        .first(),
    ).toBeVisible();
  });

  test("admin: upload 5S audit evidence through UI", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");
    await page.getByRole("link", { name: DEMO_FIVE_S_STANDARD.name }).click();
    await page.getByRole("button", { name: "Start audit" }).click();
    await expect(page.getByLabel("Audit progress")).toBeVisible();

    const fixturePath = join(tmpdir(), "five-s-evidence.txt");
    writeFileSync(fixturePath, "closure evidence fixture");

    await page.getByTestId("evidence-file-input").setInputFiles(fixturePath);
    await expect(page.getByText("Evidence attached")).toBeVisible();
  });

  test("admin: upload Gemba walk evidence through UI", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba/definitions");
    await page.getByRole("link", { name: DEMO_GEMBA_DEFINITION.name }).click();
    await page.getByRole("button", { name: "Start walk" }).click();
    await expect(page.getByLabel("Walk progress")).toBeVisible();

    const fixturePath = join(tmpdir(), "gemba-evidence.txt");
    writeFileSync(fixturePath, "gemba closure evidence");

    await page.getByTestId("evidence-file-input").setInputFiles(fixturePath);
    await expect(page.getByText("Evidence attached")).toBeVisible();
  });

  test("admin: successor draft keeps historical audit pinned", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/history");
    await expect(page.getByText("100%").first()).toBeVisible();

    await page.goto("/platform/5s/standards");
    await page.getByRole("link", { name: DEMO_FIVE_S_STANDARD.name }).click();
    await expect(page.getByTestId("create-successor")).toBeVisible();
    await page.getByTestId("create-successor").click();
    await expect(page.getByRole("heading", { name: "Draft v2" })).toBeVisible();
    await expect(page.getByText("v1 · published")).toBeVisible();

    await page.goto("/platform/5s/history");
    await expect(page.getByText("100%").first()).toBeVisible();
  });

  test("tablet viewport: 5S audit workspace is usable", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");
    await page.getByRole("link", { name: DEMO_FIVE_S_STANDARD.name }).click();
    await page.getByRole("button", { name: "Start audit" }).click();

    await expect(page.getByRole("button", { name: "Yes" })).toBeVisible();
    await expect(page.getByTestId("evidence-uploader")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Audit progress")).toBeVisible();
  });
});
