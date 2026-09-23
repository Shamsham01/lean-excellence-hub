import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useAuthoringStep } from "@/components/authoring/use-authoring-step";

const STEPS = ["details", "levels", "publish"] as const;

function StepHarness({
  initialStep = "details",
}: {
  initialStep?: (typeof STEPS)[number];
}) {
  const [step, setStep] = useAuthoringStep(STEPS, "details", initialStep);

  return (
    <div>
      <p data-testid="active-step">{step}</p>
      <button type="button" onClick={() => setStep("levels")}>
        Go to levels
      </button>
    </div>
  );
}

describe("useAuthoringStep", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/platform/maturity/models/model-1");
  });

  afterEach(() => {
    cleanup();
  });

  it("uses the server-provided initial step instead of reading window on first render", () => {
    window.history.replaceState(
      {},
      "",
      "/platform/maturity/models/model-1?step=levels",
    );

    render(<StepHarness initialStep="details" />);

    expect(screen.getByTestId("active-step")).toHaveTextContent("details");
  });

  it("matches a server-derived non-default initial step for hydration-safe reloads", () => {
    window.history.replaceState(
      {},
      "",
      "/platform/maturity/models/model-1?step=levels",
    );

    render(<StepHarness initialStep="levels" />);

    expect(screen.getByTestId("active-step")).toHaveTextContent("levels");
  });

  it("writes step changes to the URL", () => {
    render(<StepHarness initialStep="details" />);

    fireEvent.click(screen.getByRole("button", { name: "Go to levels" }));

    expect(window.location.search).toBe("?step=levels");
    expect(screen.getByTestId("active-step")).toHaveTextContent("levels");
  });
});
