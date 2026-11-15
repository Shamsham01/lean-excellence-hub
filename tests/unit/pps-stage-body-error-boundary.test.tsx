import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

function BrokenStageBody(): never {
  throw new Error("Fishbone panel blew up");
}

describe("PpsStageBodyErrorBoundary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows inline retry UI and logs a sanitised boundary message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { PpsStageBodyErrorBoundary } =
      await import("@/components/problem-solving/pps-stage-body-error-boundary");

    render(
      <PpsStageBodyErrorBoundary stageKey="ROOT_CAUSE_ANALYSIS">
        <BrokenStageBody />
      </PpsStageBodyErrorBoundary>,
    );

    expect(screen.getByTestId("pps-stage-body-error")).toHaveTextContent(
      "This section couldn't load.",
    );
    expect(
      screen.getByTestId("pps-stage-body-error-retry"),
    ).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
    const boundaryCall = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes("[platform-boundary]"),
    );
    expect(boundaryCall).toBeDefined();
    const payload = JSON.parse(String(boundaryCall![1]));
    expect(payload).toMatchObject({
      operation: "pps_stage_body_render",
      route: "ROOT_CAUSE_ANALYSIS",
      supabaseMessage: "Fishbone panel blew up",
    });
  });
});
