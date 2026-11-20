import { expect, test } from "@playwright/test";

import {
  HERO_HEADLINE,
  landingCopy,
} from "../../src/lib/marketing/landing-copy";

test("desktop navigation reaches the thread, platform and LeanAI", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: HERO_HEADLINE }),
  ).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Primary" });
  for (const [id, content] of [
    ["connect", landingCopy.connect],
    ["platform", landingCopy.platform],
    ["leanai", landingCopy.leanAI],
  ] as const) {
    const section = page.locator(`#${id}`);
    await navigation
      .getByRole("link", {
        name: id === "platform" ? "Platform" : content.kicker,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(
      section.getByRole("heading", { name: content.title }),
    ).toBeInViewport();
  }
  expect(errors).toEqual([]);
});

test("mobile CTAs fit, the thread scrolls within the page and the audit stays intact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const hero = page.locator("#hero");
  const links = hero.getByRole("link");
  await expect(links).toHaveCount(2);
  for (const link of await links.all()) {
    await expect(link).toBeInViewport();
    const bounds = await link.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(24);
    expect(bounds?.width).toBeGreaterThanOrEqual(24);
  }
  const [primary, secondary] = await Promise.all([
    links.nth(0).boundingBox(),
    links.nth(1).boundingBox(),
  ]);
  expect(secondary!.y).toBeGreaterThan(primary!.y + primary!.height);

  const thread = page.locator(".editorial-thread");
  await expect(thread).toHaveCSS("scroll-snap-type", "x mandatory");
  expect(
    await thread.evaluate((element) => element.scrollWidth),
  ).toBeGreaterThan(await thread.evaluate((element) => element.clientWidth));
  const audit = page.locator("#five-s img");
  await audit.scrollIntoViewIfNeeded();
  await expect
    .poll(() => audit.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1170);
  const ratio = await audit.evaluate(
    (image) => image.clientWidth / image.clientHeight,
  );
  expect(ratio).toBeCloseTo(1170 / 2532, 2);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("reduced motion holds Verified and disables the hero entrance", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("status").filter({ hasText: "Verified" }),
  ).toBeVisible();
  await expect(page.locator(".editorial-hero-fragments")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".kinetic-story")).toHaveCount(0);
});

test("standard motion changes Assigned to Verified", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const status = page.locator("#hero").getByRole("status");
  await expect(status).toHaveText("Assigned");
  await expect(status).toHaveText("Verified");
});

test("keyboard reaches the landing content and the FAQ booking link", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  const question = page.getByText(landingCopy.faq.items[1].question, {
    exact: true,
  });
  await question.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const access = page
    .locator("#faq")
    .getByRole("link", { name: "Request free access" });
  await expect(access).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/demo$/);
});
