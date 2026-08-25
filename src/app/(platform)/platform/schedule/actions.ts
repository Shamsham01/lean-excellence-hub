"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { buildRecurrenceFromForm } from "@/lib/schedule/recurrence";
import type { ScheduleRecurrence } from "@/lib/schedule/recurrence";
import { recurrenceToJson } from "@/lib/schedule/recurrence";

type SchedulePayload = {
  activityResourceId: string;
  title: string;
  description?: string | null;
  unitId: string;
  ownerMembershipId: string;
  participantMembershipIds: string[];
  startDate: string;
  endDate?: string | null;
  isAllDay: boolean;
  localTime?: string | null;
  recurrence: ScheduleRecurrence;
};

function buildRpcArgs(payload: SchedulePayload) {
  const rpcArgs: {
    target_activity_resource_id: string;
    target_title: string;
    target_unit_id: string;
    target_owner_membership_id: string;
    target_recurrence: Json;
    target_start_date: string;
    target_is_all_day: boolean;
    target_local_time?: string;
    target_end_date?: string;
    target_description?: string;
    target_participant_membership_ids?: string[];
  } = {
    target_activity_resource_id: payload.activityResourceId,
    target_title: payload.title,
    target_unit_id: payload.unitId,
    target_owner_membership_id: payload.ownerMembershipId,
    target_recurrence: recurrenceToJson(payload.recurrence),
    target_start_date: payload.startDate,
    target_is_all_day: payload.isAllDay,
  };

  if (!payload.isAllDay && payload.localTime) {
    rpcArgs.target_local_time = payload.localTime;
  }
  if (payload.endDate) {
    rpcArgs.target_end_date = payload.endDate;
  }
  if (payload.description) {
    rpcArgs.target_description = payload.description;
  }
  if (payload.participantMembershipIds.length) {
    rpcArgs.target_participant_membership_ids =
      payload.participantMembershipIds;
  }

  return rpcArgs;
}

export async function createScheduleFromPayload(payload: SchedulePayload) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_schedule_definition",
    buildRpcArgs(payload),
  );
  if (error) return { error: error.message };
  revalidatePath("/platform/schedule");
  return { scheduleId: data as string };
}

export async function updateScheduleFromPayload(
  scheduleId: string,
  payload: SchedulePayload,
) {
  const supabase = await createServerSupabaseClient();
  const rpcArgs = {
    target_schedule_definition_id: scheduleId,
    ...buildRpcArgs(payload),
  };
  const { error } = await supabase.rpc("update_schedule_definition", rpcArgs);
  if (error) return { error: error.message };
  revalidatePath("/platform/schedule");
  revalidatePath(`/platform/schedule/${scheduleId}`);
  return { ok: true };
}

export async function deactivateSchedule(scheduleId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_schedule_definition", {
    target_schedule_definition_id: scheduleId,
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/schedule");
  revalidatePath(`/platform/schedule/${scheduleId}`);
  return { ok: true };
}

export async function deactivateScheduleFromForm(formData: FormData) {
  const scheduleId = String(formData.get("scheduleId"));
  await deactivateSchedule(scheduleId);
  redirect("/platform/schedule");
}

function payloadFromFormData(
  formData: FormData,
  activityResourceId: string,
): SchedulePayload {
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

export async function createScheduleFromForm(formData: FormData) {
  const activityResourceId = String(formData.get("activityResourceId"));
  const returnTo = String(formData.get("returnTo") ?? "/platform/schedule");
  const result = await createScheduleFromPayload(
    payloadFromFormData(formData, activityResourceId),
  );
  if (result.error) {
    throw new Error(result.error);
  }
  redirect(returnTo);
}

export async function updateScheduleFromForm(formData: FormData) {
  const scheduleId = String(formData.get("scheduleId"));
  const activityResourceId = String(formData.get("activityResourceId"));
  const result = await updateScheduleFromPayload(
    scheduleId,
    payloadFromFormData(formData, activityResourceId),
  );
  if (result.error) {
    throw new Error(result.error);
  }
  redirect(`/platform/schedule/${scheduleId}`);
}
