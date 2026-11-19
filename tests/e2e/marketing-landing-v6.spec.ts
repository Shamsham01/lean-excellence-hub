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

test("windows never crop and match across themes (ATELIER r1 B2/B3)", async ({
  page,
}) => {
  const measure = async (theme: "light" | "dark") => {
    await page.addInitScript((value) => {
      window.localStorage.setItem("theme", value);
    }, theme);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    const heights: number[] = [];
    const tabs = page.getByRole("tab");
    for (let i = 0; i < (await tabs.count()); i += 1) {
      await tabs.nth(i).click();
      await page.waitForTimeout(400);
      heights.push(
        await page
          .locator(".v6-carousel-frames")
          .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
      );
    }
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll(".v6-bento-tile")].flatMap((tile) => {
        const t = tile.getBoundingClientRect();
        return [...tile.querySelectorAll(".v6-tile-window")].map((w) => {
          const r = w.getBoundingClientRect();
          return { left: r.left - t.left, right: t.right - r.right };
        });
      }),
    );
    return { heights, tiles };
  };

  const light = await measure("light");
  const dark = await measure("dark");
  expect(dark.heights).toEqual(light.heights);
  for (const { left, right } of [...light.tiles, ...dark.tiles]) {
    expect(left).toBeGreaterThanOrEqual(24);
    expect(right).toBeGreaterThanOrEqual(24);
  }
});
