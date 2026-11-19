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

test("the finding story switches steps and never shrinks a capture", async ({
  page,
}) => {
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#why");
    const carousel = page.locator(".v6-carousel");
    await carousel.scrollIntoViewIfNeeded();
    if (width >= 1024) {
      // Five desktop frames, one per step; captures keep their own
      // aspect (never cropped or squashed) inside a fixed 16:10 stage.
      const frames = carousel.locator(".v6-carousel-frame img:visible");
      await expect(frames).toHaveCount(5);
      for (const image of await frames.all()) {
        await expect(image).not.toHaveCSS("object-fit", "cover");
        const [w, h, iw, ih] = await image.evaluate((img: HTMLImageElement) => {
          const r = img.getBoundingClientRect();
          return [
            r.width,
            r.height,
            Number(img.getAttribute("width")),
            Number(img.getAttribute("height")),
          ];
        });
        expect(Math.abs(w / h - iw / ih)).toBeLessThan(0.01);
      }
      await expect(carousel.locator(".v6-steps")).toBeHidden();
    } else {
      // The step list shows only captures with a legible narrow crop.
      await expect(carousel.locator(".v6-step")).toHaveCount(5);
      await expect(carousel.getByRole("tablist")).toBeHidden();
      for (const image of await carousel
        .locator(".v6-steps img:visible")
        .all()) {
        await image.scrollIntoViewIfNeeded();
        const [rendered, intrinsic] = await image.evaluate(
          (img: HTMLImageElement) => [
            img.clientWidth,
            Number(img.getAttribute("width")),
          ],
        );
        // A 4:5 crop is ≥10 px text from 350 px; it is never upscaled.
        expect(rendered).toBeGreaterThanOrEqual(340);
        expect(rendered).toBeLessThanOrEqual(intrinsic);
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
  ).toHaveAttribute(
    "src",
    /(step-act-list|tile-actions-m)-(light|dark)\.webp$/,
  );
  await tab(/Learn/).click();
  await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
  await tab(/Learn/).press("Home");
  await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");
  await expect(tab(/Observe/)).toBeFocused();
  await tab(/Observe/).press("ArrowLeft");
  await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
});
