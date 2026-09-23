import { describe, expect, it } from "vitest";

import {
  buildTrainingCourseDraftUpdateArgs,
  buildTrainingCourseListItems,
  formatTrainingCourseVersionStatus,
  mapTrainingCourseActionError,
  parseTrainingCourseDraftFields,
  resolveTrainingCourseDraftIntent,
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

describe("parseTrainingCourseDraftFields", () => {
  it("returns a recoverable validation error for non-positive duration", () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("versionId", "version-1");
    formData.set("durationMinutes", "0");
    formData.set("learningObjectives", "Keep this text");

    const result = parseTrainingCourseDraftFields(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Duration");
      expect(result.fields.learningObjectives).toBe("Keep this text");
      expect(result.fields.durationMinutes).toBe("0");
    }
  });
});

describe("resolveTrainingCourseDraftIntent", () => {
  it("treats publish as an explicit intent and defaults to save", () => {
    const publish = new FormData();
    publish.set("intent", "publish");
    expect(resolveTrainingCourseDraftIntent(publish)).toBe("publish");
    expect(resolveTrainingCourseDraftIntent(new FormData())).toBe("save");
  });
});

describe("buildTrainingCourseDraftUpdateArgs", () => {
  it("preserves existing evidence requirements when the form omits them", () => {
    const evidence = { attendance: "signed register" };
    const args = buildTrainingCourseDraftUpdateArgs(
      {
        courseId: "course-1",
        versionId: "version-1",
        deliveryMethod: "classroom",
        learningObjectives: "Understand lean basics.",
        trainerRequirements: "",
        durationMinutes: "240",
        validityDays: "365",
      },
      evidence,
    );

    expect(args.target_evidence_requirements).toEqual(evidence);
    expect(args.target_delivery_method).toBe("classroom");
  });

  it("omits evidence only when the draft has none", () => {
    const args = buildTrainingCourseDraftUpdateArgs(
      {
        courseId: "course-1",
        versionId: "version-1",
        deliveryMethod: "",
        learningObjectives: "",
        trainerRequirements: "",
        durationMinutes: "",
        validityDays: "",
      },
      null,
    );

    expect(args).toEqual({ target_course_version_id: "version-1" });
  });
});

describe("mapTrainingCourseActionError", () => {
  it("maps authorisation and missing-draft errors to recoverable copy", () => {
    expect(
      mapTrainingCourseActionError("training course update is not authorised"),
    ).toBe("Training catalogue management is not authorised.");
    expect(mapTrainingCourseActionError("draft course version not found")).toBe(
      "This draft can no longer be edited. Reload the course and try again.",
    );
  });
});
