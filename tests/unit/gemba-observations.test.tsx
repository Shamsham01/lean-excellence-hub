import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGembaObservation,
  deleteGembaObservation,
  deleteGembaObservations,
  updateGembaObservation,
} from "@/app/(platform)/platform/gemba/actions";
import { GembaObservationPanel } from "@/components/gemba/observation-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(platform)/platform/gemba/actions", () => ({
  createGembaObservation: vi.fn(),
  updateGembaObservation: vi.fn(),
  deleteGembaObservation: vi.fn(),
  deleteGembaObservations: vi.fn(),
  initiateGembaEvidenceUpload: vi.fn(),
  confirmGembaEvidenceUpload: vi.fn(),
  linkGembaEvidence: vi.fn(),
}));

const createObservation = vi.mocked(createGembaObservation);
const updateObservation = vi.mocked(updateGembaObservation);
const deleteObservation = vi.mocked(deleteGembaObservation);
const bulkDeleteObservations = vi.mocked(deleteGembaObservations);

const EXISTING = {
  id: "obs-existing",
  observation_text: "Observation: positive practice",
  observation_type: "positive_practice",
};

function renderPanel({
  observations = [],
  canEdit = true,
}: {
  observations?: Array<{
    id: string;
    observation_text: string;
    observation_type: string;
  }>;
  canEdit?: boolean;
} = {}) {
  return render(
    <GembaObservationPanel
      walkId="walk-1"
      observations={observations}
      evidence={[]}
      canEdit={canEdit}
    />,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  createObservation.mockReset();
  createObservation.mockResolvedValue({ observationId: "obs-created" });
  updateObservation.mockReset();
  updateObservation.mockResolvedValue({ ok: true });
  deleteObservation.mockReset();
  deleteObservation.mockResolvedValue({ ok: true });
  bulkDeleteObservations.mockReset();
  bulkDeleteObservations.mockResolvedValue({ ok: true });
});

describe("Gemba observation capture", () => {
  it("does not create a database record when an observation type is selected", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(
      screen.getByTestId("gemba-observation-type-improvement_opportunity"),
    );

    expect(screen.getByTestId("gemba-observation-editor")).toBeVisible();
    expect(createObservation).not.toHaveBeenCalled();
  });

  it("does not create a database record when capture is cancelled", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(screen.getByTestId("gemba-observation-type-issue"));
    fireEvent.change(screen.getByTestId("gemba-observation-text"), {
      target: { value: "Temporary draft" },
    });
    fireEvent.click(screen.getByTestId("gemba-observation-cancel"));

    expect(createObservation).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("gemba-observation-editor"),
    ).not.toBeInTheDocument();
  });

  it("keeps typed observation text visible before save", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(
      screen.getByTestId("gemba-observation-type-positive_practice"),
    );
    fireEvent.change(screen.getByTestId("gemba-observation-text"), {
      target: { value: "Labels are current on packing lane 2." },
    });

    expect(screen.getByTestId("gemba-observation-text")).toHaveValue(
      "Labels are current on packing lane 2.",
    );
    expect(createObservation).not.toHaveBeenCalled();
  });

  it("does not allow saving empty observation text", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(screen.getByTestId("gemba-observation-type-issue"));

    expect(screen.getByTestId("gemba-observation-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("gemba-observation-save"));
    expect(createObservation).not.toHaveBeenCalled();
  });

  it("creates exactly one observation on save", async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(
      screen.getByTestId("gemba-observation-type-improvement_opportunity"),
    );
    fireEvent.change(screen.getByTestId("gemba-observation-text"), {
      target: { value: "Tape is peeling from the standard work sheet." },
    });
    fireEvent.click(screen.getByTestId("gemba-observation-save"));

    await waitFor(() => {
      expect(createObservation).toHaveBeenCalledTimes(1);
    });
    expect(createObservation).toHaveBeenCalledWith(
      "walk-1",
      "Tape is peeling from the standard work sheet.",
      "improvement_opportunity",
      expect.any(String),
    );
    await waitFor(() => {
      expect(
        screen.getByText("Tape is peeling from the standard work sheet."),
      ).toBeVisible();
    });
  });

  it("does not create duplicates from a repeated Save click", async () => {
    let resolveCreate: (value: { observationId: string }) => void = () =>
      undefined;
    createObservation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(screen.getByTestId("gemba-observation-type-issue"));
    fireEvent.change(screen.getByTestId("gemba-observation-text"), {
      target: { value: "Guard missing from the infeed." },
    });
    fireEvent.click(screen.getByTestId("gemba-observation-save"));
    fireEvent.click(screen.getByTestId("gemba-observation-save"));
    fireEvent.click(screen.getByTestId("gemba-observation-save"));

    expect(createObservation).toHaveBeenCalledTimes(1);
    resolveCreate({ observationId: "obs-created" });
    await waitFor(() => {
      expect(screen.getByText("Guard missing from the infeed.")).toBeVisible();
    });
    expect(createObservation).toHaveBeenCalledTimes(1);
  });

  it("reports a visible creation failure and keeps the draft", async () => {
    createObservation.mockResolvedValue({ error: "RPC failed" });
    renderPanel();
    fireEvent.click(screen.getByTestId("gemba-capture-observation"));
    fireEvent.click(screen.getByTestId("gemba-observation-type-issue"));
    fireEvent.change(screen.getByTestId("gemba-observation-text"), {
      target: { value: "Oil leak under the mixer." },
    });
    fireEvent.click(screen.getByTestId("gemba-observation-save"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("RPC failed");
    });
    expect(screen.getByTestId("gemba-observation-text")).toHaveValue(
      "Oil leak under the mixer.",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("renders existing placeholder observations in the list", () => {
    renderPanel({ observations: [EXISTING] });
    expect(screen.getByText("Positive practice")).toBeVisible();
    expect(screen.getByText("Observation: positive practice")).toBeVisible();
  });

  it("edits an existing in-progress observation", async () => {
    renderPanel({ observations: [EXISTING] });
    fireEvent.click(screen.getByTestId("gemba-observation-edit-obs-existing"));
    fireEvent.change(screen.getByTestId("gemba-observation-edit-text"), {
      target: { value: "Visual standard is current after the refresh." },
    });
    fireEvent.click(screen.getByTestId("gemba-observation-edit-save"));

    await waitFor(() => {
      expect(updateObservation).toHaveBeenCalledWith(
        "walk-1",
        "obs-existing",
        "Visual standard is current after the refresh.",
        "positive_practice",
      );
    });
    expect(
      screen.getByText("Visual standard is current after the refresh."),
    ).toBeVisible();
  });

  it("keeps an edit recoverable after a failed save", async () => {
    updateObservation.mockResolvedValue({ error: "RPC failed" });
    renderPanel({ observations: [EXISTING] });
    fireEvent.click(screen.getByTestId("gemba-observation-edit-obs-existing"));
    fireEvent.change(screen.getByTestId("gemba-observation-edit-text"), {
      target: { value: "Corrected observation text." },
    });
    fireEvent.click(screen.getByTestId("gemba-observation-edit-save"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("RPC failed");
    });
    expect(screen.getByTestId("gemba-observation-edit-text")).toHaveValue(
      "Corrected observation text.",
    );

    updateObservation.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByTestId("gemba-observation-edit-save"));
    await waitFor(() => {
      expect(screen.getByText("Corrected observation text.")).toBeVisible();
    });
  });

  it("deletes an observation after confirmation", async () => {
    renderPanel({ observations: [EXISTING] });
    fireEvent.click(
      screen.getByTestId("gemba-observation-delete-obs-existing"),
    );
    expect(screen.getByText("Delete this observation?")).toBeVisible();
    fireEvent.click(screen.getByTestId("gemba-confirm-delete"));

    await waitFor(() => {
      expect(deleteObservation).toHaveBeenCalledWith("walk-1", "obs-existing");
    });
    expect(
      screen.queryByText("Observation: positive practice"),
    ).not.toBeInTheDocument();
  });

  it("keeps a delete failure visible", async () => {
    deleteObservation.mockResolvedValue({ error: "RPC failed" });
    renderPanel({ observations: [EXISTING] });
    fireEvent.click(
      screen.getByTestId("gemba-observation-delete-obs-existing"),
    );
    fireEvent.click(screen.getByTestId("gemba-confirm-delete"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("RPC failed");
    });
    expect(screen.getByText("Observation: positive practice")).toBeVisible();
  });

  it("bulk deletes selected observations after confirmation", async () => {
    renderPanel({
      observations: [
        EXISTING,
        {
          id: "obs-two",
          observation_text: "Observation: issue",
          observation_type: "issue",
        },
      ],
    });

    fireEvent.click(
      screen.getByTestId("gemba-observation-select-obs-existing"),
    );
    fireEvent.click(screen.getByTestId("gemba-observation-select-obs-two"));
    fireEvent.click(screen.getByTestId("gemba-delete-selected"));
    expect(screen.getByText("Delete selected observations?")).toBeVisible();
    fireEvent.click(screen.getByTestId("gemba-confirm-delete"));

    await waitFor(() => {
      expect(bulkDeleteObservations).toHaveBeenCalledWith("walk-1", [
        "obs-existing",
        "obs-two",
      ]);
    });
    expect(screen.getByText("No observations captured yet.")).toBeVisible();
  });

  it("hides edit and delete controls when the walk is not editable", () => {
    renderPanel({ observations: [EXISTING], canEdit: false });
    expect(
      screen.queryByTestId("gemba-observation-edit-obs-existing"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("gemba-observation-delete-obs-existing"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Positive practice")).toBeVisible();
  });
});
