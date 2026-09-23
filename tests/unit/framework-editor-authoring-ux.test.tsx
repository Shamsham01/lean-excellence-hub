import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentProps } from "react";

import { updateMaturityModelMetadata } from "@/app/(platform)/platform/maturity/actions";
import { FrameworkEditor } from "@/components/maturity/framework-editor";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/app/(platform)/platform/maturity/actions", () => ({
  addMaturityCriterion: vi.fn(),
  addMaturityLevel: vi.fn(),
  addMaturityPillar: vi.fn(),
  addMaturityQuestion: vi.fn(),
  linkCriterionQuestion: vi.fn(),
  publishMaturityModel: vi.fn(),
  setFrameworkAssessmentScopes: vi.fn(),
  updateMaturityCriterion: vi.fn(),
  updateMaturityLevel: vi.fn(),
  updateMaturityModelMetadata: vi.fn(),
  updateMaturityPillar: vi.fn(),
  updateMaturityQuestion: vi.fn(),
}));

const updateMetadata = vi.mocked(updateMaturityModelMetadata);

function renderEditor(
  props: Partial<ComponentProps<typeof FrameworkEditor>> = {},
) {
  return render(
    <FrameworkEditor
      modelId="model-1"
      modelName="Demo framework"
      modelDescription="Initial description"
      versionId="version-1"
      versionNumber={1}
      assessmentScopes={["site"]}
      levels={[]}
      pillars={[]}
      criteria={[]}
      questions={[]}
      {...props}
    />,
  );
}

describe("FrameworkEditor authoring UX", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateMetadata.mockResolvedValue({ ok: true });
    window.history.replaceState({}, "", "/platform/maturity/models/model-1");
  });

  afterEach(() => {
    cleanup();
  });

  it("persists the active step in the URL and restores it on reload", () => {
    renderEditor();

    fireEvent.click(screen.getByTestId("framework-step-levels"));

    expect(window.location.search).toBe("?step=levels");
    expect(screen.getByLabelText("Level name")).toBeInTheDocument();

    window.history.replaceState(
      {},
      "",
      "/platform/maturity/models/model-1?step=levels",
    );

    cleanup();
    renderEditor({ initialAuthoringStep: "levels" });

    expect(screen.getByLabelText("Level name")).toBeInTheDocument();
    expect(
      screen.queryByTestId("framework-details-form"),
    ).not.toBeInTheDocument();
  });

  it("renders a server-derived initial step without reading window on mount", () => {
    window.history.replaceState(
      {},
      "",
      "/platform/maturity/models/model-1?step=levels",
    );

    renderEditor({ initialAuthoringStep: "details" });

    expect(screen.getByTestId("framework-details-form")).toBeInTheDocument();
    expect(screen.queryByLabelText("Level name")).not.toBeInTheDocument();
  });

  it("shows explicit save confirmation after a successful save", async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Updated framework" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save framework details" }),
    );

    await waitFor(() => {
      expect(updateMetadata).toHaveBeenCalled();
    });

    expect(refresh).toHaveBeenCalled();
    expect(screen.getByTestId("authoring-save-feedback")).toHaveTextContent(
      "Saved.",
    );
  });
});
