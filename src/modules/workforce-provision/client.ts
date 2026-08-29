import "server-only";

import { getPublicEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type WorkforceProvisionResponse =
  | {
      ok: true;
      organisationCode: string;
      username: string;
      displayName: string;
      temporaryPassword?: string;
      membershipId: string;
      credentialsRecovered?: boolean;
    }
  | { error: string };

export async function invokeWorkforceProvision(intentId: string): Promise<
  | {
      organisationCode: string;
      username: string;
      displayName: string;
      temporaryPassword?: string;
      credentialsRecovered?: boolean;
    }
  | { error: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { error: "Your session has expired. Sign in again and retry." };
  }

  const publicEnvironment = getPublicEnvironment();
  const response = await fetch(
    `${publicEnvironment.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workforce-provision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ intentId }),
      cache: "no-store",
    },
  );

  let payload: WorkforceProvisionResponse | null = null;
  try {
    payload = (await response.json()) as WorkforceProvisionResponse;
  } catch {
    return { error: "Unable to complete workforce provisioning." };
  }

  if (!response.ok || !payload || "error" in payload) {
    return {
      error:
        payload && "error" in payload
          ? payload.error
          : "Unable to complete workforce provisioning.",
    };
  }

  return {
    organisationCode: payload.organisationCode,
    username: payload.username,
    displayName: payload.displayName,
    ...(payload.temporaryPassword
      ? { temporaryPassword: payload.temporaryPassword }
      : {}),
    ...(payload.credentialsRecovered ? { credentialsRecovered: true } : {}),
  };
}
