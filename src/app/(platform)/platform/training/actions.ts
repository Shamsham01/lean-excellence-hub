"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildAuthoringSavedRedirectPath } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  buildTrainingEvidenceRequirements,
  isTrainingDeliveryMethod,
  optionalPositiveInteger,
} from "@/modules/training/catalog-admin";
import { validateTrainingCourseCode } from "@/modules/training/catalog-code";
import {
  toTrainingCatalogErrorMessage,
  trainingCatalogManageDeniedMessage,
} from "@/modules/training/catalog-errors";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const CATALOGUE_PATHS = [
  "/platform/training",
  "/platform/training/courses",
  "/platform/setup",
] as const;

async function requireTrainingCatalogManage() {
  const canManage = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.catalogManage,
  );

  if (!canManage) {
    return { error: trainingCatalogManageDeniedMessage() };
  }

  return null;
}

function revalidateTrainingCatalogue(courseId?: string) {
  for (const path of CATALOGUE_PATHS) {
    revalidatePath(path);
  }

  if (courseId) {
    revalidatePath(`/platform/training/courses/${courseId}`);
  }
}

export async function createTrainingCourseDraft(input: {
  name: string;
  code: string;
  category?: string;
  description?: string;
}) {
  const denied = await requireTrainingCatalogManage();
  if (denied) {
    return denied;
  }

  const name = input.name.trim();
  if (!name) {
    return { error: "Enter a course name." };
  }
  if (name.length > 160) {
    return { error: "Course name must be 160 characters or fewer." };
  }

  const codeResult = validateTrainingCourseCode(input.code);
  if (!codeResult.ok) {
    return { error: codeResult.message };
  }

  const category = input.category?.trim() || undefined;
  const description = input.description?.trim() || undefined;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_training_course_draft", {
    target_name: name,
    target_code: codeResult.normalised,
    ...(category ? { target_category: category } : {}),
    ...(description ? { target_description: description } : {}),
  });

  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "Unable to create this course. Check the details and try again.",
      ),
    };
  }

  revalidateTrainingCatalogue(data as string);
  return { courseId: data as string };
}

export async function updateTrainingCourseDraftVersion(input: {
  courseId: string;
  versionId: string;
  durationMinutes?: string | number | null;
  validityDays?: string | number | null;
  deliveryMethod?: string | null;
  learningObjectives?: string | null;
  trainerRequirements?: string | null;
  evidenceNotes?: string | null;
}) {
  const denied = await requireTrainingCatalogManage();
  if (denied) {
    return denied;
  }

  const courseId = input.courseId.trim();
  const versionId = input.versionId.trim();
  if (!courseId || !versionId) {
    return { error: "Choose a course draft to update." };
  }

  const duration = optionalPositiveInteger(input.durationMinutes);
  if (!duration.ok) {
    return { error: duration.message };
  }

  const validity = optionalPositiveInteger(input.validityDays);
  if (!validity.ok) {
    return { error: validity.message };
  }

  const deliveryMethod = input.deliveryMethod?.trim() || null;
  if (deliveryMethod && !isTrainingDeliveryMethod(deliveryMethod)) {
    return { error: "Choose a supported delivery method." };
  }

  const learningObjectives = input.learningObjectives?.trim() || undefined;
  const trainerRequirements = input.trainerRequirements?.trim() || undefined;
  const evidenceRequirements = buildTrainingEvidenceRequirements(
    input.evidenceNotes,
  );
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_training_course_draft_version", {
    target_course_version_id: versionId,
    ...(duration.value != null
      ? { target_duration_minutes: duration.value }
      : {}),
    ...(validity.value != null ? { target_validity_days: validity.value } : {}),
    ...(deliveryMethod ? { target_delivery_method: deliveryMethod } : {}),
    ...(learningObjectives
      ? { target_learning_objectives: learningObjectives }
      : {}),
    ...(trainerRequirements
      ? { target_trainer_requirements: trainerRequirements }
      : {}),
    ...(evidenceRequirements
      ? { target_evidence_requirements: evidenceRequirements }
      : {}),
  });

  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "Unable to save this draft. Your entries were kept so you can try again.",
      ),
    };
  }

  revalidateTrainingCatalogue(courseId);
  return { ok: true as const };
}

export async function publishTrainingCourseVersion(input: {
  courseId: string;
  versionId: string;
}) {
  const denied = await requireTrainingCatalogManage();
  if (denied) {
    return denied;
  }

  const courseId = input.courseId.trim();
  const versionId = input.versionId.trim();
  if (!courseId || !versionId) {
    return { error: "Choose a course draft to publish." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_training_course_version", {
    target_course_version_id: versionId,
  });

  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "Unable to publish this course. Try again.",
      ),
    };
  }

  revalidateTrainingCatalogue(courseId);
  return { ok: true as const };
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
  const denied = await requireTrainingCatalogManage();
  if (denied) {
    return denied;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_training_course_successor_version",
    {
      target_course_id: courseId,
    },
  );
  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "Unable to create a successor draft for this course.",
      ),
    };
  }
  revalidateTrainingCatalogue(courseId);
  return { versionId: data as string };
}

export async function createCourseSuccessorFromForm(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const result = await createCourseSuccessorVersion(courseId);
  if ("error" in result) {
    throw new Error(result.error);
  }
  redirect(
    buildAuthoringSavedRedirectPath(
      `/platform/training/courses/${courseId}`,
      "successor",
    ),
  );
}
