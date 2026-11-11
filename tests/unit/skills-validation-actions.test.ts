// VERIFY draft for PR #391 (Spec A): recordSkillValidation must reject a
// missing/unknown method before calling Supabase and must forward the chosen
// key verbatim. recordSkillSelfAssessment must not send a method.
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import {
  recordSkillSelfAssessment,
  recordSkillValidation,
} from "@/app/(platform)/platform/people/actions";
import { SKILL_VALIDATION_METHODS } from "@/modules/skills/assessment-methods";

const base = {
  membershipId: "membership-1",
  skillId: "skill-1",
  proficiencyScaleVersionId: "scale-version-1",
  proficiencyLevelId: "level-1",
};

const REJECTION =
  "Choose a recognised assessment method before saving this validation.";

describe("recordSkillValidation", () => {
  beforeEach(() => {
    rpc.mockReset();
    revalidatePath.mockReset();
    rpc.mockResolvedValue({ data: "assessment-1", error: null });
  });

  it.each([
    ["omitted", undefined],
    ["empty", ""],
    ["legacy observation", "observation"],
    ["legacy certification", "certification"],
    ["self_assessment", "self_assessment"],
  ])("rejects %s method without calling the RPC", async (_name, method) => {
    const payload =
      method === undefined ? base : { ...base, assessmentMethod: method };
    await expect(recordSkillValidation(payload)).resolves.toEqual({
      error: REJECTION,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([...SKILL_VALIDATION_METHODS])(
    "forwards %s verbatim as target_assessment_method",
    async (method) => {
      await expect(
        recordSkillValidation({ ...base, assessmentMethod: method }),
      ).resolves.toEqual({ assessmentId: "assessment-1" });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        "record_skill_validation",
        expect.objectContaining({
          target_membership_id: "membership-1",
          target_assessment_method: method,
        }),
      );
    },
  );

  it("surfaces a database 22023 message instead of succeeding", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message: "skill validation requires a recognised assessment method",
      },
    });
    await expect(
      recordSkillValidation({ ...base, assessmentMethod: "qualification" }),
    ).resolves.toEqual({
      error: "skill validation requires a recognised assessment method",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("recordSkillSelfAssessment", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "self-1", error: null });
  });

  it("does not send an assessment method (self path keeps its DB default)", async () => {
    await recordSkillSelfAssessment(base);
    expect(rpc).toHaveBeenCalledWith(
      "record_skill_self_assessment",
      expect.not.objectContaining({
        target_assessment_method: expect.anything(),
      }),
    );
  });
});
