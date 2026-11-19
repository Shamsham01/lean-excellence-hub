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
      name: "Book a demo",
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
  await page.getByRole("textbox", { name: "Company" }).fill("Example Foods");
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

test("the finding-story carousel switches steps and keeps captures whole", async ({
  page,
}) => {
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#why");
    const carousel = page.locator(".v6-carousel");
    await carousel.scrollIntoViewIfNeeded();
    // Each step carries a light and a dark capture; only the current
    // theme's picture is displayed, and frames letterbox instead of cropping.
    const frames =
      width >= 768
        ? carousel.locator(".v6-carousel-frame img:visible")
        : carousel.locator(".v6-track img:visible");
    await expect(frames).toHaveCount(5);
    for (const image of await frames.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      if (width >= 768) {
        await expect(image).toHaveCSS("object-fit", "contain");
      } else {
        const [rendered, natural] = await image.evaluate(
          (img: HTMLImageElement) => [
            img.clientWidth / img.clientHeight,
            img.naturalWidth / img.naturalHeight,
          ],
        );
        expect(Math.abs(rendered / natural - 1)).toBeLessThan(0.015);
      }
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
  const tabs = page.getByRole("tablist", { name: "From one finding" });
  const tab = (name: RegExp) => tabs.getByRole("tab", { name });
  await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(tab(/Act/)).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator(".v6-carousel-frame.is-active img:visible"),
  ).toHaveAttribute("src", /step-act-(light|dark)\.webp$/);
  await tab(/Learn/).click();
  await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
  await tab(/Learn/).press("Home");
  await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");
  await expect(tab(/Observe/)).toBeFocused();
  await tab(/Observe/).press("ArrowLeft");
  await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#why");
  const track = page.locator(".v6-track");
  await expect(track).toHaveCSS("scroll-snap-type", "x mandatory");
  await page
    .getByRole("group", { name: "Steps" })
    .getByRole("button", { name: /Solve/ })
    .click();
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await expect(
    page
      .getByRole("group", { name: "Steps" })
      .getByRole("button", { name: /Solve/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
