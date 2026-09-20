import type { Json } from "@/platform/supabase/database.types";
import type { ScheduleRecurrence } from "@/lib/schedule/recurrence";
import { recurrenceToJson } from "@/lib/schedule/recurrence";

export type ScheduleMutationPayload = {
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

type SharedScheduleRpcArgs = {
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
};

function buildSharedScheduleRpcArgs(
  payload: ScheduleMutationPayload,
): SharedScheduleRpcArgs {
  const rpcArgs: SharedScheduleRpcArgs = {
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

export function buildCreateScheduleRpcArgs(payload: ScheduleMutationPayload) {
  return {
    target_activity_resource_id: payload.activityResourceId,
    ...buildSharedScheduleRpcArgs(payload),
  };
}

export function buildUpdateScheduleRpcArgs(
  scheduleId: string,
  payload: ScheduleMutationPayload,
) {
  return {
    target_schedule_definition_id: scheduleId,
    ...buildSharedScheduleRpcArgs(payload),
  };
}
