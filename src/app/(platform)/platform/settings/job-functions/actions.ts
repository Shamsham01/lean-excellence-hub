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
  revalidatePath("/onboarding/setup");

  return { ok: true as const };
}

export async function updateJobFunction(input: {
  jobFunctionId: string;
  name: string;
  description?: string;
}) {
  const canManage = await currentMemberHasPermission("job_functions.manage");
  if (!canManage) {
    return { error: "You are not authorised to update job functions." };
  }

  if (!input.name.trim()) {
    return { error: "Enter a job function name." };
  }

  const supabase = await createServerSupabaseClient();
  const rpcArgs: {
    target_job_function_id: string;
    target_name: string;
    target_description?: string;
  } = {
    target_job_function_id: input.jobFunctionId,
    target_name: input.name.trim(),
  };
  if (input.description !== undefined) {
    rpcArgs.target_description = input.description;
  }

  const { error } = await supabase.rpc("update_job_function", rpcArgs);
  if (error) {
    if (error.code === "42501") {
      return { error: "You are not authorised to update job functions." };
    }
    return { error: "Unable to update the job function. Check the details." };
  }

  revalidatePath("/platform/settings/job-functions");
  revalidatePath("/platform/setup");
  revalidatePath("/platform");
  revalidatePath("/onboarding/setup");
  return { ok: true as const };
}

export async function deactivateJobFunction(jobFunctionId: string) {
  const canManage = await currentMemberHasPermission("job_functions.manage");
  if (!canManage) {
    return { error: "You are not authorised to remove job functions." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_job_function", {
    target_job_function_id: jobFunctionId,
  });
  if (error) {
    if (error.code === "42501") {
      return { error: "You are not authorised to remove job functions." };
    }
    return { error: "Unable to remove the job function." };
  }

  revalidatePath("/platform/settings/job-functions");
  revalidatePath("/platform/setup");
  revalidatePath("/platform");
  revalidatePath("/onboarding/setup");
  return { ok: true as const };
}
