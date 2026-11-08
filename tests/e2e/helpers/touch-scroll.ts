import { expect, type Locator, type Page } from "@playwright/test";

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

/** Drive a vertical swipe through CDP so WebKit mobile receives real touch input. */
export async function touchSwipeScrollOnLocator(
  page: Page,
  locator: Locator,
  deltaY: number,
) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, "swipe target must have a layout box").toBeTruthy();
  const x = box!.x + box!.width / 2;
  const startY = box!.y + box!.height * 0.62;
  const endY = startY - deltaY;
  await dispatchCdpTouchSwipe(page, x, startY, endY);
}

export async function touchSwipePlatformMainViewport(
  page: Page,
  deltaY: number,
) {
  await touchSwipeScrollOnLocator(
    page,
    page.locator(".platform-main-viewport").first(),
    deltaY,
  );
}
