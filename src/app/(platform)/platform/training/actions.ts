"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildAuthoringSavedRedirectPath } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { resolveTrainingCourseCreateCode } from "@/modules/training/catalog-code";
import { createServerSupabaseClient } from "@/platform/supabase/server";

async function requireTrainingCatalogManagePermission() {
  const canManage = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.catalogManage,
  );
  if (!canManage) {
    throw new Error("Training catalogue management is not authorised.");
  }
}

function mapTrainingCourseCreateError(message: string): string {
  const normalised = message.toLowerCase();
  if (
    normalised.includes("duplicate key") &&
    normalised.includes("training_courses_organisation_id_code_key")
  ) {
    return "A course with this code already exists. Choose a different code or name.";
  }
  if (normalised.includes("training_courses_code_check")) {
    return "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number.";
  }
  if (normalised.includes("training course creation is not authorised")) {
    return "Training catalogue management is not authorised.";
  }
  return message;
}

export async function updateSessionParticipantStatus(
  sessionId: string,
  participantId: string,
  status: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(
    "update_training_session_participant_status",
    {
      target_session_id: sessionId,
      target_participant_id: participantId,
      target_status: status,
    },
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/training/sessions/${sessionId}`);
  return { ok: true };
}

export async function removeSessionParticipant(
  sessionId: string,
  participantId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_training_session_participant", {
    target_session_id: sessionId,
    target_participant_id: participantId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/training/sessions/${sessionId}`);
  return { ok: true };
}

export async function addSessionParticipant(
  sessionId: string,
  membershipId: string,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_training_session_participant", {
    target_session_id: sessionId,
    target_membership_id: membershipId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/platform/training/sessions/${sessionId}`);
  return { ok: true };
}

export async function bulkRecordCompletions(input: {
  sessionId: string;
  membershipIds: string[];
  courseVersionId: string;
  completedAt: string;
  completionMethod?: string;
  notes?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "bulk_record_training_completions",
    {
      target_membership_ids: input.membershipIds,
      target_course_version_id: input.courseVersionId,
      target_completed_at: input.completedAt,
      target_completion_method: input.completionMethod ?? "classroom",
      target_session_id: input.sessionId,
      ...(input.notes ? { target_notes: input.notes } : {}),
    },
  );
  if (error) return { error: error.message };

  for (const membershipId of input.membershipIds) {
    const { data: participants } = await supabase
      .from("training_session_participants")
      .select("id")
      .eq("session_id", input.sessionId)
      .eq("membership_id", membershipId);

    const participant = participants?.[0];
    if (participant?.id) {
      await supabase.rpc("update_training_session_participant_status", {
        target_session_id: input.sessionId,
        target_participant_id: participant.id,
        target_status: "completed",
      });
    }
  }

  revalidatePath(`/platform/training/sessions/${input.sessionId}`);
  revalidatePath("/platform/training/matrix");
  revalidatePath("/platform/training");
  return { completionIds: data as string[] };
}

export async function createCapabilityAction(input: {
  title: string;
  gapType: "training_gap" | "skill_gap" | "skill_assessment_follow_up";
  membershipId: string;
  courseId?: string;
  skillId?: string;
  description?: string;
  dueAt?: string;
  notes?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_capability_action", {
    target_title: input.title,
    target_gap_type: input.gapType,
    target_membership_id: input.membershipId,
    ...(input.courseId ? { target_course_id: input.courseId } : {}),
    ...(input.skillId ? { target_skill_id: input.skillId } : {}),
    ...(input.description ? { target_description: input.description } : {}),
    ...(input.notes ? { target_notes: input.notes } : {}),
    ...(input.dueAt ? { target_due_at: input.dueAt } : {}),
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/actions");
  return { actionId: data as string };
}

export async function createCourseSuccessorVersion(courseId: string) {
  await requireTrainingCatalogManagePermission();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_training_course_successor_version",
    {
      target_course_id: courseId,
    },
  );
  if (error) return { error: error.message };
  revalidatePath(`/platform/training/courses/${courseId}`);
  return { versionId: data as string };
}

export async function createCourseSuccessorFromForm(formData: FormData) {
  const courseId = String(formData.get("courseId"));
  await createCourseSuccessorVersion(courseId);
}

export async function createTrainingCourseAction(
  _previousState: {
    error?: string;
    name?: string;
    category?: string;
    description?: string;
    customCode?: string;
  },
  formData: FormData,
) {
  await requireTrainingCatalogManagePermission();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const customCode = String(formData.get("customCode") ?? "").trim();
  const preserved = { name, category, description, customCode };

  if (!name) {
    return { ...preserved, error: "Course name is required." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existingCourses, error: existingError } = await supabase
    .from("training_courses")
    .select("code");

  if (existingError) {
    return {
      ...preserved,
      error: existingError.message,
    };
  }

  const codeResult = resolveTrainingCourseCreateCode({
    name,
    ...(customCode ? { customCode } : {}),
    existingCodes: (existingCourses ?? []).map((course) => course.code),
  });

  if (!codeResult.ok) {
    return { ...preserved, error: codeResult.message };
  }

  const { data, error } = await supabase.rpc("create_training_course_draft", {
    target_name: name,
    target_code: codeResult.code,
    ...(category ? { target_category: category } : {}),
    ...(description ? { target_description: description } : {}),
  });

  if (error) {
    return {
      ...preserved,
      error: mapTrainingCourseCreateError(error.message),
    };
  }

  revalidatePath("/platform/training");
  revalidatePath("/platform/training/courses");
  revalidatePath("/platform/setup");
  redirect(`/platform/training/courses/${data as string}`);
}

export async function updateTrainingCourseDraftFromForm(formData: FormData) {
  await requireTrainingCatalogManagePermission();

  const courseId = String(formData.get("courseId") ?? "").trim();
  const versionId = String(formData.get("versionId") ?? "").trim();
  const deliveryMethod = String(formData.get("deliveryMethod") ?? "").trim();
  const learningObjectives = String(
    formData.get("learningObjectives") ?? "",
  ).trim();
  const trainerRequirements = String(
    formData.get("trainerRequirements") ?? "",
  ).trim();
  const durationRaw = String(formData.get("durationMinutes") ?? "").trim();
  const validityRaw = String(formData.get("validityDays") ?? "").trim();

  if (!courseId || !versionId) {
    throw new Error("Course version is required.");
  }

  const durationMinutes = durationRaw ? Number(durationRaw) : null;
  const validityDays = validityRaw ? Number(validityRaw) : null;

  if (
    durationMinutes != null &&
    (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
  ) {
    throw new Error("Duration must be a positive number of minutes.");
  }

  if (
    validityDays != null &&
    (!Number.isFinite(validityDays) || validityDays <= 0)
  ) {
    throw new Error("Validity must be a positive number of days.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_training_course_draft_version", {
    target_course_version_id: versionId,
    ...(durationMinutes != null
      ? { target_duration_minutes: durationMinutes }
      : {}),
    ...(learningObjectives
      ? { target_learning_objectives: learningObjectives }
      : {}),
    ...(validityDays != null ? { target_validity_days: validityDays } : {}),
    ...(deliveryMethod ? { target_delivery_method: deliveryMethod } : {}),
    ...(trainerRequirements
      ? { target_trainer_requirements: trainerRequirements }
      : {}),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/platform/training");
  revalidatePath("/platform/training/courses");
  revalidatePath(`/platform/training/courses/${courseId}`);
  redirect(
    buildAuthoringSavedRedirectPath(
      `/platform/training/courses/${courseId}`,
      "course",
    ),
  );
}

export async function publishTrainingCourseFromForm(formData: FormData) {
  await requireTrainingCatalogManagePermission();

  const courseId = String(formData.get("courseId") ?? "").trim();
  const versionId = String(formData.get("versionId") ?? "").trim();

  if (!courseId || !versionId) {
    throw new Error("Course version is required.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_training_course_version", {
    target_course_version_id: versionId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/platform/training");
  revalidatePath("/platform/training/courses");
  revalidatePath(`/platform/training/courses/${courseId}`);
  redirect(
    buildAuthoringSavedRedirectPath(
      `/platform/training/courses/${courseId}`,
      "publish",
    ),
  );
}
