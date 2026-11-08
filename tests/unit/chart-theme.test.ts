import { describe, expect, it } from "vitest";

import {
  chartBarTooltipProps,
  chartPieTooltipProps,
  chartTooltipStyle,
} from "@/components/charts/chart-theme";

describe("chart-theme tooltips", () => {
  it("uses card foreground for tooltip text", () => {
    expect(chartTooltipStyle.contentStyle?.color).toBe(
      "var(--card-foreground)",
    );
    expect(chartTooltipStyle.itemStyle?.color).toBe("var(--card-foreground)");
  });

  it("uses a subtle theme-aware bar hover band", () => {
    expect(chartBarTooltipProps.cursor).toMatchObject({
      fill: expect.stringContaining("color-mix"),
    });
  });

  it("disables the pie hover band", () => {
    expect(chartPieTooltipProps.cursor).toBe(false);
  });
});
