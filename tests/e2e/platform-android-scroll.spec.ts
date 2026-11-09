import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  DEMO_ORGANISATION,
  DEMO_PROBLEM_SOLVING_CASE,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import { openMobileDrawer } from "./helpers/open-mobile-drawer";
import {
  programmaticScrollLocator,
  scrollPlatformMainViewportForProject,
  touchSwipeScrollOnLocator,
  usesChromiumCdpTouch,
  waitForNestedScrollContainer,
  WEBKIT_OVERFLOW_WIRING_ANNOTATION,
} from "./helpers/touch-scroll";

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

async function assertMainViewportScrolled(
  page: Page,
  testInfo: TestInfo,
  beforeScrollTop: number,
) {
  const afterFirst = await readScrollMetrics(page);
  if (
    usesChromiumCdpTouch(testInfo) &&
    afterFirst.viewportScrollTop <= beforeScrollTop
  ) {
    await scrollPlatformMainViewportForProject(page, 260, testInfo);
    await scrollPlatformMainViewportForProject(page, 260, testInfo);
  }
  const after = await readScrollMetrics(page);
  expect(after.viewportScrollTop).toBeGreaterThan(beforeScrollTop);
}

function defineMobilePlatformScrollSuite(deviceName: "Pixel 7" | "iPhone 13") {
  test.describe(`${deviceName} platform scrolling`, () => {
    test.describe.configure({ mode: "serial" });
    test.setTimeout(90_000);

    test.skip(
      !hasSupabaseE2e,
      "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
    );

    test("home workspace scrolls via touch swipe on the main viewport", async ({
      page,
    }, testInfo) => {
      await signInAsDemoUser(page, "admin");
      await expect(page.getByTestId("platform-home-page")).toBeVisible();
      await ensureTallWorkspace(page);

      const before = await readScrollMetrics(page);
      expect(["auto", "scroll"]).toContain(before.viewportOverflowY);
      expect(before.viewportScrollHeight).toBeGreaterThan(
        before.viewportClientHeight,
      );

      await scrollPlatformMainViewportForProject(page, 280, testInfo);
      await scrollPlatformMainViewportForProject(page, 280, testInfo);
      await assertMainViewportScrolled(
        page,
        testInfo,
        before.viewportScrollTop,
      );

      const after = await readScrollMetrics(page);
      expect(after.bodyOverflowY).not.toBe("hidden");
      expect(after.scrollLocked).toBe(false);
    });

    test("module list workspace scrolls on People", async ({
      page,
    }, testInfo) => {
      await signInAsDemoUser(page, "admin");
      await page.goto("/platform/people");
      await expect(page.getByTestId("people-directory-page")).toBeVisible();
      await ensureTallWorkspace(page);

      const before = await readScrollMetrics(page);
      await scrollPlatformMainViewportForProject(page, 360, testInfo);
      await assertMainViewportScrolled(
        page,
        testInfo,
        before.viewportScrollTop,
      );
    });

    test("problem-solving nested scroller overflow wiring", async ({
      page,
    }, testInfo) => {
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
        spacer.setAttribute("data-testid", "pps-mobile-scroll-spacer");
        spacer.style.height = "200vh";
        element.appendChild(spacer);
      });

      await waitForNestedScrollContainer(canvasScroller);

      const before = await canvasScroller.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

      const usedTouch = await touchSwipeScrollOnLocator(
        page,
        canvasScroller,
        280,
        testInfo,
      );
      if (usedTouch) {
        await touchSwipeScrollOnLocator(page, canvasScroller, 280, testInfo);
      }

      let after = await canvasScroller.evaluate((element) => element.scrollTop);
      if (after <= before.scrollTop) {
        if (!usesChromiumCdpTouch(testInfo)) {
          testInfo.annotations.push(WEBKIT_OVERFLOW_WIRING_ANNOTATION);
        }
        await programmaticScrollLocator(canvasScroller, 360);
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
    }, testInfo) => {
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
      await scrollPlatformMainViewportForProject(page, 320, testInfo);
      await assertMainViewportScrolled(
        page,
        testInfo,
        before.viewportScrollTop,
      );
    });
  });
}

defineMobilePlatformScrollSuite("Pixel 7");
defineMobilePlatformScrollSuite("iPhone 13");
