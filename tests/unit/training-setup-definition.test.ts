import { describe, expect, it } from "vitest";

import { buildStarterPackDefinition } from "@/modules/training/setup/definition";
import { manualPreparationToDefinition } from "@/modules/training/setup/preparation";
import { manufacturingTrainingStarterPack } from "@/modules/training/templates/manufacturing";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

describe("training setup definition", () => {
  it("builds a quick start definition with mapped roles", () => {
    const result = buildStarterPackDefinition({
      pack: manufacturingTrainingStarterPack,
      roleMappings: [
        { suggestedRole: "Line Operator", jobFunctionId: JOB_ID },
        { suggestedRole: "Team Leader", jobFunctionId: null },
      ],
      existingCourseCodes: [],
      existingCurriculumCodes: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.courses.length).toBeGreaterThanOrEqual(3);
      expect(result.definition.curriculum?.requirements.length).toBeGreaterThan(
        0,
      );
      expect(result.definition.source).toBe("quick_start");
    }
  });

  it("rejects manual setup without courses", () => {
    const result = manualPreparationToDefinition(
      {
        idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        step: "preview",
        title: "Draft",
        courses: [],
        includeCurriculum: false,
        curriculumName: "",
        curriculumDescription: "",
      },
      [],
      [],
    );
    expect(result.ok).toBe(false);
  });
});
