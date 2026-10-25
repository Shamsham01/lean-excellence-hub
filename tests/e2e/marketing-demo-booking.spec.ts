import { expect, test } from "@playwright/test";

test("homepage demo CTA opens the booking page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page
    .getByRole("banner")
    .locator(".marketing-header-bar")
    .getByRole("link", { name: "Book a live demo" })
    .click();

  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("heading", {
      name: "See operational excellence connected.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live booking is not connected" }),
  ).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("demo page has no horizontal overflow at mobile, tablet and desktop", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/demo");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("mobile menu books a demo and reduced motion still shows the page", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator(".marketing-mobile-panel")
    .getByRole("link", { name: "Book a live demo" })
    .click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("heading", {
      name: "See operational excellence connected.",
    }),
  ).toBeVisible();

  const skip = page.getByRole("link", { name: "Skip to main content" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.getByRole("link", { name: "Cal.com privacy notice" }).focus();
  await expect(page.locator("#main :focus")).toHaveAttribute(
    "href",
    "https://cal.com/privacy",
  );
});

test("demo page stays readable in dark theme", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Appearance" }).first().click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("heading", { name: "Live booking is not connected" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
