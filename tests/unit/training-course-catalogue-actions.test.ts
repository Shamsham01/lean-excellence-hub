import { beforeEach, describe, expect, it, vi } from "vitest";

const currentMemberHasPermission = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      maybeSingle,
    }),
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
  createCourseSuccessorVersion,
  createTrainingCourseDraft,
  publishTrainingCourseVersion,
  updateTrainingCourseDraftVersion,
} from "@/app/(platform)/platform/training/actions";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";

describe("training course catalogue server actions", () => {
  beforeEach(() => {
    currentMemberHasPermission.mockReset();
    rpc.mockReset();
    maybeSingle.mockReset();
    from.mockClear();
    currentMemberHasPermission.mockResolvedValue(true);
    maybeSingle.mockResolvedValue({
      data: { id: "version-1", evidence_requirements: null },
      error: null,
    });
  });

  it("denies create, update, publish, and successor without training.catalog.manage", async () => {
    currentMemberHasPermission.mockResolvedValue(false);

    await expect(
      createTrainingCourseDraft({ name: "Forklift Safety", code: "forklift" }),
    ).resolves.toEqual({
      error: "You are not authorised to manage the training catalogue.",
    });
    await expect(
      updateTrainingCourseDraftVersion({
        courseId: "course-1",
        versionId: "version-1",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage the training catalogue.",
    });
    await expect(
      publishTrainingCourseVersion({
        courseId: "course-1",
        versionId: "version-1",
      }),
    ).resolves.toEqual({
      error: "You are not authorised to manage the training catalogue.",
    });
    await expect(createCourseSuccessorVersion("course-1")).resolves.toEqual({
      error: "You are not authorised to manage the training catalogue.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(currentMemberHasPermission).toHaveBeenCalledWith(
      TRAINING_PERMISSIONS.catalogManage,
    );
  });

  it("creates a draft through the canonical RPC without an organisation id", async () => {
    rpc.mockResolvedValue({ data: "course-1", error: null });

    await expect(
      createTrainingCourseDraft({
        name: "Forklift Safety",
        code: "Forklift-Safety",
        description: "Safe operation",
      }),
    ).resolves.toEqual({ courseId: "course-1" });

    expect(rpc).toHaveBeenCalledWith("create_training_course_draft", {
      target_name: "Forklift Safety",
      target_code: "forklift-safety",
      target_description: "Safe operation",
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("organisation_id");
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("target_organisation_id");
  });

  it("maps a duplicate-code RPC failure without claiming a new course was created", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "training_courses_organisation_id_code_key"',
      },
    });

    await expect(
      createTrainingCourseDraft({
        name: "Lean Basic",
        code: "lean-basic",
      }),
    ).resolves.toEqual({
      error:
        "A course with this code already exists. Choose a different name or custom code.",
    });
  });

  it("preserves existing evidence JSON keys when saving notes", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: "version-1",
        evidence_requirements: {
          required: ["photo"],
          assessor: "supervisor",
          notes: "Old register",
        },
      },
      error: null,
    });
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      updateTrainingCourseDraftVersion({
        courseId: "course-1",
        versionId: "version-1",
        durationMinutes: "90",
        validityDays: "365",
        deliveryMethod: "classroom",
        learningObjectives: "Operate safely",
        evidenceNotes: "Signed register",
      }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("update_training_course_draft_version", {
      target_course_version_id: "version-1",
      target_duration_minutes: 90,
      target_validity_days: 365,
      target_delivery_method: "classroom",
      target_learning_objectives: "Operate safely",
      target_evidence_requirements: {
        required: ["photo"],
        assessor: "supervisor",
        notes: "Signed register",
      },
    });
  });

  it("does not update a draft when the evidence query fails", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "57014", message: "canceling statement" },
    });

    await expect(
      updateTrainingCourseDraftVersion({
        courseId: "course-1",
        versionId: "version-1",
        evidenceNotes: "Signed register",
      }),
    ).resolves.toEqual({
      error:
        "Unable to save this draft. Your entries were kept so you can try again.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("updates and publishes only the selected draft version", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      updateTrainingCourseDraftVersion({
        courseId: "course-1",
        versionId: "version-1",
        durationMinutes: "90",
        validityDays: "365",
        deliveryMethod: "classroom",
        learningObjectives: "Operate safely",
        evidenceNotes: "Signed register",
      }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("update_training_course_draft_version", {
      target_course_version_id: "version-1",
      target_duration_minutes: 90,
      target_validity_days: 365,
      target_delivery_method: "classroom",
      target_learning_objectives: "Operate safely",
      target_evidence_requirements: { notes: "Signed register" },
    });

    await expect(
      publishTrainingCourseVersion({
        courseId: "course-1",
        versionId: "version-1",
      }),
    ).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("publish_training_course_version", {
      target_course_version_id: "version-1",
    });
  });
});
