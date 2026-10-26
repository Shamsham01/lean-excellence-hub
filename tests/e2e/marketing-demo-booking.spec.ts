import { expect, test } from "@playwright/test";

const E2E_BOOKING_URL =
  "https://cal.com/fixture-organiser/product-demonstration";

const MOCK_CAL_EMBED = `
(() => {
  const stub = window.Cal;
  const namespaces = {};

  function mountInline(options) {
    const element = options && options.elementOrSelector;
    if (!element || typeof element.appendChild !== "function") return;
    const next = (window.__lehMockEmbedGeneration || 0) + 1;
    window.__lehMockEmbedGeneration = next;
    const frame = document.createElement("iframe");
    frame.setAttribute("data-leh-mock-embed", String(next));
    frame.title =
      (options.config &&
        options.config.iframeAttrs &&
        options.config.iframeAttrs.title) ||
      "Cal.com booking calendar";
    element.appendChild(frame);
  }

  function handle(args) {
    const action = args[0];
    if (action === "init" && typeof args[1] === "string") {
      if (!namespaces[args[1]]) {
        const api = (...nsArgs) => handle(nsArgs);
        api.q = [];
        namespaces[args[1]] = api;
      }
      return;
    }
    if (action === "inline") {
      mountInline(args[1]);
      return;
    }
    if (action === "on") {
      const spec = args[1] || {};
      if (spec.action === "linkReady" && typeof spec.callback === "function") {
        spec.callback();
      }
    }
  }

  function cal(...args) {
    handle(args);
  }

  cal.ns = namespaces;
  cal.q = [];
  cal.loaded = true;

  const pending = [];
  if (stub && Array.isArray(stub.q)) pending.push(...stub.q);
  if (stub && stub.ns) {
    for (const api of Object.values(stub.ns)) {
      if (api && Array.isArray(api.q)) pending.push(...api.q);
    }
  }

  window.Cal = cal;
  for (const args of pending) handle(args);
})();
`;

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

test("demo page links to LEH and Cal.com privacy information", async ({ page }) => {
  await page.goto("/demo");

  const organiser = page.getByRole("link", {
    name: "Lean Excellence Hub demo booking privacy notice",
  });
  await expect(organiser).toHaveAttribute(
    "href",
    "/privacy/demo-bookings",
  );
  await expect(
    page.getByRole("link", { name: "Cal.com privacy notice" }),
  ).toHaveAttribute("href", "https://cal.com/privacy");

  await organiser.click();
  await expect(page).toHaveURL(/\/privacy\/demo-bookings$/);
  await expect(
    page.getByRole("heading", { name: "Demo booking privacy notice" }),
  ).toBeVisible();
  await expect(page.getByText(/sole-trader business/i)).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "admin.lean.excellence.hub@gmail.com",
    }).first(),
  ).toHaveAttribute(
    "href",
    "mailto:admin.lean.excellence.hub@gmail.com",
  );
  await expect(
    page.getByText(/Draft — not approved for publication/i),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("link", { name: "Demo booking privacy", exact: true }),
  ).toHaveAttribute("href", "/privacy/demo-bookings");
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

test("client navigation remounts the mocked calendar", async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "x-leh-e2e-demo-booking-url": E2E_BOOKING_URL,
  });
  await page.route("**/embed/embed.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: MOCK_CAL_EMBED,
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const book = page
    .getByRole("banner")
    .locator(".marketing-header-bar")
    .getByRole("link", { name: "Book a live demo" });
  await book.click();
  await expect(page).toHaveURL(/\/demo$/);
  const first = page.locator("[data-leh-mock-embed]");
  await expect(first).toHaveCount(1);
  const firstGeneration = await first.getAttribute("data-leh-mock-embed");

  await page.getByRole("link", { name: "Lean Excellence Hub home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("[data-leh-mock-embed]")).toHaveCount(0);

  await book.click();
  await expect(page).toHaveURL(/\/demo$/);
  const second = page.locator("[data-leh-mock-embed]");
  await expect(second).toHaveCount(1);
  await expect(second).not.toHaveAttribute(
    "data-leh-mock-embed",
    firstGeneration ?? "",
  );
  await expect(
    page.getByRole("link", { name: "Open the booking page" }),
  ).toHaveAttribute("href", E2E_BOOKING_URL);
  await expect(
    page.getByText(/Loading the calendar from Cal\.com/),
  ).toHaveCount(0);
});

test("a blocked embed script keeps the direct booking link", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-leh-e2e-demo-booking-url": E2E_BOOKING_URL,
  });
  await page.route("**/embed/embed.js", (route) => route.abort("failed"));
  await page.goto("/demo");
  await expect(
    page.getByText(/The Cal\.com calendar did not load/),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("link", { name: "Open the booking page" }),
  ).toHaveAttribute("href", E2E_BOOKING_URL);
  await expect(
    page.getByText(/Loading the calendar from Cal\.com/),
  ).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
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
