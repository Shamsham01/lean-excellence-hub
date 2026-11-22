import { expect, test, type Locator, type Page } from "@playwright/test";

async function applyTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await page.evaluate((t) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(t);
    root.style.colorScheme = t === "dark" ? "dark" : "light";
  }, theme);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.className))
    .toMatch(theme === "dark" ? /\bdark\b/ : /\blight\b/);
}

async function visibleAuthLockupImg(page: Page) {
  const panel = page.getByTestId("auth-brand-panel");
  await expect(panel).toBeVisible();
  const shell = panel.locator(".leh-brand-auth-shell");
  const img = shell.locator(".leh-brand-lockup-dark .leh-brand-lockup-img");
  await expect(img).toBeVisible();
  await expect(
    shell.locator(".leh-brand-lockup-light .leh-brand-lockup-img"),
  ).toBeHidden();
  return img;
}

async function assertLockupNaturalAndUncropped(img: Locator) {
  const metrics = await img.evaluate((el: HTMLImageElement) => {
    const lockup = el.closest(".leh-brand-lockup") as HTMLElement | null;
    const lockupRect = lockup?.getBoundingClientRect();
    const imgRect = el.getBoundingClientRect();
    return {
      src: el.currentSrc || el.src,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      visibleInkWidth: Math.min(
        imgRect.width,
        lockupRect?.width ?? imgRect.width,
      ),
      fitsInLockup:
        lockupRect != null &&
        imgRect.left >= lockupRect.left - 0.5 &&
        imgRect.top >= lockupRect.top - 0.5 &&
        imgRect.right <= lockupRect.right + 0.5 &&
        imgRect.bottom <= lockupRect.bottom + 0.5,
    };
  });

  expect(metrics.src).toMatch(/leh-horizontal-dark\.png/);
  expect(metrics.naturalWidth).toBeGreaterThan(0);
  expect(metrics.clientWidth).toBeGreaterThan(0);
  expect(metrics.visibleInkWidth).toBeGreaterThan(200);
  expect(metrics.fitsInLockup).toBe(true);
}

test.describe("auth login horizontal lockup", () => {
  test("login lockup uses the dark master in light and dark themes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    for (const theme of ["light", "dark"] as const) {
      await applyTheme(page, theme);
      const img = await visibleAuthLockupImg(page);
      await assertLockupNaturalAndUncropped(img);
    }

    const lockupWidth = await page
      .getByTestId("auth-brand-panel-lockup-slot")
      .evaluate((node) => node.getBoundingClientRect().width);
    expect(lockupWidth).toBeGreaterThanOrEqual(300);
    expect(lockupWidth).toBeLessThanOrEqual(430);
  });

  test("login lockup fits a 390px mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto("/login");
    const img = await visibleAuthLockupImg(page);
    const bounds = await img.evaluate((el: HTMLImageElement) => {
      const rect = el.getBoundingClientRect();
      return { right: rect.right, width: rect.width };
    });
    expect(bounds.right).toBeLessThanOrEqual(390);
    expect(bounds.width).toBeGreaterThan(160);
  });
});
