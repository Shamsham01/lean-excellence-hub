import { describe, expect, it } from "vitest";

import {
  chartBarTooltipProps,
  chartMultiSeriesTooltipProps,
  chartPieTooltipProps,
  chartTooltipStyle,
} from "@/components/charts/chart-theme";

describe("chart-theme tooltips", () => {
  it("uses card foreground for tooltip chrome and label only", () => {
    expect(chartTooltipStyle.wrapperClassName).toBe("leh-recharts-tooltip");
    expect(chartTooltipStyle.contentStyle?.color).toBe(
      "var(--card-foreground)",
    );
    expect(chartTooltipStyle).not.toHaveProperty("itemStyle");
    expect(chartBarTooltipProps.itemStyle?.color).toBe(
      "var(--card-foreground)",
    );
  });

  it("uses a subtle theme-aware bar hover band", () => {
    expect(chartBarTooltipProps.cursor).toMatchObject({
      fill: expect.stringContaining("color-mix"),
    });
  });

  it("omits itemStyle on multi-series tooltips", () => {
    expect(chartMultiSeriesTooltipProps).not.toHaveProperty("itemStyle");
    expect(chartMultiSeriesTooltipProps.wrapperClassName).toBe(
      "leh-recharts-tooltip",
    );
  });

  it("disables the pie hover band", () => {
    expect(chartPieTooltipProps.cursor).toBe(false);
  });
});
