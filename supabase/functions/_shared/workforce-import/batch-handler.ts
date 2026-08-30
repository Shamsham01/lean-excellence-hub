import { generateWorkforceTemporaryPassword } from "@workforce/password";

import {
  decryptCredential,
  encryptCredential,
} from "../workforce-import/credential-crypto.ts";
import {
  handleWorkforceProvisionRequest,
  type WorkforceProvisionDependencies,
} from "../workforce-provision/handler.ts";

export type WorkforceImportBatchDependencies = WorkforceProvisionDependencies & {
  encryptCredential: typeof encryptCredential;
};

type BatchRequestBody = {
  importJobId?: string;
  batchSize?: number;
};

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function provisionImportRow(
  dependencies: WorkforceImportBatchDependencies,
  accessToken: string,
  importRowId: string,
  intentId: string,
): Promise<{ ok: true; membershipId: string } | { ok: false; error: string; needsRemediation?: boolean }> {
  const provisionResponse = await handleWorkforceProvisionRequest(
    new Request("http://local/workforce-provision", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ intentId }),
    }),
    dependencies,
  );

  let payload: {
    ok?: boolean;
    error?: string;
    temporaryPassword?: string;
    membershipId?: string;
  } | null = null;

  try {
    payload = await provisionResponse.json();
  } catch {
    return { ok: false, error: "Unable to complete workforce provisioning." };
  }

  if (!provisionResponse.ok || !payload?.temporaryPassword || !payload.membershipId) {
    return {
      ok: false,
      error: payload?.error ?? "Unable to complete workforce provisioning.",
    };
  }

  try {
    const encrypted = await dependencies.encryptCredential(
      payload.temporaryPassword,
      dependencies.readEnv,
    );

    const service = dependencies.createServiceClient();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: storeError } = await service.rpc(
      "store_workforce_import_row_credential",
      {
        target_import_row_id: importRowId,
        target_ciphertext: Array.from(encrypted.ciphertext),
        target_nonce: Array.from(encrypted.nonce),
        target_expires_at: expiresAt,
      },
    );

    if (storeError) {
      return { ok: false, error: "Unable to store encrypted credentials." };
    }

    const { error: successError } = await service.rpc(
      "record_workforce_import_row_success",
      {
        target_import_row_id: importRowId,
        target_membership_id: payload.membershipId,
      },
    );

    if (successError) {
      return { ok: false, error: "Unable to record provisioning success." };
    }

    return { ok: true, membershipId: payload.membershipId };
  } catch {
    return { ok: false, error: "Unable to secure temporary credentials." };
  }
}

export async function handleWorkforceImportBatchRequest(
  request: Request,
  dependencies: WorkforceImportBatchDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  let body: BatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const importJobId = body.importJobId?.trim();
  if (!importJobId) {
    return jsonResponse({ error: "importJobId is required." }, 400);
  }

  const batchSize = Math.min(Math.max(body.batchSize ?? 25, 1), 50);

  const userClient = dependencies.createUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const userSupabase = dependencies.createUserClient(accessToken);
  const { data: claimedRows, error: claimError } = await userSupabase.rpc(
    "claim_workforce_import_batch",
    {
      target_import_job_id: importJobId,
      target_batch_size: batchSize,
    },
  );

  if (claimError) {
    return jsonResponse({ error: "Unable to claim import batch." }, 500);
  }

  const rows = (claimedRows ?? []) as Array<{
    import_row_id: string;
    provisioning_intent_id: string;
  }>;

  let succeeded = 0;
  let failed = 0;
  let remediation = 0;

  for (const row of rows) {
    const outcome = await provisionImportRow(
      dependencies,
      accessToken,
      row.import_row_id,
      row.provisioning_intent_id,
    );

    if (outcome.ok) {
      succeeded += 1;
      continue;
    }

    const service = dependencies.createServiceClient();
    const needsRemediation = outcome.needsRemediation === true;
    await service.rpc("record_workforce_import_row_failure", {
      target_import_row_id: row.import_row_id,
      target_error_code: "provision_failed",
      target_error_message: outcome.error,
      target_needs_remediation: needsRemediation,
    });

    if (needsRemediation) {
      remediation += 1;
    } else {
      failed += 1;
    }
  }

  const { data: progress } = await userSupabase.rpc(
    "get_workforce_import_job_progress",
    { target_import_job_id: importJobId },
  );

  return jsonResponse({
    ok: true,
    claimed: rows.length,
    succeeded,
    failed,
    remediation,
    progress,
  });
}

export async function handleWorkforceImportExportRequest(
  request: Request,
  dependencies: WorkforceImportBatchDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  let body: { importJobId?: string; organisationCode?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const importJobId = body.importJobId?.trim();
  const organisationCode = body.organisationCode?.trim();
  if (!importJobId || !organisationCode) {
    return jsonResponse(
      { error: "importJobId and organisationCode are required." },
      400,
    );
  }

  const userClient = dependencies.createUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const service = dependencies.createServiceClient();
  const { data: exportRows, error: exportError } = await service.rpc(
    "get_workforce_import_credential_export_rows",
    { target_import_job_id: importJobId },
  );

  if (exportError || !Array.isArray(exportRows) || exportRows.length === 0) {
    return jsonResponse({ error: "Credential export is not available." }, 404);
  }

  const csvLines = [
    "first_name,last_name,username,organisation_code,temporary_password,job_title,primary_work_area",
  ];

  for (const row of exportRows as Array<{
    first_name: string;
    last_name: string;
    username: string;
    job_title: string | null;
    primary_unit_path: string | null;
    credential_ciphertext: number[];
    credential_nonce: number[];
  }>) {
    const password = await decryptCredential(
      new Uint8Array(row.credential_ciphertext),
      new Uint8Array(row.credential_nonce),
      dependencies.readEnv,
    );

    const values = [
      row.first_name,
      row.last_name,
      row.username,
      organisationCode,
      password,
      row.job_title ?? "",
      row.primary_unit_path ?? "",
    ].map((value) => {
      const sanitized = /^[=+\-@]/.test(value.trim())
        ? `'${value.trim()}`
        : value.trim();
      if (/[",\n]/.test(sanitized)) {
        return `"${sanitized.replace(/"/g, '""')}"`;
      }
      return sanitized;
    });

    csvLines.push(values.join(","));
  }

  const { error: invalidateError } = await userClient.rpc(
    "mark_workforce_import_credentials_exported",
    { target_import_job_id: importJobId },
  );

  if (invalidateError) {
    return jsonResponse({ error: "Unable to finalise credential export." }, 500);
  }

  return new Response(`${csvLines.join("\n")}\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workforce-credentials-${importJobId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export { generateWorkforceTemporaryPassword };
