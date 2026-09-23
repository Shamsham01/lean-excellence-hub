"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildAuthoringSavedRedirectPath } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  buildTrainingCourseDraftUpdateArgs,
  emptyTrainingCourseDraftFields,
  mapTrainingCourseActionError,
  parseTrainingCourseDraftFields,
  resolveTrainingCourseDraftIntent,
  type TrainingCourseDraftFormState,
} from "@/modules/training/catalog-admin";
import { resolveTrainingCourseCreateCode } from "@/modules/training/catalog-code";
import { createServerSupabaseClient } from "@/platform/supabase/server";

async function trainingCatalogManageDenied(): Promise<string | null> {
  const canManage = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.catalogManage,
  );
  return canManage ? null : "Training catalogue management is not authorised.";
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
  const denied = await trainingCatalogManageDenied();
  if (denied) return { error: denied };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_training_course_successor_version",
    {
      target_course_id: courseId,
    },
  );
  if (error) return { error: mapTrainingCourseActionError(error.message) };
  revalidatePath(`/platform/training/courses/${courseId}`);
  return { versionId: data as string };
}

export type CourseSuccessorFormState = {
  error?: string;
};

export async function createCourseSuccessorAction(
  _previousState: CourseSuccessorFormState,
  formData: FormData,
): Promise<CourseSuccessorFormState> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) {
    return { error: "Course is required." };
  }

  const result = await createCourseSuccessorVersion(courseId);
  if (result.error) {
    return { error: result.error };
  }

  redirect(`/platform/training/courses/${courseId}`);
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
  const denied = await trainingCatalogManageDenied();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const customCode = String(formData.get("customCode") ?? "").trim();
  const preserved = { name, category, description, customCode };

  if (denied) {
    return { ...preserved, error: denied };
  }

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
      error: mapTrainingCourseActionError(error.message),
    };
  }

  revalidatePath("/platform/training");
  revalidatePath("/platform/training/courses");
  revalidatePath("/platform/setup");
  redirect(`/platform/training/courses/${data as string}`);
}

export async function saveOrPublishTrainingCourseDraftAction(
  _previousState: TrainingCourseDraftFormState,
  formData: FormData,
): Promise<TrainingCourseDraftFormState> {
  const parsed = parseTrainingCourseDraftFields(formData);
  const denied = await trainingCatalogManageDenied();
  const fields = parsed.ok
    ? parsed.fields
    : {
        ...emptyTrainingCourseDraftFields(),
        ...parsed.fields,
      };

  if (denied) {
    return { ...fields, error: denied };
  }

  if (!parsed.ok) {
    return { ...fields, error: parsed.message };
  }

  const intent = resolveTrainingCourseDraftIntent(formData);
  const supabase = await createServerSupabaseClient();
  const { data: version, error: versionError } = await supabase
    .from("training_course_versions")
    .select("id, status, evidence_requirements")
    .eq("id", fields.versionId)
    .eq("course_id", fields.courseId)
    .maybeSingle();

  if (versionError) {
    return {
      ...fields,
      error: versionError.message,
    };
  }

  if (!version || version.status !== "draft") {
    return {
      ...fields,
      error:
        "This draft can no longer be edited. Reload the course and try again.",
    };
  }

  const { error: updateError } = await supabase.rpc(
    "update_training_course_draft_version",
    buildTrainingCourseDraftUpdateArgs(fields, version.evidence_requirements),
  );

  if (updateError) {
    return {
      ...fields,
      error: mapTrainingCourseActionError(updateError.message),
    };
  }

  if (intent === "publish") {
    const { error: publishError } = await supabase.rpc(
      "publish_training_course_version",
      {
        target_course_version_id: fields.versionId,
      },
    );

    if (publishError) {
      return {
        ...fields,
        error: mapTrainingCourseActionError(publishError.message),
      };
    }
  }

  revalidatePath("/platform/training");
  revalidatePath("/platform/training/courses");
  revalidatePath(`/platform/training/courses/${fields.courseId}`);
  redirect(
    buildAuthoringSavedRedirectPath(
      `/platform/training/courses/${fields.courseId}`,
      intent === "publish" ? "publish" : "course",
    ),
  );
}
