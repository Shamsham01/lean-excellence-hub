import { expect, test } from "@playwright/test";

const WIDTHS = [390, 768, 1280, 1440] as const;
const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  test(`landing holds one page background and no overflow (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem("theme", value);
    }, theme);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));

      const report = await page.evaluate(() => {
        const doc = document.documentElement;
        const sections = [...document.querySelectorAll("main section")].map(
          (section) => getComputedStyle(section).backgroundColor,
        );
        const visible = [...document.querySelectorAll("main picture img")]
          .filter((img) => (img as HTMLElement).offsetParent !== null)
          .map((img) => img.getAttribute("src") ?? "");
        return {
          overflow: doc.scrollWidth - doc.clientWidth,
          sections,
          visible,
          figcaptions: document.querySelectorAll("main figcaption").length,
          text: document.body.innerText,
        };
      });

      expect(report.overflow, `overflow at ${width}`).toBeLessThanOrEqual(1);
      for (const bg of report.sections) {
        expect(bg, `section background at ${width}`).toBe("rgba(0, 0, 0, 0)");
      }
      expect(report.figcaptions).toBe(0);
      expect(report.text).not.toMatch(/harbourfield|£|\$|per month/i);
      expect(report.visible.length).toBeGreaterThan(0);
      const other = theme === "light" ? "dark" : "light";
      for (const src of report.visible) {
        expect(src, `wrong-theme capture at ${width}`).not.toMatch(
          new RegExp(`-${other}\\.webp$`),
        );
      }
    }
  });
}

test("the maturity radar draws the real pillar values", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#maturity");
  const radar = page.getByRole("img", { name: "Pillar maturity radar" });
  await expect(radar).toBeVisible();
  await expect(page.locator("[data-radar]")).toHaveClass(/is-drawn/);
  await expect(page.getByLabel("Overall maturity 2.7 out of 5")).toBeVisible();
});

test("the header gains its hairline after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const banner = page.getByRole("banner");
  await expect(banner).not.toHaveAttribute("data-scrolled", "true");
  await page.mouse.wheel(0, 400);
  await expect(banner).toHaveAttribute("data-scrolled", "true");
});
