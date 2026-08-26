"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/platform/supabase/server";

type ActionResult = { error?: string; ok?: true; id?: string };

export async function awardRecognition(input: {
  recognitionTypeId: string;
  title: string;
  message: string;
  organisationalUnitId: string;
  visibility: string;
  recipientMembershipIds: string[];
  sourceResourceId?: string;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("award_recognition", {
    target_recognition_type_id: input.recognitionTypeId,
    target_title: input.title,
    target_message: input.message,
    target_organisational_unit_id: input.organisationalUnitId,
    target_visibility: input.visibility,
    target_recipient_membership_ids: input.recipientMembershipIds,
    ...(input.sourceResourceId
      ? { target_source_resource_id: input.sourceResourceId }
      : {}),
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/recognition");
  return { ok: true };
}

export async function revokeRecognition(
  awardId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("revoke_recognition", {
    target_award_id: awardId,
    target_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/recognition");
  return { ok: true };
}

export async function createRecognitionType(input: {
  name: string;
  code: string;
  description?: string;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_recognition_type", {
    target_name: input.name,
    target_code: input.code,
    ...(input.description ? { target_description: input.description } : {}),
  });
  if (error) return { error: error.message };
  revalidatePath("/platform/recognition/types");
  revalidatePath("/platform/recognition/new");
  return { ok: true, id: data as string };
}
