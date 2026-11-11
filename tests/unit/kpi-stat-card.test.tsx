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
    expect(value.className).toContain("text-destructive");
    expect(screen.getByText("Overdue", { selector: "p" })).toBeTruthy();
  });

  it("stretches tiles across the grid row", () => {
    const { container } = render(
      <KpiStatGrid tileCount={4}>
        <KpiStatCard label="A" value={1} icon={ClipboardList} />
        <KpiStatCard label="B" value={2} icon={ClipboardList} />
      </KpiStatGrid>,
    );
    const grid = container.querySelector('[data-testid="kpi-stat-grid"]');
    expect(grid?.getAttribute("style")).toContain("repeat(4");
  });
});
