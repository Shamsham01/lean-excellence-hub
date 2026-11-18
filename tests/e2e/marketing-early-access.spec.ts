import { expect, test } from "@playwright/test";

test("header Get free access opens the early-access page with its form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Get free access" })
    .click();
  await expect(page).toHaveURL(/\/early-access$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Get free access." }),
  ).toBeVisible();
  const sites = page.getByLabel("Number of sites");
  await expect(sites).toHaveAttribute("type", "number");
  await expect(sites).toHaveAttribute("min", "1");
  await expect(sites).toHaveAttribute("placeholder", "e.g. 3");
  await expect(
    page.getByRole("complementary").getByRole("link", {
      name: "Book a live demo",
    }),
  ).toHaveAttribute("href", "/demo");
  await expect(page.getByText(/Harbourfield/)).toHaveCount(0);
});

test("the early-access form explains when requests are not switched on", async ({
  page,
}) => {
  await page.route("**/api/early-access", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_configured" }),
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/early-access");
  await page.getByLabel("Full name").fill("Alex Morgan");
  await page.getByLabel("Work email").fill("alex@example.com");
  await page.getByLabel("Company").fill("Example Foods");
  await page.getByLabel("Role or job title").fill("CI Manager");
  await page.getByLabel("Number of sites").fill("3");
  await page.getByLabel("Number of employees").selectOption("50–249");
  await page.getByRole("checkbox", { name: "5S audits" }).check();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Get free access" }).click();
  await expect(page.locator(".lv-form-error")).toContainText(
    "Early-access requests are not switched on yet.",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("the finding-story carousel scrolls with its buttons and keeps captures whole", async ({
  page,
}) => {
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#why");
    const track = page.locator(".editorial-thread");
    await track.scrollIntoViewIfNeeded();
    await expect(track).toHaveCSS("scroll-snap-type", "x mandatory");
    const images = track.locator("img");
    await expect(images).toHaveCount(4);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      const [rendered, natural] = await image.evaluate(
        (img: HTMLImageElement) => [
          img.clientWidth / img.clientHeight,
          img.naturalWidth / img.naturalHeight,
        ],
      );
      // Whole-pixel layout rounding only; a crop would differ far more.
      expect(Math.abs(rendered / natural - 1)).toBeLessThan(0.015);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#why");
  const track = page.locator(".editorial-thread");
  const carousel = page.locator(".editorial-carousel");
  const next = carousel.getByRole("button", { name: "Next", exact: true });
  await track.evaluate((element) =>
    element.scrollTo({ left: 0, behavior: "instant" }),
  );
  await expect(
    carousel.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
  await next.click();
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await expect(carousel.getByRole("button", { name: /Act/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await carousel.getByRole("button", { name: /Improve/ }).click();
  await expect(next).toBeDisabled();
  await expect(
    carousel.getByRole("button", { name: /Improve/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
