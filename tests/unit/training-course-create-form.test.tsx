import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createTrainingCourseDraft = vi.fn();
const navigateTo = vi.fn();

vi.mock("@/app/(platform)/platform/training/actions", () => ({
  createTrainingCourseDraft: (...args: unknown[]) =>
    createTrainingCourseDraft(...args),
}));

vi.mock("@/lib/navigation/navigate", () => ({
  navigateTo: (...args: unknown[]) => navigateTo(...args),
}));

import { CourseCreateForm } from "@/components/training/course-create-form";

describe("CourseCreateForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    createTrainingCourseDraft.mockReset();
    navigateTo.mockReset();
  });

  it("previews a generated code and blocks duplicate custom codes", () => {
    render(<CourseCreateForm existingCodes={["lean-basic"]} />);

    fireEvent.change(screen.getByTestId("training-course-name-input"), {
      target: { value: "Forklift Safety" },
    });
    expect(
      screen.getByTestId("training-course-auto-code-preview"),
    ).toHaveTextContent("forklift-safety");

    fireEvent.click(screen.getByTestId("training-course-custom-code-toggle"));
    fireEvent.change(screen.getByTestId("training-course-custom-code-input"), {
      target: { value: "lean-basic" },
    });
    fireEvent.submit(screen.getByTestId("training-course-create-form"));

    expect(
      screen.getByTestId("training-course-create-error"),
    ).toHaveTextContent("A course with this code already exists");
    expect(createTrainingCourseDraft).not.toHaveBeenCalled();
  });

  it("prevents duplicate submits and navigates to the new draft", async () => {
    let resolveCreate: ((value: { courseId: string }) => void) | undefined;
    createTrainingCourseDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<CourseCreateForm existingCodes={[]} />);

    fireEvent.change(screen.getByTestId("training-course-name-input"), {
      target: { value: "Forklift Safety" },
    });
    fireEvent.submit(screen.getByTestId("training-course-create-form"));
    fireEvent.submit(screen.getByTestId("training-course-create-form"));

    expect(createTrainingCourseDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("training-course-create-submit")).toBeDisabled();

    resolveCreate?.({ courseId: "course-1" });

    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        "/platform/training/courses/course-1",
      );
    });
  });

  it("keeps entered values when creation fails", async () => {
    createTrainingCourseDraft.mockResolvedValue({
      error:
        "A course with this code already exists. Choose a different name or custom code.",
    });

    render(<CourseCreateForm existingCodes={[]} />);

    fireEvent.change(screen.getByTestId("training-course-name-input"), {
      target: { value: "Lean Basic" },
    });
    fireEvent.click(screen.getByTestId("training-course-custom-code-toggle"));
    fireEvent.change(screen.getByTestId("training-course-custom-code-input"), {
      target: { value: "lean-basic" },
    });
    fireEvent.submit(screen.getByTestId("training-course-create-form"));

    await waitFor(() => {
      expect(screen.getByTestId("training-course-create-error")).toBeVisible();
    });
    expect(screen.getByTestId("training-course-name-input")).toHaveValue(
      "Lean Basic",
    );
    expect(screen.getByTestId("training-course-custom-code-input")).toHaveValue(
      "lean-basic",
    );
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
