import { describe, expect, it } from "vitest";

import {
  deriveTrainingCurriculumCatalogueStatus,
  describeTrainingCourseValidity,
  describeTrainingRequirementApplicability,
  describeTrainingRequirementDeadlineGuidance,
  describeTrainingRequirementGraceGuidance,
  findOverlappingTrainingRequirement,
  optionalNonNegativeInteger,
  resolveTrainingRequirementTarget,
  trainingCurriculumCatalogueStatusLabel,
  trainingCurriculumPublishAfterSaveError,
  trainingCurriculumPublishGuidance,
  trainingCurriculumScopeMessage,
  trainingRequirementFormHasUnsavedContent,
  trainingRequirementTimingLimitation,
} from "@/modules/training/curriculum-admin";
import {
  generateTrainingCurriculumCode,
  resolveTrainingCurriculumCreateCode,
} from "@/modules/training/curriculum-code";
import { toTrainingCurriculumErrorMessage } from "@/modules/training/curriculum-errors";

describe("training curriculum codes", () => {
  it("generates a curriculum code from the name", () => {
    expect(generateTrainingCurriculumCode("Core Operations")).toBe(
      "core-operations",
    );
  });

  it("auto-uniques generated codes without overwriting an existing curriculum", () => {
    expect(
      resolveTrainingCurriculumCreateCode({
        name: "Apex Training Curriculum",
        existingCodes: ["apex-curriculum"],
      }),
    ).toEqual({ ok: true, code: "apex-training-curriculum" });
  });

  it("rejects a duplicate advanced code override", () => {
    expect(
      resolveTrainingCurriculumCreateCode({
        name: "Main Curriculum",
        customCode: "apex-curriculum",
        existingCodes: ["apex-curriculum"],
      }),
    ).toEqual({
      ok: false,
      message:
        "A curriculum with this code already exists. Choose a different code.",
    });
  });
});

describe("training curriculum presentation", () => {
  it("distinguishes draft, published, and successor-draft rows", () => {
    expect(
      trainingCurriculumCatalogueStatusLabel(
        deriveTrainingCurriculumCatalogueStatus({
          curriculumStatus: "active",
          versionStatuses: ["draft"],
        }),
      ),
    ).toBe("Draft");
    expect(
      trainingCurriculumCatalogueStatusLabel(
        deriveTrainingCurriculumCatalogueStatus({
          curriculumStatus: "active",
          versionStatuses: ["published", "archived"],
        }),
      ),
    ).toBe("Published");
    expect(
      trainingCurriculumCatalogueStatusLabel(
        deriveTrainingCurriculumCatalogueStatus({
          curriculumStatus: "active",
          versionStatuses: ["published", "draft"],
        }),
      ),
    ).toBe("Published · successor draft");
  });

  it("explains existing applicability modes without inventing combination rules", () => {
    expect(
      describeTrainingRequirementApplicability({
        appliesToAllMembers: true,
      }),
    ).toMatch(/everyone in the organisation/i);
    expect(
      describeTrainingRequirementApplicability({
        appliesToAllMembers: false,
        jobFunctionName: "Operator",
      }),
    ).toMatch(/primary job function is Operator/i);
    expect(
      describeTrainingRequirementApplicability({
        appliesToAllMembers: false,
        jobFunctionName: "Operator",
        organisationalUnitName: "Operations",
      }),
    ).toMatch(/does not further restrict compliance|across the organisation/i);
  });

  it("distinguishes course-version validity from a stored curriculum override", () => {
    expect(
      describeTrainingCourseValidity({
        courseValidityDays: 365,
        overrideDays: 180,
      }),
    ).toMatch(/course version is valid for 365 days/i);
    expect(
      describeTrainingCourseValidity({
        courseValidityDays: 365,
        overrideDays: 180,
      }),
    ).toMatch(/does not automatically load this curriculum override/i);
    expect(
      describeTrainingCourseValidity({
        courseValidityDays: null,
        overrideDays: null,
      }),
    ).toMatch(
      /unless an override is supplied when the completion is recorded/i,
    );
    expect(describeTrainingRequirementDeadlineGuidance()).toMatch(
      /does not use this field to mark training due/i,
    );
    expect(describeTrainingRequirementGraceGuidance()).toMatch(
      /do not apply this field/i,
    );
    expect(trainingRequirementTimingLimitation()).toMatch(
      /compliance does not currently use these timing fields/i,
    );
  });

  it("states organisation-wide curriculum scope without implying a unit changes compliance", () => {
    const withSite = trainingCurriculumScopeMessage("Exeter");
    expect(withSite).toMatch(/organisation-wide/i);
    expect(withSite).toMatch(/Exeter/);
    expect(withSite).toMatch(/does not filter who a requirement applies to/i);
    expect(withSite).toMatch(/does not currently restrict compliance/i);
    expect(withSite).not.toMatch(/unless you choose an organisational unit/i);

    const withoutSite = trainingCurriculumScopeMessage();
    expect(withoutSite).toMatch(/active site does not filter/i);
    expect(withoutSite).toMatch(
      /job-function requirements apply across the organisation/i,
    );
    expect(withoutSite).not.toMatch(
      /unless you choose an organisational unit/i,
    );
  });

  it("keeps the publish-after-save failure message accurate", () => {
    expect(
      trainingCurriculumPublishAfterSaveError(
        "The draft is no longer available.",
      ),
    ).toBe(
      "The requirement was saved, but the curriculum could not be published. The draft is no longer available.",
    );
  });

  it("surfaces the existing publish contract", () => {
    expect(trainingCurriculumPublishGuidance()).toMatch(
      /cannot be edited in place/i,
    );
  });
});

describe("training requirement targeting", () => {
  it("keeps all-members and job-function targeting mutually exclusive in the form", () => {
    expect(
      resolveTrainingRequirementTarget({
        courseId: "course-1",
        applicabilityMode: "all_members",
        jobFunctionId: "ignored",
        organisationalUnitId: "ignored",
      }),
    ).toEqual({
      ok: true,
      value: {
        courseId: "course-1",
        appliesToAllMembers: true,
        jobFunctionId: null,
        organisationalUnitId: null,
      },
    });
    expect(
      resolveTrainingRequirementTarget({
        courseId: "course-1",
        applicabilityMode: "job_function",
      }),
    ).toEqual({ ok: false, message: "Choose a job function." });
    expect(
      resolveTrainingRequirementTarget({
        courseId: "course-1",
        applicabilityMode: "job_function_and_unit",
        jobFunctionId: "jf-1",
      }),
    ).toEqual({ ok: false, message: "Choose an organisational unit." });
  });

  it("detects the same course and applicability combination", () => {
    expect(
      findOverlappingTrainingRequirement(
        {
          courseId: "course-1",
          appliesToAllMembers: false,
          jobFunctionId: "jf-1",
          organisationalUnitId: null,
        },
        [
          {
            id: "req-1",
            courseId: "course-1",
            appliesToAllMembers: false,
            jobFunctionId: "jf-1",
            organisationalUnitId: null,
          },
        ],
      )?.id,
    ).toBe("req-1");
    expect(
      findOverlappingTrainingRequirement(
        {
          id: "req-1",
          courseId: "course-1",
          appliesToAllMembers: false,
          jobFunctionId: "jf-1",
          organisationalUnitId: null,
        },
        [
          {
            id: "req-1",
            courseId: "course-1",
            appliesToAllMembers: false,
            jobFunctionId: "jf-1",
            organisationalUnitId: null,
          },
        ],
      ),
    ).toBeUndefined();
  });

  it("treats an empty add form as having no unsaved requirement", () => {
    expect(
      trainingRequirementFormHasUnsavedContent({
        courseId: "",
        jobFunctionId: "",
        organisationalUnitId: "",
        requiredWithinDays: "",
        validityDaysOverride: "",
        gracePeriodDays: "",
        notes: "",
      }),
    ).toBe(false);
    expect(
      trainingRequirementFormHasUnsavedContent({
        courseId: "course-1",
        jobFunctionId: "",
        organisationalUnitId: "",
        requiredWithinDays: "",
        validityDaysOverride: "",
        gracePeriodDays: "",
        notes: "",
      }),
    ).toBe(true);
  });

  it("allows a zero grace period and rejects a negative one", () => {
    expect(optionalNonNegativeInteger("0")).toEqual({ ok: true, value: 0 });
    expect(optionalNonNegativeInteger("-1")).toMatchObject({ ok: false });
  });
});

describe("training curriculum errors", () => {
  it("maps duplicate codes, permission denials, and infrastructure failures", () => {
    expect(
      toTrainingCurriculumErrorMessage(
        {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "training_curricula_organisation_id_code_key"',
        },
        "Unable to create this curriculum.",
      ),
    ).toBe(
      "A curriculum with this code already exists. Choose a different name or custom code.",
    );
    expect(
      toTrainingCurriculumErrorMessage(
        {
          code: "42501",
          message: "training curriculum creation is not authorised",
        },
        "Unable to create this curriculum.",
      ),
    ).toBe("You are not authorised to manage training curricula.");
    expect(
      toTrainingCurriculumErrorMessage(
        { code: "XX000", message: "postgres connection reset" },
        "Unable to save this requirement. Your entries were kept so you can try again.",
      ),
    ).toBe(
      "Unable to save this requirement. Your entries were kept so you can try again.",
    );
  });
});
