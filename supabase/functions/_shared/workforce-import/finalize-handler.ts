import { createClient } from "npm:@supabase/supabase-js@2.49.8";

import {
  encryptCredential,
  bytesToPostgresBytea,
} from "./credential-crypto.ts";

type FinalizeSuccessBody = {
  importRowId?: string;
  membershipId?: string;
  temporaryPassword?: string;
};

type FinalizeFailureBody = {
  importRowId?: string;
  errorMessage?: string;
  needsRemediation?: boolean;
};

type FinalizeRequestBody = FinalizeSuccessBody &
  FinalizeFailureBody & {
    outcome?: "success" | "failure";
  };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function assertCanAccessImportRow(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string,
  importRowId: string,
): Promise<boolean> {
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await userClient
    .from("workforce_import_rows")
    .select("id")
    .eq("id", importRowId)
    .maybeSingle();

  return !error && data?.id === importRowId;
}

export async function handleWorkforceImportFinalizeRequest(
  request: Request,
  dependencies: {
    readEnv: (name: string) => string | undefined;
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
  },
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  let body: FinalizeRequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const importRowId = body.importRowId?.trim();
  const outcome = body.outcome?.trim();
  if (!importRowId || (outcome !== "success" && outcome !== "failure")) {
    return jsonResponse(
      { error: "importRowId and outcome are required." },
      400,
    );
  }

  const canAccess = await assertCanAccessImportRow(
    dependencies.supabaseUrl,
    dependencies.supabaseAnonKey,
    accessToken,
    importRowId,
  );
  if (!canAccess) {
    return jsonResponse({ error: "Import row is not available." }, 403);
  }

  const service = createClient(
    dependencies.supabaseUrl,
    dependencies.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  if (outcome === "failure") {
    const { error } = await service.rpc("record_workforce_import_row_failure", {
      target_import_row_id: importRowId,
      target_error_code: "provision_failed",
      target_error_message:
        body.errorMessage?.trim() ||
        "Unable to complete workforce provisioning.",
      target_needs_remediation: body.needsRemediation === true,
    });

    if (error) {
      return jsonResponse(
        { error: "Unable to record import row failure." },
        500,
      );
    }

    return jsonResponse({ ok: true });
  }

  const membershipId = body.membershipId?.trim();
  const temporaryPassword = body.temporaryPassword;
  if (!membershipId || typeof temporaryPassword !== "string") {
    return jsonResponse(
      { error: "membershipId and temporaryPassword are required." },
      400,
    );
  }

  try {
    const encrypted = await encryptCredential(
      temporaryPassword,
      dependencies.readEnv,
    );
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: storeError } = await service.rpc(
      "store_workforce_import_row_credential",
      {
        target_import_row_id: importRowId,
        target_ciphertext: bytesToPostgresBytea(encrypted.ciphertext),
        target_nonce: bytesToPostgresBytea(encrypted.nonce),
        target_expires_at: expiresAt,
      },
    );

    if (storeError) {
      return jsonResponse(
        { error: "Unable to store encrypted credentials." },
        500,
      );
    }

    const { error: successError } = await service.rpc(
      "record_workforce_import_row_success",
      {
        target_import_row_id: importRowId,
        target_membership_id: membershipId,
      },
    );

    if (successError) {
      return jsonResponse(
        { error: "Unable to record provisioning success." },
        500,
      );
    }

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse(
      { error: "Unable to secure temporary credentials." },
      500,
    );
  }
}
