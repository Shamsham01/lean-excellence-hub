import { describe, expect, it } from "vitest";

import { computePortfolioMetrics } from "@/lib/projects/portfolio-metrics";
import type { ProjectPortfolioItem } from "@/lib/projects/types";
import {
  phaseStatusLabel,
  projectPriorityLabel,
  projectStatusLabel,
} from "@/lib/projects/status";

describe("project status presentation", () => {
  it("formats project status labels", () => {
    expect(projectStatusLabel("on_hold")).toBe("On Hold");
    expect(projectStatusLabel("completed")).toBe("Completed");
  });

  it("formats priority and phase labels", () => {
    expect(projectPriorityLabel("critical")).toBe("Critical");
    expect(phaseStatusLabel("in_progress")).toBe("In Progress");
  });
});

describe("portfolio metrics helper", () => {
  const items: ProjectPortfolioItem[] = [
    {
      id: "1",
      project_number: "PROJ-001",
      title: "Active project",
      status: "active",
      priority: "normal",
      unit_id: "unit-1",
      methodology_version_id: null,
      planned_start_date: "2026-01-01",
      planned_end_date: "2026-02-01",
      actual_start_at: "2026-01-02T00:00:00Z",
      actual_end_at: null,
      created_by_membership_id: "member-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
    {
      id: "2",
      project_number: "PROJ-002",
      title: "On hold project",
      status: "on_hold",
      priority: "high",
      unit_id: "unit-1",
      methodology_version_id: null,
      planned_start_date: "2026-01-01",
      planned_end_date: "2026-01-15",
      actual_start_at: "2026-01-02T00:00:00Z",
      actual_end_at: null,
      created_by_membership_id: "member-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
    {
      id: "3",
      project_number: "PROJ-003",
      title: "Completed this year",
      status: "completed",
      priority: "normal",
      unit_id: "unit-1",
      methodology_version_id: null,
      planned_start_date: "2026-01-01",
      planned_end_date: "2026-03-01",
      actual_start_at: "2026-01-02T00:00:00Z",
      actual_end_at: "2026-02-01T12:00:00Z",
      created_by_membership_id: "member-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-02-01T12:00:00Z",
    },
  ];

  it("aggregates active, on hold, overdue, and completed YTD counts", () => {
    const metrics = computePortfolioMetrics(items, 4, 2);

    expect(metrics).toEqual({
      active: 1,
      onHold: 1,
      overdue: 2,
      completedYtd: 1,
      meetingTarget: 2,
      openActions: 4,
    });
  });
});
