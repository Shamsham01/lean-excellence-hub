import { describe, expect, it } from "vitest";

import {
  buildTrainingCourseListItems,
  formatTrainingCourseVersionStatus,
  trainingCourseEmptyStateMessage,
  trainingCoursePublishReadiness,
} from "@/modules/training/catalog-admin";

describe("trainingCourseEmptyStateMessage", () => {
  it("guides catalogue managers to create the first course", () => {
    const message = trainingCourseEmptyStateMessage(true);
    expect(message.title).toContain("No training courses");
    expect(message.description).toContain("Create your first course");
    expect(message.description).toContain("organisation");
  });

  it("keeps read-only users informed without create guidance", () => {
    const message = trainingCourseEmptyStateMessage(false);
    expect(message.description).not.toContain("Create your first course");
  });
});

describe("buildTrainingCourseListItems", () => {
  it("uses the highest version number for each course", () => {
    const items = buildTrainingCourseListItems(
      [
        {
          id: "course-1",
          name: "Lean basics",
          code: "lean-basics",
          category: null,
        },
      ],
      [
        { course_id: "course-1", version_number: 1, status: "archived" },
        { course_id: "course-1", version_number: 2, status: "published" },
      ],
    );

    expect(items[0]?.latestVersionNumber).toBe(2);
    expect(items[0]?.latestVersionStatus).toBe("published");
  });
});

describe("trainingCoursePublishReadiness", () => {
  it("always allows publish while surfacing recommendations", () => {
    const readiness = trainingCoursePublishReadiness({
      validityDays: null,
      durationMinutes: null,
      deliveryMethod: null,
      learningObjectives: null,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.recommendations.length).toBeGreaterThan(0);
  });

  it("clears recommendations when key fields are present", () => {
    const readiness = trainingCoursePublishReadiness({
      validityDays: 365,
      durationMinutes: 240,
      deliveryMethod: "classroom",
      learningObjectives: "Understand lean basics.",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.recommendations).toEqual([]);
  });
});

describe("formatTrainingCourseVersionStatus", () => {
  it("formats known statuses", () => {
    expect(formatTrainingCourseVersionStatus("draft")).toBe("Draft");
    expect(formatTrainingCourseVersionStatus("published")).toBe("Published");
  });
});
