/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScheduleActivityPicker } from "@/components/schedule/schedule-activity-picker";
import type { SchedulableActivityOption } from "@/lib/schedule/schedulable-activities";

const sampleActivity: SchedulableActivityOption = {
  kind: "five_s",
  id: "std-1",
  displayName: "Production 5S",
  applicabilitySummary: "Packing",
};

describe("ScheduleActivityPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the activity list", () => {
    render(
      <ScheduleActivityPicker
        activities={[sampleActivity]}
        returnTo="/platform/schedule"
      />,
    );
    expect(screen.getByTestId("schedule-activity-picker")).toBeTruthy();
    expect(screen.getByText("Production 5S")).toBeTruthy();
    expect(screen.getByTestId("schedule-activity-select-std-1")).toBeTruthy();
  });

  it("renders the publish-first empty state", () => {
    render(
      <ScheduleActivityPicker activities={[]} returnTo="/platform/schedule" />,
    );
    expect(screen.getByTestId("schedule-activity-picker-empty")).toBeTruthy();
    expect(screen.getByText("Publish an activity first")).toBeTruthy();
    expect(screen.getByTestId("schedule-picker-5s-setup-link")).toBeTruthy();
    expect(screen.getByTestId("schedule-picker-gemba-setup-link")).toBeTruthy();
  });

  it("renders choose-site state instead of publish empty when requiresSiteChoice", () => {
    render(
      <ScheduleActivityPicker
        activities={[]}
        returnTo="/platform/schedule"
        requiresSiteChoice
      />,
    );
    expect(
      screen.getByTestId("schedule-activity-picker-choose-site"),
    ).toBeTruthy();
    expect(
      screen.getByText("Choose a site to see schedulable activities"),
    ).toBeTruthy();
    expect(screen.queryByTestId("schedule-activity-picker-empty")).toBeNull();
    expect(screen.queryByTestId("schedule-picker-5s-setup-link")).toBeNull();
  });

  it("renders load error state", () => {
    render(
      <ScheduleActivityPicker
        activities={[]}
        returnTo="/platform/schedule"
        loadError="Could not load activities."
      />,
    );
    expect(screen.getByTestId("schedule-activity-picker-error")).toBeTruthy();
    expect(screen.getByText("Could not load activities.")).toBeTruthy();
  });
});
