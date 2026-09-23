import { beforeEach, describe, expect, it, vi } from "vitest";

const currentMemberHasPermission = vi.fn();
const rpc = vi.fn();
const eq = vi.fn();
const from = vi.fn(() => ({
  select: () => ({
    eq,
  }),
}));

vi.mock("@/modules/platform-shell/permissions", () => ({
  currentMemberHasPermission: (...args: unknown[]) =>
    currentMemberHasPermission(...args),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc, from })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import {
  addTrainingRequirement,
  createCurriculumSuccessorVersion,
  createTrainingCurriculumDraft,
  publishTrainingCurriculumVersion,
  removeTrainingRequirement,
  updateTrainingRequirement,
} from "@/app/(platform)/platform/training/curriculum-actions";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";

describe("training curriculum server actions", () => {
  beforeEach(() => {
    currentMemberHasPermission.mockReset();
    rpc.mockReset();
    eq.mockReset();
    from.mockClear();
    currentMemberHasPermission.mockResolvedValue(true);
    eq.mockResolvedValue({ data: [], error: null });
  });

  it("denies create, add, update, remove, publish, and successor without training.curriculum.manage", async () => {
    currentMemberHasPermission.mockResolvedValue(false);

    await expect(
      createTrainingCurriculumDraft({
        name: "Core Curriculum",
        code: "core-curriculum",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage training curricula.",
    });
    await expect(
      addTrainingRequirement({
        curriculumId: "curr-1",
        versionId: "ver-1",
        courseId: "course-1",
        applicabilityMode: "all_members",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage training curricula.",
    });
    await expect(
      updateTrainingRequirement({
        curriculumId: "curr-1",
        versionId: "ver-1",
        requirementId: "req-1",
        courseId: "course-1",
        applicabilityMode: "all_members",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage training curricula.",
    });
    await expect(
      removeTrainingRequirement({
        curriculumId: "curr-1",
        requirementId: "req-1",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage training curricula.",
    });
    await expect(
      publishTrainingCurriculumVersion({
        curriculumId: "curr-1",
        versionId: "ver-1",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage training curricula.",
    });
    await expect(createCurriculumSuccessorVersion("curr-1")).resolves.toEqual({
      error: "You are not authorised to manage training curricula.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(currentMemberHasPermission).toHaveBeenCalledWith(
      TRAINING_PERMISSIONS.curriculumManage,
    );
  });

  it("creates a draft through the canonical RPC without an organisation id", async () => {
    rpc.mockResolvedValue({ data: "curr-1", error: null });

    await expect(
      createTrainingCurriculumDraft({
        name: "Core Curriculum",
        code: "Core-Curriculum",
        description: "Who needs which course",
      }),
    ).resolves.toEqual({ curriculumId: "curr-1" });

    expect(rpc).toHaveBeenCalledWith("create_training_curriculum_draft", {
      target_name: "Core Curriculum",
      target_code: "core-curriculum",
      target_description: "Who needs which course",
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("organisation_id");
  });

  it("blocks add when the existing-requirement query fails", async () => {
    eq.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "postgres connection reset" },
    });

    await expect(
      addTrainingRequirement({
        curriculumId: "curr-1",
        versionId: "ver-1",
        courseId: "course-1",
        applicabilityMode: "all_members",
        notes: "Keep this note",
      }),
    ).resolves.toEqual({
      error:
        "Unable to save this requirement. Your entries were kept so you can try again.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an overlapping requirement before calling the RPC", async () => {
    eq.mockResolvedValue({
      data: [
        {
          id: "req-1",
          course_id: "course-1",
          applies_to_all_members: true,
          job_function_id: null,
          organisational_unit_id: null,
        },
      ],
      error: null,
    });

    await expect(
      addTrainingRequirement({
        curriculumId: "curr-1",
        versionId: "ver-1",
        courseId: "course-1",
        applicabilityMode: "all_members",
      }),
    ).resolves.toEqual({
      error:
        "This course already has the same applicability on this draft. Edit the existing requirement instead.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("adds a job-function requirement through the canonical RPC", async () => {
    rpc.mockResolvedValue({ data: "req-2", error: null });

    await expect(
      addTrainingRequirement({
        curriculumId: "curr-1",
        versionId: "ver-1",
        courseId: "course-1",
        applicabilityMode: "job_function",
        jobFunctionId: "jf-1",
        mandatory: true,
        requiredWithinDays: "30",
      }),
    ).resolves.toEqual({ requirementId: "req-2" });

    expect(rpc).toHaveBeenCalledWith(
      "add_training_requirement",
      expect.objectContaining({
        target_curriculum_version_id: "ver-1",
        target_course_id: "course-1",
        target_applies_to_all_members: false,
        target_job_function_id: "jf-1",
        target_required_within_days: 30,
      }),
    );
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty(
      "target_organisational_unit_id",
    );
  });
});
