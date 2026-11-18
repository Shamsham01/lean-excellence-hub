import { expect, test } from "@playwright/test";

/**
 * Manual PR evidence only — not part of test:e2e:smoke.
 * Captures homepage sections for marketing PR documentation.
 */

const OUT_DIR = "/opt/cursor/artifacts";

async function applyMarketingTheme(
  page: import("@playwright/test").Page,
  theme: "light" | "dark",
) {
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

test.describe("marketing landing PR346 screenshots", () => {
  test("captures close, footer, previews (desktop + mobile, light + dark)", async ({
    page,
  }) => {
    const cases: Array<{
      id: string;
      theme: "light" | "dark";
      width: number;
      height: number;
    }> = [
      { id: "close-desktop", theme: "light", width: 1440, height: 900 },
      { id: "close-desktop-dark", theme: "dark", width: 1440, height: 900 },
      { id: "close-mobile", theme: "light", width: 390, height: 844 },
      { id: "close-mobile-dark", theme: "dark", width: 390, height: 844 },
      { id: "footer-desktop", theme: "light", width: 1440, height: 900 },
      { id: "footer-desktop-dark", theme: "dark", width: 1440, height: 900 },
      { id: "footer-mobile", theme: "light", width: 390, height: 844 },
      { id: "footer-mobile-dark", theme: "dark", width: 390, height: 844 },
      { id: "previews-desktop", theme: "light", width: 1440, height: 900 },
      { id: "previews-desktop-dark", theme: "dark", width: 1440, height: 900 },
      { id: "previews-mobile", theme: "light", width: 390, height: 844 },
      { id: "previews-mobile-dark", theme: "dark", width: 390, height: 844 },
    ];

    for (const { id, theme, width, height } of cases) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await applyMarketingTheme(page, theme);

      if (id.startsWith("close")) {
        const target = page.locator("#close");
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeVisible();
        await page.screenshot({
          path: `${OUT_DIR}/marketing-pr346-${id}.png`,
          clip: await target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: Math.min(r.height, window.innerHeight),
            };
          }),
        });
      } else if (id.startsWith("footer")) {
        const target = page.getByRole("contentinfo");
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeVisible();
        await page.screenshot({
          path: `${OUT_DIR}/marketing-pr346-${id}.png`,
          clip: await target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
            };
          }),
        });
      } else {
        const target = page.locator("#finding-record");
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeVisible();
        await page.screenshot({
          path: `${OUT_DIR}/marketing-pr346-${id}.png`,
          clip: await target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: Math.min(r.height + 48, window.innerHeight),
            };
          }),
        });
      }
    }
  });
});
