"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

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
