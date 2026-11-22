import { expect, type Locator, type Page } from "@playwright/test";

export async function expectHtmlTheme(page: Page, mode: "light" | "dark") {
  await expect
    .poll(async () =>
      page.locator("html").evaluate((root) => root.classList.contains("dark")),
    )
    .toBe(mode === "dark");
}

export async function hoverComparisonBarChart(page: Page) {
  const card = page.getByTestId("analytics-comparison-chart");
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText("Comparison")).toBeVisible();

  const viewportTop = await card.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  });
  expect(viewportTop, "comparison card should be in viewport").toBe(true);

  const chart = card.getByRole("img", { name: "Comparison bar chart" });
  await expect(chart).toBeVisible();

  const bar = chart.locator(".recharts-rectangle").first();
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await bar.hover({ force: true });

  const tooltipWrapper = card.locator(".recharts-tooltip-wrapper").first();
  await expect(tooltipWrapper).toBeVisible({ timeout: 10_000 });

  const tooltip = tooltipWrapper.locator(".recharts-default-tooltip");
  await expect(tooltip).toBeVisible();
  const cursor = chart.locator(".recharts-tooltip-cursor").first();
  await expect(cursor).toBeVisible({ timeout: 3_000 });

  return { card, chart, tooltip, cursor };
}

export async function readTooltipContrast(tooltip: Locator) {
  return tooltip.evaluate((node) => {
    const parseRgb = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      try {
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
      } catch {
        return null;
      }
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      return [pixel[0]!, pixel[1]!, pixel[2]!] as const;
    };

    const resolveCssColor = (
      property: "color" | "backgroundColor",
      cssValue: string,
    ) => {
      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.left = "-9999px";
      probe.style[property] = cssValue;
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe)[property];
      probe.remove();
      return resolved;
    };

    const computed = getComputedStyle(node);
    const fg = resolveCssColor("color", computed.color);

    const nodeBg = computed.backgroundColor;
    const bgRaw =
      nodeBg === "rgba(0, 0, 0, 0)" || nodeBg === "transparent"
        ? "var(--card)"
        : nodeBg;
    const bg = resolveCssColor("backgroundColor", bgRaw);

    const channelLuminance = (r: number, g: number, b: number) => {
      const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const fgRgb = parseRgb(fg);
    const bgRgb = parseRgb(bg);
    if (!fgRgb || !bgRgb) {
      return { fg, bg, ratio: null };
    }
    const fgL = channelLuminance(...fgRgb);
    const bgL = channelLuminance(...bgRgb);
    const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
    return { fg, bg, ratio };
  });
}

export async function readCursorFill(cursor: Locator) {
  return cursor.evaluate((node) => getComputedStyle(node).fill);
}

export async function readItemValueColor(tooltip: Locator) {
  return tooltip.evaluate((node) => {
    const value = node.querySelector(".recharts-tooltip-item-value");
    return value ? getComputedStyle(value).color : null;
  });
}

export function expectReadableTooltipContrast(
  ratio: number | null,
  detail?: { fg: string; bg: string },
) {
  expect(
    ratio,
    `tooltip foreground/background contrast (fg=${detail?.fg ?? "?"} bg=${detail?.bg ?? "?"})`,
  ).not.toBeNull();
  expect(ratio!).toBeGreaterThan(4.5);
}

export function expectSubtleCursorFill(fill: string) {
  const normalized = fill.toLowerCase().replace(/\s/g, "");
  expect(normalized).not.toBe("rgb(204,204,204)");
  expect(normalized).not.toBe("#ccc");
  expect(normalized).not.toBe("rgb(255,255,255)");
  expect(normalized).not.toBe("rgb(0,0,0)");
  expect(fill.length).toBeGreaterThan(0);
}
