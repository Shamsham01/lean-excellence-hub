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

test("the finding story swipes below 1024 and never stretches a phone crop", async ({
  page,
}) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    // A fresh load per width (a same-URL hash goto would keep the state).
    await page.goto(`/?w=${width}#why`);
    const carousel = page.locator(".v6-carousel");
    await expect(carousel).toHaveAttribute("data-mode", "swipe");
    await carousel.scrollIntoViewIfNeeded();
    // The rail stays in sync above five swipe panels: copy over the phone
    // crop, with no desktop window or arrow buttons.
    const tabs = carousel.getByRole("tablist", { name: "From one finding" });
    await expect(tabs.getByRole("tab")).toHaveCount(5);
    await expect(carousel.locator(".v6-hpanel-swipe")).toHaveCount(5);
    await expect(carousel.locator(".v6-hpanel-desk").first()).toBeHidden();
    await expect(
      carousel.getByRole("button", { name: "Next step" }),
    ).toBeHidden();
    const viewport = carousel.locator(".v6-hviewport");
    await expect(viewport).toHaveCSS("scroll-snap-type", "x mandatory");

    // Phone crops show at their natural 1.0x width (up to 1.25x on the
    // 768-1023 stage), never upscaled beyond that and never shrunk below
    // the space the window gives them.
    const maxScale = width >= 768 ? 1.25 : 1;
    const crops = await carousel.locator(".v6-step-shot img:visible").all();
    expect(crops.length).toBeGreaterThanOrEqual(4);
    for (const image of crops) {
      const [rendered, intrinsic, room] = await image.evaluate(
        (img: HTMLImageElement) => [
          img.getBoundingClientRect().width,
          Number(img.getAttribute("width")),
          img.closest(".v6-step-body")?.getBoundingClientRect().width ?? 0,
        ],
      );
      expect(rendered).toBeLessThanOrEqual((intrinsic / 2) * maxScale + 1);
      expect(rendered).toBeGreaterThanOrEqual(
        Math.min(room, intrinsic / 2) - 2,
      );
    }

    // Swiping moves the rail; the rail moves the swipe.
    const tab = (name: RegExp) => tabs.getByRole("tab", { name });
    await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");
    await viewport.evaluate((el) => {
      const panels = el.querySelectorAll<HTMLElement>(".v6-hpanel");
      el.scrollTo({ left: panels[1]!.offsetLeft - panels[0]!.offsetLeft });
    });
    await expect(tab(/Act/)).toHaveAttribute("aria-selected", "true");
    await tab(/Learn/).click();
    await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() =>
        viewport.evaluate(
          (el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
        ),
      )
      .toBe(true);
    await expect(page.locator(".v6-hpanel.is-active")).toHaveAttribute(
      "id",
      /learn/,
    );

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("the finding story pins at 1024+ and its rail drives the scroll", async ({
  page,
}) => {
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?w=${width}`);
    const carousel = page.locator(".v6-carousel");
    await expect(carousel).toHaveAttribute("data-mode", "pin");
    // Five desktop windows, one per step; captures keep their own aspect
    // (never squashed) and the swipe panels stay hidden.
    const frames = carousel.locator(".v6-hpanel-body img:visible");
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
    await expect(carousel.locator(".v6-hpanel-swipe").first()).toBeHidden();

    // The rail is a working control: a tab click scrolls the page to that
    // step's rest, and the stage stays pinned in view.
    const tabs = carousel.getByRole("tablist", { name: "From one finding" });
    const tab = (name: RegExp) => tabs.getByRole("tab", { name });
    const stage = page.locator(".v6-why-stage");
    await stage.scrollIntoViewIfNeeded();
    const startY = await page.evaluate(() => window.scrollY);
    await tab(/Act/).click();
    await expect(tab(/Act/)).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(startY + 100);
    await expect(
      page.locator(".v6-hpanel.is-active .v6-hpanel-body img:visible"),
    ).toHaveAttribute("src", /step-act-list(-m)?-(light|dark)\.webp$/);
    // Once settled, ACT-2026-0020 lifts in place over the same pixels.
    const act = page.locator("#v6-panel-act");
    await expect(act).toHaveAttribute("data-lifted", "true");
    await expect(act).toHaveAttribute("data-fit", "true");
    await expect(act.locator(".v6-lift")).toHaveCSS("opacity", "1");
    const [shot, tile] = await Promise.all(
      [".v6-hpanel-body img:visible", ".v6-lift img:visible"].map((sel) =>
        act.locator(sel).evaluate((img) => {
          const r = img.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width };
        }),
      ),
    );
    // Undo the 1.04 scale around the tile centre before comparing.
    const clip = await act.locator(".v6-lift").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    expect(
      Math.abs(clip.cx + (tile!.left - clip.cx) / 1.04 - shot!.left),
    ).toBeLessThan(0.5);
    expect(
      Math.abs(clip.cy + (tile!.top - clip.cy) / 1.04 - shot!.top),
    ).toBeLessThan(0.5);
    expect(Math.abs(tile!.width / 1.04 - shot!.width)).toBeLessThan(0.5);
    const box = await stage.boundingBox();
    expect(Math.abs(box?.y ?? 99)).toBeLessThanOrEqual(1);

    // Keyboard: End and Home move between the first and last steps.
    await tab(/Act/).focus();
    await tab(/Act/).press("End");
    await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
    await expect(tab(/Learn/)).toBeFocused();
    await tab(/Learn/).press("Home");
    await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("with reduced motion the finding story is a tabbed carousel at 1024+", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#why");
  const carousel = page.locator(".v6-carousel");
  await expect(carousel).toHaveAttribute("data-mode", "tabs");
  const tabs = page.getByRole("tablist", { name: "From one finding" });
  const tab = (name: RegExp) => tabs.getByRole("tab", { name });
  await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");
  const next = page.getByRole("button", { name: "Next step" });
  await next.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await next.click();
  await expect(tab(/Act/)).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator(".v6-hpanel.is-active .v6-hpanel-body img:visible"),
  ).toHaveAttribute("src", /step-act-list(-m)?-(light|dark)\.webp$/);
  // Tabs switch in place; they never scroll the page.
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await tab(/Learn/).click();
  await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
  await tab(/Learn/).press("Home");
  await expect(tab(/Observe/)).toHaveAttribute("aria-selected", "true");
  await expect(tab(/Observe/)).toBeFocused();
  await tab(/Observe/).press("ArrowLeft");
  await expect(tab(/Learn/)).toHaveAttribute("aria-selected", "true");
});
