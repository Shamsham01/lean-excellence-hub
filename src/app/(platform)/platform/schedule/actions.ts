"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mapScheduleMutationError } from "@/lib/schedule/errors";
import { buildRecurrenceFromForm } from "@/lib/schedule/recurrence";
import {
  buildCreateScheduleRpcArgs,
  buildUpdateScheduleRpcArgs,
  type ScheduleMutationPayload,
} from "@/lib/schedule/rpc-args";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type ScheduleFormState = {
  error?: string;
};

export type ScheduleLifecycleState = {
  error?: string;
};

function payloadFromFormData(
  formData: FormData,
  activityResourceId: string,
): ScheduleMutationPayload {
  const isAllDay = formData.get("isAllDay") === "on";
  const localTimeRaw = String(formData.get("localTime") ?? "");
  return {
    activityResourceId,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    unitId: String(formData.get("unitId")),
    ownerMembershipId: String(formData.get("ownerMembershipId")),
    participantMembershipIds: formData
      .getAll("participantMembershipIds")
      .map(String),
    startDate: String(formData.get("startDate")),
    endDate: String(formData.get("endDate") ?? "").trim() || null,
    isAllDay,
    localTime: isAllDay
      ? null
      : localTimeRaw
        ? `${localTimeRaw}:00`
        : "09:00:00",
    recurrence: buildRecurrenceFromForm(formData),
  };
}

function revalidateSchedulePaths(scheduleId?: string) {
  revalidatePath("/platform/schedule");
  if (scheduleId) {
    revalidatePath(`/platform/schedule/${scheduleId}`);
    revalidatePath(`/platform/schedule/${scheduleId}/edit`);
  }
}

export async function createScheduleFromPayload(
  payload: ScheduleMutationPayload,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_schedule_definition",
    buildCreateScheduleRpcArgs(payload),
  );
  if (error) return { error: mapScheduleMutationError(error) };
  revalidateSchedulePaths();
  return { scheduleId: data as string };
}

export async function updateScheduleFromPayload(
  scheduleId: string,
  payload: ScheduleMutationPayload,
) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(
    "update_schedule_definition",
    buildUpdateScheduleRpcArgs(scheduleId, payload),
  );
  if (error) return { error: mapScheduleMutationError(error) };
  revalidateSchedulePaths(scheduleId);
  return { ok: true as const };
}

export async function deactivateSchedule(scheduleId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_schedule_definition", {
    target_schedule_definition_id: scheduleId,
  });
  if (error) return { error: mapScheduleMutationError(error) };
  revalidateSchedulePaths(scheduleId);
  return { ok: true as const };
}

export async function reactivateSchedule(scheduleId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reactivate_schedule_definition", {
    target_schedule_definition_id: scheduleId,
  });
  if (error) return { error: mapScheduleMutationError(error) };
  revalidateSchedulePaths(scheduleId);
  return { ok: true as const };
}

export async function createScheduleFromForm(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const activityResourceId = String(formData.get("activityResourceId"));
  const returnTo = String(formData.get("returnTo") ?? "/platform/schedule");
  const result = await createScheduleFromPayload(
    payloadFromFormData(formData, activityResourceId),
  );
  if (result.error) {
    return { error: result.error };
  }
  redirect(returnTo);
}

export async function updateScheduleFromForm(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const scheduleId = String(formData.get("scheduleId"));
  const activityResourceId = String(formData.get("activityResourceId"));
  const result = await updateScheduleFromPayload(
    scheduleId,
    payloadFromFormData(formData, activityResourceId),
  );
  if (result.error) {
    return { error: result.error };
  }
  redirect(`/platform/schedule/${scheduleId}`);
}

export async function deactivateScheduleFromForm(
  _prev: ScheduleLifecycleState,
  formData: FormData,
): Promise<ScheduleLifecycleState> {
  const scheduleId = String(formData.get("scheduleId"));
  const result = await deactivateSchedule(scheduleId);
  if (result.error) {
    return { error: result.error };
  }
  redirect(`/platform/schedule/${scheduleId}`);
}

export async function reactivateScheduleFromForm(
  _prev: ScheduleLifecycleState,
  formData: FormData,
): Promise<ScheduleLifecycleState> {
  const scheduleId = String(formData.get("scheduleId"));
  const result = await reactivateSchedule(scheduleId);
  if (result.error) {
    return { error: result.error };
  }
  redirect(`/platform/schedule/${scheduleId}`);
}
