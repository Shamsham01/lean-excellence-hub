import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateTrainingCourseDraftVersion = vi.fn();
const publishTrainingCourseVersion = vi.fn();
const navigateTo = vi.fn();

vi.mock("@/app/(platform)/platform/training/actions", () => ({
  updateTrainingCourseDraftVersion: (...args: unknown[]) =>
    updateTrainingCourseDraftVersion(...args),
  publishTrainingCourseVersion: (...args: unknown[]) =>
    publishTrainingCourseVersion(...args),
}));

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

import { CourseDraftEditor } from "@/components/training/course-draft-editor";

const initialValues = {
  durationMinutes: "60",
  validityDays: "365",
  deliveryMethod: "classroom",
  learningObjectives: "Operate safely",
  trainerRequirements: "",
  evidenceNotes: "",
};

describe("CourseDraftEditor", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    updateTrainingCourseDraftVersion.mockReset();
    publishTrainingCourseVersion.mockReset();
    navigateTo.mockReset();
    updateTrainingCourseDraftVersion.mockResolvedValue({ ok: true });
    publishTrainingCourseVersion.mockResolvedValue({ ok: true });
  });

  it("saves draft values and keeps them when the server rejects the update", async () => {
    updateTrainingCourseDraftVersion.mockResolvedValueOnce({
      error:
        "Unable to save this draft. Your entries were kept so you can try again.",
    });

    render(
      <CourseDraftEditor
        courseId="course-1"
        versionId="version-1"
        versionNumber={1}
        initialValues={initialValues}
      />,
    );

    fireEvent.change(screen.getByTestId("training-course-objectives-input"), {
      target: { value: "Inspect the forklift first" },
    });
    fireEvent.click(screen.getByTestId("training-course-save-draft"));

    await waitFor(() => {
      expect(screen.getByTestId("training-course-draft-error")).toBeVisible();
    });
    expect(screen.getByTestId("training-course-objectives-input")).toHaveValue(
      "Inspect the forklift first",
    );
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("saves then publishes through the canonical actions", async () => {
    render(
      <CourseDraftEditor
        courseId="course-1"
        versionId="version-1"
        versionNumber={1}
        initialValues={initialValues}
      />,
    );

    fireEvent.click(screen.getByTestId("training-course-publish"));

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        "/platform/training/courses/course-1?saved=publish",
      );
    });
    expect(updateTrainingCourseDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: "course-1",
        versionId: "version-1",
        learningObjectives: "Operate safely",
      }),
    );
    expect(publishTrainingCourseVersion).toHaveBeenCalledWith({
      courseId: "course-1",
      versionId: "version-1",
    });
  });
});
