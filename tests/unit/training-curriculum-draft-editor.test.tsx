import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addTrainingRequirement = vi.fn();
const updateTrainingRequirement = vi.fn();
const removeTrainingRequirement = vi.fn();
const publishTrainingCurriculumVersion = vi.fn();
const navigateTo = vi.fn();

vi.mock("@/app/(platform)/platform/training/curriculum-actions", () => ({
  addTrainingRequirement: (...args: unknown[]) =>
    addTrainingRequirement(...args),
  updateTrainingRequirement: (...args: unknown[]) =>
    updateTrainingRequirement(...args),
  removeTrainingRequirement: (...args: unknown[]) =>
    removeTrainingRequirement(...args),
  publishTrainingCurriculumVersion: (...args: unknown[]) =>
    publishTrainingCurriculumVersion(...args),
}));

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

import { CurriculumDraftEditor } from "@/components/training/curriculum-draft-editor";

const courses = [{ id: "course-1", name: "Lean Basic", validityDays: 365 }];
const jobFunctions = [{ id: "jf-1", name: "Operator" }];
const units = [{ id: "unit-1", name: "Operations" }];

describe("CurriculumDraftEditor", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    addTrainingRequirement.mockReset();
    updateTrainingRequirement.mockReset();
    removeTrainingRequirement.mockReset();
    publishTrainingCurriculumVersion.mockReset();
    navigateTo.mockReset();
  });

  it("preserves entered values when adding a requirement fails", async () => {
    addTrainingRequirement.mockResolvedValue({
      error: "Choose a course from this organisation.",
    });

    render(
      <CurriculumDraftEditor
        curriculumId="curr-1"
        versionId="ver-1"
        requirements={[]}
        courses={courses}
        jobFunctions={jobFunctions}
        units={units}
      />,
    );

    fireEvent.change(screen.getByTestId("training-requirement-course-input"), {
      target: { value: "course-1" },
    });
    fireEvent.change(
      screen.getByTestId("training-requirement-deadline-input"),
      {
        target: { value: "30" },
      },
    );
    fireEvent.submit(screen.getByTestId("training-requirement-editor-form"));

    await waitFor(() => {
      expect(
        screen.getByTestId("training-curriculum-draft-error"),
      ).toHaveTextContent("Choose a course from this organisation.");
    });
    expect(screen.getByTestId("training-requirement-course-input")).toHaveValue(
      "course-1",
    );
    expect(
      screen.getByTestId("training-requirement-deadline-input"),
    ).toHaveValue(30);
    expect(publishTrainingCurriculumVersion).not.toHaveBeenCalled();
  });

  it("saves an unsaved requirement before publishing", async () => {
    addTrainingRequirement.mockResolvedValue({ requirementId: "req-1" });
    publishTrainingCurriculumVersion.mockResolvedValue({ ok: true });

    render(
      <CurriculumDraftEditor
        curriculumId="curr-1"
        versionId="ver-1"
        requirements={[]}
        courses={courses}
        jobFunctions={jobFunctions}
        units={units}
      />,
    );

    fireEvent.change(screen.getByTestId("training-requirement-course-input"), {
      target: { value: "course-1" },
    });
    fireEvent.click(screen.getByTestId("training-curriculum-publish"));

    await waitFor(() => {
      expect(addTrainingRequirement).toHaveBeenCalled();
      expect(publishTrainingCurriculumVersion).toHaveBeenCalledWith({
        curriculumId: "curr-1",
        versionId: "ver-1",
      });
    });
  });

  it("does not publish when unsaved edits cannot be saved", async () => {
    render(
      <CurriculumDraftEditor
        curriculumId="curr-1"
        versionId="ver-1"
        requirements={[]}
        courses={courses}
        jobFunctions={jobFunctions}
        units={units}
      />,
    );

    fireEvent.change(
      screen.getByTestId("training-requirement-deadline-input"),
      {
        target: { value: "14" },
      },
    );
    fireEvent.click(screen.getByTestId("training-curriculum-publish"));

    await waitFor(() => {
      expect(
        screen.getByTestId("training-curriculum-draft-error"),
      ).toHaveTextContent("Save or clear the requirement you are editing");
    });
    expect(addTrainingRequirement).not.toHaveBeenCalled();
    expect(publishTrainingCurriculumVersion).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("training-requirement-deadline-input"),
    ).toHaveValue(14);
  });
});
