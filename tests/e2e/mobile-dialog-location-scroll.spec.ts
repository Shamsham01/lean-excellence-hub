import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const VIEWPORTS = [
  { width: 320, height: 568, name: "320x568" },
  { width: 390, height: 664, name: "390x664" },
  { width: 390, height: 844, name: "390x844" },
  { width: 768, height: 1024, name: "768x1024" },
  { width: 1440, height: 900, name: "1440x900" },
] as const;

async function screenshot(page: Page, name: string) {
  if (!existsSync("/opt/cursor/artifacts")) {
    return;
  }
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.screenshot({
    path: `/opt/cursor/artifacts/${name}`,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>(
      '[data-testid="module-setup-create-dialog"]',
    );
    const scroller = dialog?.querySelector<HTMLElement>("[data-dialog-scroll]");
    const pageOverflow =
      document.documentElement.scrollWidth - window.innerWidth;
    return {
      page: pageOverflow,
      dialog: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
      scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
    };
  });
  expect(overflow.page).toBeLessThanOrEqual(1);
  expect(overflow.dialog).toBeLessThanOrEqual(1);
  expect(overflow.scroller).toBeLessThanOrEqual(1);
}

async function expectBoxInViewport(page: Page, testId: string) {
  const box = await page.getByTestId(testId).last().boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function organisationIdFor(
  user: LeanAiContextE2eUser,
  organisationName: string,
) {
  const { url, publishableKey } = resolveSupabaseEnv();
  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required");
  }
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signedIn.error) {
    throw signedIn.error;
  }
  const organisations = await client.rpc("list_my_eligible_organisations");
  if (organisations.error) {
    throw organisations.error;
  }
  const match = (
    organisations.data as Array<{
      organisation_id: string;
      organisation_name: string;
    }>
  ).find((row) => row.organisation_name === organisationName);
  if (!match) {
    throw new Error(`Organisation ${organisationName} was not listed`);
  }
  const switched = await client.rpc("switch_organisation", {
    target_organisation_id: match.organisation_id,
  });
  if (switched.error) {
    throw switched.error;
  }
  return { client, organisationId: match.organisation_id };
}

async function seedLocationFixture(user: LeanAiContextE2eUser) {
  const { client, organisationId } = await organisationIdFor(
    user,
    user.organisationAName,
  );
  const ai = await client.rpc("update_organisation_ai_settings", {
    target_ai_enabled: true,
    target_monthly_token_ceiling: 200000,
  });
  if (ai.error) {
    throw ai.error;
  }
  const site = await client.rpc("create_organisation_unit", {
    target_organisation_id: organisationId,
    target_parent_unit_id: null,
    unit_code: `scroll-site-${randomUUID().slice(0, 8)}`,
    unit_name: "Packing Site",
    unit_type: "site",
  });
  if (site.error) {
    throw site.error;
  }
  const names = Array.from({ length: 22 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return index === 21
      ? `Area ${number} Packing-Cell-With-A-Very-Long-Unbroken-Location-Token`
      : `Area ${number} Packing Cell`;
  });
  for (const [index, name] of names.entries()) {
    const created = await client.rpc("create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: site.data,
      unit_code: `scroll-area-${index + 1}-${randomUUID().slice(0, 6)}`,
      unit_name: name,
      unit_type: "department",
    });
    if (created.error) {
      throw created.error;
    }
  }
}

async function propose(
  page: Page,
  path: "/platform/gemba/setup/leanai" | "/platform/5s/setup/leanai",
  message: string,
  proposalName: string,
) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(path);
  await expect(page.getByTestId("module-setup-builder")).toBeVisible();
  await page.getByTestId("module-setup-input").fill(message);
  await page.getByTestId("module-setup-propose").click();
  await expect(page.getByTestId("module-setup-proposal-name")).toHaveText(
    proposalName,
    { timeout: 30_000 },
  );
}

async function openCreateDialog(page: Page) {
  const opener = page.getByTestId("module-setup-create-draft");
  await expect(opener).toBeVisible();
  await opener.click();
  await expect(page.getByTestId("module-setup-create-dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Create draft" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
}

test.describe("mobile location dialog scrolling", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
    await seedLocationFixture(user);
  });

  test("Gemba Create Draft scrolls at every required viewport", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await propose(
      page,
      "/platform/gemba/setup/leanai",
      "Leaders should notice interruptions",
      "Operational Gemba Walk",
    );

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await openCreateDialog(page);
      const dialog = page.getByTestId("module-setup-create-dialog");
      const scroller = dialog.locator("[data-dialog-scroll]");
      await expect(
        dialog.getByRole("heading", { name: "Create draft" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const frame = await dialog.evaluate((element) => {
        const scroller = element.querySelector(
          "[data-dialog-scroll]",
        ) as HTMLElement;
        const scrollerStyle = getComputedStyle(scroller);
        return {
          maxHeight: Number.parseFloat(element.style.maxHeight),
          top: Number.parseFloat(element.style.top),
          overflowY: scrollerStyle.overflowY,
          touchAction: scrollerStyle.touchAction,
        };
      });
      expect(frame.maxHeight).toBeLessThanOrEqual(viewport.height - 32 + 1);
      expect(frame.maxHeight).toBeGreaterThan(200);
      expect(frame.top).toBeGreaterThan(0);
      expect(frame.overflowY).toBe("auto");
      expect(frame.touchAction).toContain("pan-y");

      const scrollMetrics = await scroller.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(
        scrollMetrics.scrollHeight,
        JSON.stringify({ frame, scrollMetrics }),
      ).toBeGreaterThan(scrollMetrics.clientHeight + 8);
      const box = await scroller.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(
        box!.x + 40,
        box!.y + Math.min(80, box!.height / 2),
      );
      await page.mouse.wheel(0, 500);
      const scrollAfter = await scroller.evaluate(
        (element) => element.scrollTop,
      );
      expect(scrollAfter).toBeGreaterThan(scrollMetrics.scrollTop);

      const last = page.getByTestId("applicable-unit-checkbox").last();
      await last.scrollIntoViewIfNeeded();
      await last.check();
      await expect(last).toBeChecked();
      await scroller.evaluate((element) => {
        element.scrollTop = 0;
      });
      await expect(last).toBeChecked();
      await page
        .getByTestId("module-setup-confirm-create")
        .scrollIntoViewIfNeeded();
      await expectBoxInViewport(page, "module-setup-confirm-create");
      await expect(last).toBeChecked();
      await expect(page.getByRole("button", { name: "Close" })).toBeVisible();

      if (viewport.name === "390x844") {
        await page.keyboard.press("Tab");
        const focusInsideDialog = await page.evaluate(
          () => document.activeElement?.closest("[role='dialog']") != null,
        );
        expect(focusInsideDialog).toBe(true);
        await screenshot(page, "dialog_gemba_scrolled_390x844_light.png");
        await scroller.evaluate((element) => {
          element.scrollTop = 0;
        });
        await screenshot(page, "dialog_gemba_top_390x844_light.png");
      }
      if (viewport.name === "320x568") {
        await screenshot(page, "dialog_gemba_scrolled_320x568.png");
      }
      if (viewport.name === "1440x900") {
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(500);
        expect(box!.width).toBeLessThan(530);
        expect(
          Math.abs(box!.x + box!.width / 2 - viewport.width / 2),
        ).toBeLessThan(2);
        await screenshot(page, "dialog_gemba_1440x900.png");
      }

      const background = await page.evaluate(() => ({
        y: window.scrollY,
        main: document.querySelector(".platform-scroll")?.scrollTop ?? 0,
      }));
      await page.mouse.move(2, 2);
      await page.mouse.wheel(0, 600);
      const backgroundAfter = await page.evaluate(() => ({
        y: window.scrollY,
        main: document.querySelector(".platform-scroll")?.scrollTop ?? 0,
      }));
      expect(backgroundAfter).toEqual(background);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId("module-setup-proposal-name")).toHaveText(
        "Operational Gemba Walk",
      );
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await openCreateDialog(page);
    await page
      .getByTestId("module-setup-confirm-create")
      .scrollIntoViewIfNeeded();
    await page.getByTestId("module-setup-confirm-create").click();
    await expect(page.getByTestId("module-setup-create-error")).toContainText(
      "Select at least one applicable area.",
      { timeout: 30_000 },
    );
    const last = page.getByTestId("applicable-unit-checkbox").last();
    await last.scrollIntoViewIfNeeded();
    await last.check();
    const scroller = page.locator("[data-dialog-scroll]");
    await scroller.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(last).toBeChecked();
    await expect(page.getByTestId("module-setup-create-error")).toBeVisible();
    await page
      .getByTestId("module-setup-confirm-create")
      .scrollIntoViewIfNeeded();
    await expect(last).toBeChecked();
    await page.getByTestId("module-setup-confirm-create").click();
    await expect(
      page.getByRole("heading", { name: "Operational Gemba Walk" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("gemba-draft-boundary")).toBeVisible();
    await expect(page.getByText(/v1 · published/i)).toHaveCount(0);
    await page
      .getByTestId("gemba-question-prompt")
      .first()
      .fill("What else is visible?");
    await page.getByRole("button", { name: "Add prompt" }).first().click();
    await expect(page.getByText("What else is visible?")).toBeVisible();
    await screenshot(page, "gemba_draft_created_after_dialog_390x844.png");
  });

  test("Gemba Create Draft scrolls in dark mode", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      colorScheme: "dark",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await propose(
      page,
      "/platform/gemba/setup/leanai",
      "Leaders should notice interruptions",
      "Operational Gemba Walk",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await openCreateDialog(page);
    const last = page.getByTestId("applicable-unit-checkbox").last();
    await last.scrollIntoViewIfNeeded();
    await last.check();
    await page
      .getByTestId("module-setup-confirm-create")
      .scrollIntoViewIfNeeded();
    await expectBoxInViewport(page, "module-setup-confirm-create");
    await expect(last).toBeChecked();
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "dialog_gemba_scrolled_390x844_dark.png");
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("module-setup-create-dialog")).toBeHidden();
    await expect(page.getByTestId("module-setup-proposal-name")).toBeVisible();
    await context.close();
  });

  test("5S LeanAI Create Draft scrolls and saves the selected area", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await propose(
      page,
      "/platform/5s/setup/leanai",
      "Packing area workplace check",
      "Packing 5S Standard",
    );
    await page.setViewportSize({ width: 390, height: 664 });
    await openCreateDialog(page);
    await expectNoHorizontalOverflow(page);
    const last = page.getByTestId("applicable-unit-checkbox").last();
    await last.scrollIntoViewIfNeeded();
    await last.check();
    await page.locator("[data-dialog-scroll]").evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(last).toBeChecked();
    await page
      .getByTestId("module-setup-confirm-create")
      .scrollIntoViewIfNeeded();
    await expectBoxInViewport(page, "module-setup-confirm-create");
    await page.getByTestId("module-setup-confirm-create").click();
    await expect(
      page.getByRole("heading", { name: "Packing 5S Standard" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("five-s-draft-boundary")).toBeVisible();
    await expect(page.getByText(/v1 · published/i)).toHaveCount(0);
    await expect(
      page.getByText("Are unused items removed from the packing area?"),
    ).toBeVisible();
  });

  test("5S Quick Start stays reachable and can be authored and published", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/platform/5s/setup/quick-start");
    await expect(
      page.getByRole("heading", { name: "LEH Workplace 5S Standard" }),
    ).toBeVisible();
    const last = page.getByTestId("applicable-unit-checkbox").last();
    await last.scrollIntoViewIfNeeded();
    await last.check();
    await expect(last).toBeChecked();
    const deploy = page.getByTestId("module-setup-deploy");
    await deploy.scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
    await deploy.click();
    await expect(
      page.getByRole("heading", { name: "LEH Workplace 5S Standard" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("five-s-draft-boundary")).toBeVisible();
    await page
      .getByTestId("five-s-question-prompt")
      .first()
      .fill("Extra packing check");
    await page.getByRole("button", { name: "Add question" }).first().click();
    await expect(page.getByText("Extra packing check")).toBeVisible();
    await page.getByTestId("publish-five-s-standard").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible({
      timeout: 30_000,
    });
    await screenshot(page, "fives_quick_start_published_320x568.png");
  });

  test("Gemba manual authoring scrolls to the last area and publishes", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/platform/gemba/definitions");
    await page.getByLabel("Name").fill("Manual location walk");
    const last = page.getByTestId("applicable-unit-checkbox").last();
    await last.scrollIntoViewIfNeeded();
    await last.check();
    await expect(last).toBeChecked();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Manual location walk" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("gemba-draft-boundary")).toBeVisible();
    await page.getByTestId("gemba-section-title").fill("Flow");
    await page.getByRole("button", { name: "Add section" }).click();
    await expect(page.getByTestId("authoring-section")).toBeVisible();
    await page
      .getByTestId("gemba-question-prompt")
      .fill("Which location needs attention?");
    await page.getByRole("button", { name: "Add prompt" }).click();
    await expect(
      page.getByText("Which location needs attention?"),
    ).toBeVisible();
    await page.getByTestId("publish-gemba-definition").click();
    await expect(page.getByText(/v1 · published/i)).toBeVisible({
      timeout: 30_000,
    });
  });
});
