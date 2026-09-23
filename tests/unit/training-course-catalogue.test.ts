import { describe, expect, it } from "vitest";

import {
  buildTrainingEvidenceRequirements,
  deriveTrainingCourseCatalogueStatus,
  optionalPositiveInteger,
  parseTrainingEvidenceNotes,
  trainingCatalogueScopeMessage,
  trainingCourseCatalogueStatusLabel,
  trainingCoursePublishGuidance,
  trainingDeliveryMethodLabel,
} from "@/modules/training/catalog-admin";
import {
  generateTrainingCourseCode,
  resolveTrainingCourseCreateCode,
} from "@/modules/training/catalog-code";
import { toTrainingCatalogErrorMessage } from "@/modules/training/catalog-errors";

describe("training course catalogue codes", () => {
  it("generates a catalogue code from the course name", () => {
    expect(generateTrainingCourseCode("Forklift Safety")).toBe(
      "forklift-safety",
    );
    expect(generateTrainingCourseCode("  5S & Gemba  ")).toBe("5s-gemba");
  });

  it("auto-uniques generated codes without overwriting an existing course", () => {
    expect(
      resolveTrainingCourseCreateCode({
        name: "Lean Basic",
        existingCodes: ["lean-basic"],
      }),
    ).toEqual({ ok: true, code: "lean-basic-2" });
  });

  it("rejects a duplicate advanced code override", () => {
    expect(
      resolveTrainingCourseCreateCode({
        name: "Lean Foundation",
        customCode: "lean-basic",
        existingCodes: ["lean-basic"],
      }),
    ).toEqual({
      ok: false,
      message:
        "A course with this code already exists. Choose a different code.",
    });
  });
});

describe("training course catalogue presentation", () => {
  it("labels delivery methods for people, not database tokens", () => {
    expect(trainingDeliveryMethodLabel("classroom")).toBe("Classroom");
    expect(trainingDeliveryMethodLabel("blended")).toBe("Blended");
  });

  it("distinguishes draft, published, and successor-draft catalogue rows", () => {
    expect(
      trainingCourseCatalogueStatusLabel(
        deriveTrainingCourseCatalogueStatus({
          courseStatus: "active",
          versionStatuses: ["draft"],
        }),
      ),
    ).toBe("Draft");
    expect(
      trainingCourseCatalogueStatusLabel(
        deriveTrainingCourseCatalogueStatus({
          courseStatus: "active",
          versionStatuses: ["published", "archived"],
        }),
      ),
    ).toBe("Published");
    expect(
      trainingCourseCatalogueStatusLabel(
        deriveTrainingCourseCatalogueStatus({
          courseStatus: "active",
          versionStatuses: ["published", "draft"],
        }),
      ),
    ).toBe("Published · successor draft");
  });

  it("keeps evidence notes in the JSON object the RPC already accepts", () => {
    expect(buildTrainingEvidenceRequirements("  Signed register  ")).toEqual({
      notes: "Signed register",
    });
    expect(buildTrainingEvidenceRequirements("")).toBeNull();
    expect(parseTrainingEvidenceNotes({ notes: "Attendance sheet" })).toBe(
      "Attendance sheet",
    );
  });

  it("rejects non-positive duration or validity before the RPC", () => {
    expect(optionalPositiveInteger("0")).toMatchObject({ ok: false });
    expect(optionalPositiveInteger("90")).toEqual({ ok: true, value: 90 });
    expect(optionalPositiveInteger("")).toEqual({ ok: true, value: null });
  });

  it("states organisation-wide scope when an active site is selected", () => {
    expect(trainingCatalogueScopeMessage("Exeter")).toBe(
      "The training catalogue is organisation-wide. Selecting Exeter does not filter these courses.",
    );
  });

  it("surfaces the existing publish contract instead of inventing readiness gates", () => {
    expect(trainingCoursePublishGuidance()).toMatch(
      /does not require extra fields/i,
    );
    expect(trainingCoursePublishGuidance()).toMatch(
      /cannot be edited in place/i,
    );
  });
});

describe("training course catalogue errors", () => {
  it("maps duplicate codes, permission denials, and infrastructure failures", () => {
    expect(
      toTrainingCatalogErrorMessage(
        {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "training_courses_organisation_id_code_key"',
        },
        "Unable to create this course.",
      ),
    ).toBe(
      "A course with this code already exists. Choose a different name or custom code.",
    );
    expect(
      toTrainingCatalogErrorMessage(
        {
          code: "42501",
          message: "training course creation is not authorised",
        },
        "Unable to create this course.",
      ),
    ).toBe("You are not authorised to manage the training catalogue.");
    expect(
      toTrainingCatalogErrorMessage(
        { code: "XX000", message: "postgres connection reset" },
        "Unable to save this draft. Your entries were kept so you can try again.",
      ),
    ).toBe(
      "Unable to save this draft. Your entries were kept so you can try again.",
    );
  });
});
