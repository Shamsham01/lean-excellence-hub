"use server";

import { revalidatePath } from "next/cache";

import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { invokeWorkforceProvision } from "@/modules/workforce-provision/client";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type CreateWorkforceUserInput = {
  displayName: string;
  username: string;
  jobTitle?: string;
  notificationEmail?: string;
  roleVersionId: string;
  scopeType: string;
  scopeUnitId: string | null;
  jobFunctionId?: string;
  organisationalUnitId?: string;
  idempotencyKey?: string;
};

export type CreateWorkforceUserResult =
  | {
      ok: true;
      organisationCode: string;
      username: string;
      displayName: string;
      temporaryPassword?: string;
      credentialsRecovered?: boolean;
    }
  | { error: string };

export async function createWorkforceUser(
  input: CreateWorkforceUserInput,
): Promise<CreateWorkforceUserResult> {
  const canProvision = await currentMemberHasPermission("workforce.provision");
  if (!canProvision) {
    return { error: "You do not have permission to create workforce users." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: intentId, error: preauthorizeError } = await supabase.rpc(
    "preauthorize_workforce_provision",
    {
      target_display_name: input.displayName.trim(),
      target_canonical_alias: input.username.trim().toLowerCase(),
      target_role_version_id: input.roleVersionId,
      target_scope_type: input.scopeType,
      ...(input.scopeUnitId ? { target_scope_unit_id: input.scopeUnitId } : {}),
      ...(input.jobTitle ? { target_job_title: input.jobTitle.trim() } : {}),
      ...(input.notificationEmail
        ? { target_notification_email: input.notificationEmail.trim() }
        : {}),
      ...(input.jobFunctionId
        ? { target_job_function_id: input.jobFunctionId }
        : {}),
      ...(input.organisationalUnitId
        ? { target_organisational_unit_id: input.organisationalUnitId }
        : {}),
      ...(input.idempotencyKey
        ? { target_idempotency_key: input.idempotencyKey }
        : {}),
    },
  );

  if (preauthorizeError || !intentId) {
    if (preauthorizeError?.code === "23505") {
      return {
        error:
          "That username is already in use or reserved. Choose a different username.",
      };
    }

    return {
      error: toCustomerErrorMessage(
        preauthorizeError,
        "Unable to start workforce provisioning. Check the details and try again.",
      ),
    };
  }

  const provisionResult = await invokeWorkforceProvision(intentId);
  if ("error" in provisionResult) {
    return { error: provisionResult.error };
  }

  revalidatePath("/platform/settings/people");
  revalidatePath("/platform/people");

  return {
    ok: true,
    organisationCode: provisionResult.organisationCode,
    username: provisionResult.username,
    displayName: provisionResult.displayName,
    ...(provisionResult.temporaryPassword
      ? { temporaryPassword: provisionResult.temporaryPassword }
      : {}),
    ...(provisionResult.credentialsRecovered
      ? { credentialsRecovered: true }
      : {}),
  };
}
