"use server";

import { revalidatePath } from "next/cache";

import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function createJobFunction(input: {
  name: string;
  code: string;
  description?: string;
}) {
  const canManage = await currentMemberHasPermission("job_functions.manage");
  if (!canManage) {
    return { error: "You are not authorised to create job functions." };
  }

  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_name: string;
    target_code: string;
    target_description?: string;
  } = {
    target_name: input.name,
    target_code: input.code,
  };
  if (input.description) {
    rpcArgs.target_description = input.description;
  }

  const { error } = await supabase.rpc("create_job_function", rpcArgs);

  if (error) {
    if (error.code === "42501") {
      return { error: "You are not authorised to create job functions." };
    }
    return { error: "Unable to create the job function. Check the details." };
  }

  revalidatePath("/platform/settings/job-functions");
  revalidatePath("/platform/setup");
  revalidatePath("/platform");

  return { ok: true as const };
}
