import { expect, test } from "@playwright/test";

import {
  HERO_HEADLINE,
  landingCopy,
} from "../../src/lib/marketing/landing-copy";

test("desktop navigation reaches the product, how it works and the FAQ", async ({
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
  for (const [id, label, title] of [
    ["platform", "Product", landingCopy.platform.title],
    ["connect", "How it works", landingCopy.connect.title],
    ["faq", "FAQ", landingCopy.faq.title],
  ] as const) {
    await navigation.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(
      page.locator(`#${id}`).getByRole("heading", { name: title }),
    ).toBeInViewport();
  }
  expect(errors).toEqual([]);
});

for (const width of [360, 390, 768, 1280, 1440]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
}

test("mobile hero shows the CTAs and the phone capture only", async ({
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
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(hero.locator(".lv-hero-desktop")).toBeHidden();
  const phone = hero.locator(".lv-hero-phone img");
  await expect(phone).toBeVisible();
  // A 390 px phone gets the 780 w variant, not the 1170 px master.
  await expect
    .poll(() => phone.evaluate((image: HTMLImageElement) => image.currentSrc))
    .toMatch(/-780w\.(avif|webp)$/);

  const thread = page.locator(".editorial-thread");
  await expect(thread).toHaveCSS("scroll-snap-type", "x mandatory");
  expect(
    await thread.evaluate((element) => element.scrollWidth),
  ).toBeGreaterThan(await thread.evaluate((element) => element.clientWidth));
  // Desktop masters (2400 px) are never chosen on a phone.
  const finding = page.locator("#connect img").first();
  await finding.scrollIntoViewIfNeeded();
  await expect
    .poll(() => finding.evaluate((image: HTMLImageElement) => image.currentSrc))
    .toMatch(/-(800|1200)w\.(avif|webp)$/);
});

test("desktop hero puts the dashboard on stage with the phone overlapping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const desktop = page.locator("#hero .lv-hero-desktop img");
  const phone = page.locator("#hero .lv-hero-phone img");
  await expect(desktop).toBeVisible();
  await expect(phone).toBeVisible();
  const a = (await desktop.boundingBox())!;
  const b = (await phone.boundingBox())!;
  expect(b.x).toBeLessThan(a.x + 0.3 * a.width);
  expect(b.x + b.width).toBeGreaterThan(a.x);
  // The dashboard bleeds off the right edge.
  expect(a.x + a.width).toBeGreaterThanOrEqual(1430);
});

test("reduced motion disables the hero entrance", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".lv-hero-stage")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("keyboard reaches the landing content and the early-access form", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  const access = page
    .locator("#hero")
    .getByRole("link", { name: "Get free access" });
  await access.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#get-free-access$/);
  await page.getByLabel("Full name").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Work email")).toBeFocused();
});

test("early-access form validates and reports when it is not configured", async ({
  page,
}) => {
  await page.goto("/#get-free-access");
  const form = page.locator("#get-free-access form");
  await form.getByRole("button", { name: "Get free access" }).click();
  await expect(form.getByText("Enter your full name.")).toBeVisible();
  await expect(form.getByLabel("Full name")).toBeFocused();

  await form.getByLabel("Full name").fill("Alex Morgan");
  await form.getByLabel("Work email").fill("alex@example.com");
  await form.getByLabel("Company").fill("Example Foods");
  await form.getByLabel("Role or job title").fill("CI Manager");
  await form.getByLabel("Number of sites").fill("3");
  await form.getByLabel("Number of employees").selectOption("50–249");
  await form.getByLabel("Gemba walks").check();
  await form.getByLabel(/I agree to the/).check();
  await form.getByRole("button", { name: "Get free access" }).click();
  // CI has no webhook configured, so the route answers 503 politely.
  await expect(form.getByRole("alert")).toContainText("not switched on yet");
});
