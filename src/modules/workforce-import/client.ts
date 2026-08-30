import "server-only";

import { getPublicEnvironment } from "@/platform/env";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { WORKFORCE_IMPORT_BATCH_SIZE } from "./constants";

type ImportBatchResponse =
  | {
      ok: true;
      claimed: number;
      succeeded: number;
      failed: number;
      remediation: number;
      progress: Record<string, unknown>;
    }
  | { error: string };

export async function invokeWorkforceImportFinalize(input: {
  importRowId: string;
  outcome: "success";
  membershipId: string;
  temporaryPassword: string;
}): Promise<{ ok: true } | { error: string }>;
export async function invokeWorkforceImportFinalize(input: {
  importRowId: string;
  outcome: "failure";
  errorMessage: string;
  needsRemediation?: boolean;
}): Promise<{ ok: true } | { error: string }>;
export async function invokeWorkforceImportFinalize(
  input:
    | {
        importRowId: string;
        outcome: "success";
        membershipId: string;
        temporaryPassword: string;
      }
    | {
        importRowId: string;
        outcome: "failure";
        errorMessage: string;
        needsRemediation?: boolean;
      },
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { error: "Your session has expired. Sign in again and retry." };
  }

  const publicEnvironment = getPublicEnvironment();
  const response = await fetch(
    `${publicEnvironment.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workforce-import-finalize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );

  let payload: { ok?: boolean; error?: string } | null = null;
  try {
    payload = (await response.json()) as { ok?: boolean; error?: string };
  } catch {
    return { error: "Unable to finalise workforce import row." };
  }

  if (!response.ok || !payload?.ok) {
    return {
      error: payload?.error ?? "Unable to finalise workforce import row.",
    };
  }

  return { ok: true };
}

export async function invokeWorkforceImportBatch(
  importJobId: string,
  batchSize = WORKFORCE_IMPORT_BATCH_SIZE,
): Promise<ImportBatchResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { error: "Your session has expired. Sign in again and retry." };
  }

  const publicEnvironment = getPublicEnvironment();
  const response = await fetch(
    `${publicEnvironment.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workforce-import-batch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ importJobId, batchSize }),
      cache: "no-store",
    },
  );

  let payload: ImportBatchResponse | null = null;
  try {
    payload = (await response.json()) as ImportBatchResponse;
  } catch {
    return { error: "Unable to process workforce import batch." };
  }

  if (!response.ok || !payload || "error" in payload) {
    return {
      error:
        payload && "error" in payload
          ? payload.error
          : "Unable to process workforce import batch.",
    };
  }

  return payload;
}

export async function invokeWorkforceImportCredentialExport(
  importJobId: string,
  organisationCode: string,
): Promise<{ ok: true; csv: string } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { error: "Your session has expired. Sign in again and retry." };
  }

  const publicEnvironment = getPublicEnvironment();
  const response = await fetch(
    `${publicEnvironment.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workforce-import-export`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ importJobId, organisationCode }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message = "Credential export is not available.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep default message.
    }
    return { error: message };
  }

  const csv = await response.text();
  return { ok: true, csv };
}
