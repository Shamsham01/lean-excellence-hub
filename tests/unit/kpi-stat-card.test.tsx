import { render, screen } from "@testing-library/react";
import { ClipboardList } from "lucide-react";
import { describe, expect, it } from "vitest";

import { KpiStatCard } from "@/components/platform/kpi-stat-card";
import { KpiStatGrid } from "@/components/platform/kpi-stat-grid";

describe("KpiStatCard", () => {
  it("applies destructive tone for lower-is-better KPIs with a positive value", () => {
    render(
      <KpiStatCard
        label="Overdue"
        value={3}
        icon={ClipboardList}
        polarity="lower-is-better"
        testId="kpi-overdue"
      />,
    );
    const value = screen.getByTestId("kpi-overdue-value");
    expect(value.className).toContain("text-destructive-emphasis");
    expect(value.className).not.toContain("text-success");
    expect(screen.getByText("Overdue", { selector: "p" })).toBeTruthy();
  });

  it("applies emerald tone for higher-is-better KPIs with a positive value", () => {
    render(
      <KpiStatCard
        label="Completed"
        value={2}
        icon={ClipboardList}
        polarity="higher-is-better"
        testId="kpi-completed"
      />,
    );
    const value = screen.getByTestId("kpi-completed-value");
    expect(value.className).toContain("text-success-text");
  });

  it("uses responsive columns when tileCount is set", () => {
    const { container } = render(
      <KpiStatGrid tileCount={4}>
        <KpiStatCard label="A" value={1} icon={ClipboardList} />
        <KpiStatCard label="B" value={2} icon={ClipboardList} />
      </KpiStatGrid>,
    );
    const grid = container.querySelector('[data-testid="kpi-stat-grid"]');
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
    expect(grid?.getAttribute("style")).toContain("--kpi-tile-count");
  });
});
