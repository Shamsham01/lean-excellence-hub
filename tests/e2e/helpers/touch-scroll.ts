import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

export const WEBKIT_OVERFLOW_WIRING_ANNOTATION = {
  type: "limitation",
  description:
    "WebKit mobile Playwright cannot dispatch Chromium CDP touch events. Programmatic scrollTop changes verify overflow container wiring only, not OS touch delivery.",
} as const;

export function usesChromiumCdpTouch(testInfo: TestInfo) {
  return testInfo.project.name === "chromium-pixel7";
}

async function dispatchCdpTouchSwipe(
  page: Page,
  x: number,
  startY: number,
  endY: number,
) {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: endY }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/** Chromium-only CDP touch swipe. Returns false on WebKit (callers must not invoke CDP). */
export async function touchSwipeScrollOnLocator(
  page: Page,
  locator: Locator,
  deltaY: number,
  testInfo: TestInfo,
): Promise<boolean> {
  if (!usesChromiumCdpTouch(testInfo)) {
    return false;
  }
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, "swipe target must have a layout box").toBeTruthy();
  const x = box!.x + box!.width / 2;
  const startY = box!.y + box!.height * 0.62;
  const endY = startY - deltaY;
  await dispatchCdpTouchSwipe(page, x, startY, endY);
  return true;
}

export async function programmaticScrollLocator(
  locator: Locator,
  deltaY: number,
) {
  await locator.evaluate((element, delta) => {
    element.scrollTop += delta;
  }, deltaY);
}

/** Wait until a nested overflow scroller has a real layout box (WebKit flex can lag). */
export async function waitForNestedScrollContainer(
  locator: Locator,
  timeoutMs = 20_000,
) {
  await expect
    .poll(async () => locator.evaluate((element) => element.clientHeight), {
      timeout: timeoutMs,
    })
    .toBeGreaterThan(0);
}

export async function touchSwipePlatformMainViewport(
  page: Page,
  deltaY: number,
  testInfo: TestInfo,
): Promise<boolean> {
  return touchSwipeScrollOnLocator(
    page,
    page.locator(".platform-main-viewport").first(),
    deltaY,
    testInfo,
  );
}

export async function scrollPlatformMainViewportForProject(
  page: Page,
  deltaY: number,
  testInfo: TestInfo,
) {
  if (usesChromiumCdpTouch(testInfo)) {
    await touchSwipePlatformMainViewport(page, deltaY, testInfo);
    return;
  }
  testInfo.annotations.push(WEBKIT_OVERFLOW_WIRING_ANNOTATION);
  await programmaticScrollLocator(
    page.locator(".platform-main-viewport").first(),
    deltaY,
  );
}
