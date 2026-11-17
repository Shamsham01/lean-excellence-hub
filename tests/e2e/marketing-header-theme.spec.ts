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

  const primary = header.getByRole("link", { name: "Book a live demo" });
  await expect(primary).toHaveCSS("background-color", "rgb(70, 95, 255)");
  await expect(
    header.getByRole("link", { name: "Request free access" }),
  ).toHaveCount(0);
  await primary.click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator(".marketing")).toHaveCSS(
    "background-color",
    "rgb(9, 14, 23)",
  );

  await page.goto("/");
  const access = page
    .locator("#hero")
    .getByRole("link", { name: "Request free access" });
  await expect(access).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await access.click();
  await expect(page).toHaveURL(/\/demo$/);
});

test("mobile menu keeps the header booking link and returns focus on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(
    header.getByRole("link", { name: "Book a live demo" }),
  ).toBeVisible();
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
