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

async function visibleLockupImg(page: Page, theme: "light" | "dark") {
  const shell = page.locator(".leh-brand-auth-shell");
  await expect(shell).toBeVisible();
  const selector =
    theme === "dark"
      ? ".leh-brand-lockup-dark .leh-brand-lockup-img"
      : ".leh-brand-lockup-light .leh-brand-lockup-img";
  const img = shell.locator(selector);
  await expect(img).toBeVisible();
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

  expect(metrics.src).toMatch(/leh-horizontal-(light|dark)\.png/);
  expect(metrics.naturalWidth).toBeGreaterThan(0);
  expect(metrics.clientWidth).toBeGreaterThan(0);
  expect(metrics.visibleInkWidth).toBeGreaterThan(120);
  expect(metrics.fitsInLockup).toBe(true);
}

test.describe("auth login horizontal lockup", () => {
  test("login lockup is visible and uncropped in light and dark", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    for (const theme of ["light", "dark"] as const) {
      await applyTheme(page, theme);
      const img = await visibleLockupImg(page, theme);
      await assertLockupNaturalAndUncropped(img);
    }
  });
});
