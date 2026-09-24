import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createTrainingCurriculumDraft = vi.fn();
const navigateTo = vi.fn();

vi.mock("@/app/(platform)/platform/training/curriculum-actions", () => ({
  createTrainingCurriculumDraft: (...args: unknown[]) =>
    createTrainingCurriculumDraft(...args),
}));

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

import { CurriculumCreateForm } from "@/components/training/curriculum-create-form";

describe("CurriculumCreateForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    createTrainingCurriculumDraft.mockReset();
    navigateTo.mockReset();
  });

  it("previews a generated code and blocks duplicate custom codes", () => {
    render(<CurriculumCreateForm existingCodes={["apex-curriculum"]} />);

    fireEvent.change(screen.getByTestId("training-curriculum-name-input"), {
      target: { value: "Core Operations" },
    });
    expect(
      screen.getByTestId("training-curriculum-auto-code-preview"),
    ).toHaveTextContent("core-operations");

    fireEvent.click(
      screen.getByTestId("training-curriculum-custom-code-toggle"),
    );
    fireEvent.change(
      screen.getByTestId("training-curriculum-custom-code-input"),
      {
        target: { value: "apex-curriculum" },
      },
    );
    fireEvent.submit(screen.getByTestId("training-curriculum-create-form"));

    expect(
      screen.getByTestId("training-curriculum-create-error"),
    ).toHaveTextContent("A curriculum with this code already exists");
    expect(createTrainingCurriculumDraft).not.toHaveBeenCalled();
  });

  it("prevents duplicate submits and navigates to the new draft", async () => {
    let resolveCreate: ((value: { curriculumId: string }) => void) | undefined;
    createTrainingCurriculumDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<CurriculumCreateForm existingCodes={[]} />);

    fireEvent.change(screen.getByTestId("training-curriculum-name-input"), {
      target: { value: "Core Operations" },
    });
    fireEvent.submit(screen.getByTestId("training-curriculum-create-form"));
    fireEvent.submit(screen.getByTestId("training-curriculum-create-form"));

    expect(createTrainingCurriculumDraft).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("training-curriculum-create-submit"),
    ).toBeDisabled();

    resolveCreate?.({ curriculumId: "curr-1" });

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        "/platform/training/curriculum/curr-1",
      );
    });
  });

  it("preserves entered values when creation fails", async () => {
    createTrainingCurriculumDraft.mockResolvedValue({
      error: "A curriculum with this code already exists.",
    });

    render(<CurriculumCreateForm existingCodes={[]} />);

    fireEvent.change(screen.getByTestId("training-curriculum-name-input"), {
      target: { value: "Core Operations" },
    });
    fireEvent.submit(screen.getByTestId("training-curriculum-create-form"));

    await waitFor(() => {
      expect(
        screen.getByTestId("training-curriculum-create-error"),
      ).toHaveTextContent("already exists");
    });
    expect(screen.getByTestId("training-curriculum-name-input")).toHaveValue(
      "Core Operations",
    );
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
