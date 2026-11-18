import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

test("marketing stays dark with a stored light preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");

  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await expect(page.locator(".marketing")).toHaveCSS(
    "background-color",
    "rgb(9, 14, 23)",
  );
  // The root and body are painted dark too, so iOS overscroll never shows light.
  for (const root of ["html", "body"]) {
    await expect(page.locator(root)).toHaveCSS(
      "background-color",
      "rgb(9, 14, 23)",
    );
    await expect(page.locator(root)).toHaveCSS("color-scheme", "dark");
  }
  await expect(page.getByRole("button", { name: /Appearance/ })).toHaveCount(0);
  const header = page.getByRole("banner");
  const mark = header.locator('img[src="/brand/leh-horizontal-dark.png"]');
  await expect(mark).toBeVisible();
  expect(
    await mark.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator('img[src*="leh-horizontal-light"]')).toHaveCount(0);

  const signIn = header.getByRole("link", { name: "Sign in" });
  await expect(signIn).toHaveAttribute("href", "/login");
  await expect(signIn).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const primary = header.getByRole("link", { name: "Book a demo" });
  await expect(primary).toHaveCSS("background-color", "rgb(70, 95, 255)");
  await expect(
    header.getByRole("link", { name: "Get free access" }),
  ).toHaveCount(0);

  // 64 px, transparent over the hero, then blurred and ruled after scrolling.
  const bar = page.locator(".marketing-header-bar");
  expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(65);
  await expect(bar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.mouse.wheel(0, 600);
  await expect(bar).toHaveCSS("background-color", "rgba(9, 14, 23, 0.8)");
  await expect(bar).toHaveCSS("border-bottom-color", "rgb(30, 45, 66)");

  await primary.click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator(".marketing")).toHaveCSS(
    "background-color",
    "rgb(9, 14, 23)",
  );

  await page.goto("/");
  const access = page
    .locator("#hero")
    .getByRole("link", { name: "Get free access" });
  await expect(access).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await access.click();
  await expect(page).toHaveURL(/#get-free-access$/);
  await expect(
    page.locator("#get-free-access").getByRole("heading", {
      level: 2,
      name: "Get free access.",
    }),
  ).toBeInViewport();
});

test("mobile menu keeps the header booking link and returns focus on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  const header = page.getByRole("banner");
  for (const root of ["html", "body"]) {
    await expect(page.locator(root)).toHaveCSS(
      "background-color",
      "rgb(9, 14, 23)",
    );
  }

  // The official lockup stays on one line on phones, never icon plus text.
  const home = header.getByRole("link", { name: "Lean Excellence Hub home" });
  const mark = home.locator('img[src="/brand/leh-horizontal-dark.png"]');
  await expect(mark).toBeVisible();
  expect(
    await mark.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(home.locator(".leh-brand-name")).toHaveCount(0);
  const homeBox = await home.boundingBox();
  const cta = header.getByRole("link", { name: "Book a demo" });
  await expect(cta).toBeVisible();
  const ctaBox = await cta.boundingBox();
  expect(homeBox!.x + homeBox!.width).toBeLessThanOrEqual(ctaBox!.x);
  expect(homeBox!.height).toBeLessThan(40);
  await expect(header.getByRole("link", { name: "Sign in" })).toBeHidden();

  const menu = header.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(
    header.getByRole("navigation", { name: "Mobile" }),
  ).toBeVisible();
  await expect(header.getByText("Appearance")).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(header.getByRole("navigation", { name: "Mobile" })).toBeHidden();
});
