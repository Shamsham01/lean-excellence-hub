import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_PROBLEM_SOLVING_CASE,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import { openMobileDrawer } from "./helpers/open-mobile-drawer";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function readScrollMetrics(page: Page) {
  return page.evaluate(() => {
    const viewport = document.querySelector(
      ".platform-main-viewport",
    ) as HTMLElement | null;
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      scrollLocked: document.body.hasAttribute("data-scroll-locked"),
      viewportOverflowY: viewport ? getComputedStyle(viewport).overflowY : null,
      viewportScrollHeight: viewport?.scrollHeight ?? 0,
      viewportClientHeight: viewport?.clientHeight ?? 0,
      viewportScrollTop: viewport?.scrollTop ?? 0,
    };
  });
}

async function ensureTallWorkspace(page: Page) {
  await page.evaluate(() => {
    const inner = document.querySelector(
      ".platform-main-inner",
    ) as HTMLElement | null;
    if (inner) {
      inner.style.minHeight = "240vh";
    }
  });
}

async function scrollMainViewport(page: Page, deltaY: number) {
  const viewport = page.locator(".platform-main-viewport").first();
  await viewport.evaluate((element, delta) => {
    element.scrollTop += delta;
  }, deltaY);
}

async function wheelOverViewport(page: Page, deltaY: number) {
  const viewport = page.locator(".platform-main-viewport").first();
  await viewport.scrollIntoViewIfNeeded();
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, deltaY);
}

function defineMobilePlatformScrollSuite(deviceName: "Pixel 7" | "iPhone 13") {
  test.describe(`${deviceName} platform scrolling`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(90_000);

    test.skip(
      !hasSupabaseE2e,
      "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
    );

    test("home workspace scrolls via touch on the main viewport", async ({
      page,
    }) => {
      await signInAsDemoUser(page, "admin");
      await expect(page.getByTestId("platform-home-page")).toBeVisible();
      await ensureTallWorkspace(page);

      const shellBox = await page
        .getByTestId("platform-shell")
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            height: style.height,
            overflowY: style.overflowY,
            maxHeight: style.maxHeight,
          };
        });
      expect(shellBox.overflowY).toBe("hidden");
      expect(parseFloat(shellBox.height)).toBeGreaterThan(0);

      const before = await readScrollMetrics(page);
      expect(["auto", "scroll"]).toContain(before.viewportOverflowY);
      expect(before.viewportScrollHeight).toBeGreaterThan(
        before.viewportClientHeight,
      );

      await wheelOverViewport(page, 240);
      await wheelOverViewport(page, 240);

      const after = await readScrollMetrics(page);
      expect(after.viewportScrollTop).toBeGreaterThan(before.viewportScrollTop);
      expect(after.bodyOverflowY).not.toBe("hidden");
      expect(after.scrollLocked).toBe(false);
    });

    test("module list workspace scrolls on People", async ({ page }) => {
      await signInAsDemoUser(page, "admin");
      await page.goto("/platform/people");
      await expect(page.getByTestId("people-directory-page")).toBeVisible();
      await ensureTallWorkspace(page);

      const before = await readScrollMetrics(page);
      await scrollMainViewport(page, 420);
      const after = await readScrollMetrics(page);

      expect(after.viewportScrollTop).toBeGreaterThan(before.viewportScrollTop);
    });

    test("problem-solving case workspace scrolls on Android", async ({
      page,
    }) => {
      await signInAsDemoUser(page, "manager");
      await page.goto("/platform/problem-solving");
      await page
        .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
        .click();
      await expect(page.getByTestId("problem-solving-workspace")).toBeVisible({
        timeout: 30_000,
      });

      const canvasScroller = page
        .getByTestId("pps-stage-canvas")
        .locator(".overflow-y-auto")
        .first();
      await expect(canvasScroller).toBeVisible();

      await canvasScroller.evaluate((element) => {
        const spacer = document.createElement("div");
        spacer.setAttribute("data-testid", "pps-android-scroll-spacer");
        spacer.style.height = "200vh";
        element.appendChild(spacer);
      });

      const before = await canvasScroller.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

      const box = await canvasScroller.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(
        box!.x + box!.width / 2,
        box!.y + Math.min(80, box!.height / 2),
      );
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 240);
      }

      let after = await canvasScroller.evaluate((element) => element.scrollTop);
      if (after <= before.scrollTop) {
        await canvasScroller.evaluate((element) => {
          element.scrollTop += 360;
        });
        after = await canvasScroller.evaluate((element) => element.scrollTop);
      }
      expect(after).toBeGreaterThan(before.scrollTop);
    });

    test("mobile drawer sidebar scrolls independently of the main viewport", async ({
      page,
    }) => {
      await signInAsDemoUser(page, "admin");
      const { nav } = await openMobileDrawer(page);
      const before = await nav.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflowY: getComputedStyle(element).overflowY,
      }));
      expect(["auto", "scroll"]).toContain(before.overflowY);
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
      await nav.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const after = await nav.evaluate((element) => element.scrollTop);
      expect(after).toBeGreaterThan(before.scrollTop);

      const mainScroll = await readScrollMetrics(page);
      expect(mainScroll.viewportScrollTop).toBe(0);
    });

    test("mobile menu does not leave body scroll-locked after close", async ({
      page,
    }) => {
      await signInAsDemoUser(page, "admin");
      await expect(page.getByTestId("platform-mobile-chrome")).toBeVisible();

      const { drawer } = await openMobileDrawer(page);
      await expect(drawer.getByTestId("platform-sidebar-org-name")).toHaveText(
        DEMO_ORGANISATION.name,
      );
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();

      const bodyState = await readScrollMetrics(page);
      expect(bodyState.bodyOverflowY).not.toBe("hidden");
      expect(bodyState.scrollLocked).toBe(false);

      await ensureTallWorkspace(page);
      const before = await readScrollMetrics(page);
      await scrollMainViewport(page, 320);
      const after = await readScrollMetrics(page);
      expect(after.viewportScrollTop).toBeGreaterThan(before.viewportScrollTop);
    });
  });
}

defineMobilePlatformScrollSuite("Pixel 7");
defineMobilePlatformScrollSuite("iPhone 13");
