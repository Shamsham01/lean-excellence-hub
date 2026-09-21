import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GembaActiveWalkList } from "@/components/gemba/active-walk-list";

afterEach(() => {
  cleanup();
});

describe("GembaActiveWalkList", () => {
  it("shows resume controls with human-readable definition and unit labels", () => {
    render(
      <GembaActiveWalkList
        walks={[
          {
            id: "00000000-0000-0000-0000-0000000000aa",
            definition_name_snapshot: "Exeter production walk",
            unit_name_snapshot: "Exeter · Packing",
            started_at: "2026-09-20T09:30:00.000Z",
            status: "in_progress",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("gemba-active-walk-list")).toBeVisible();
    expect(
      screen.getByTestId(
        "gemba-active-walk-title-00000000-0000-0000-0000-0000000000aa",
      ),
    ).toHaveTextContent("Exeter production walk");
    expect(screen.getByText("Exeter · Packing")).toBeVisible();
    expect(screen.getByText("Resume walk")).toBeVisible();
    expect(screen.getByText("In progress")).toBeVisible();
    expect(
      screen.queryByText("00000000-0000-0000-0000-0000000000aa"),
    ).not.toBeInTheDocument();
  });

  it("renders an empty state when no walks are in progress", () => {
    render(<GembaActiveWalkList walks={[]} />);

    expect(
      screen.getByTestId("gemba-active-walk-list-empty"),
    ).toHaveTextContent("No walks in progress in your current scope.");
  });
});
