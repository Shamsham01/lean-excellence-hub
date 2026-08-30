import {
  decryptCredential,
  postgresByteaToBytes,
} from "./credential-crypto.ts";

export type WorkforceImportExportDependencies = {
  readEnv: (name: string) => string | undefined;
  createUserClient: (accessToken: string) => {
    auth: {
      getUser: () => Promise<{
        data: { user: { id: string } | null };
        error: Error | null;
      }>;
    };
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: Error | null }>;
  };
  createServiceClient: () => {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>;
  };
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

export async function handleWorkforceImportExportRequest(
  request: Request,
  dependencies: WorkforceImportExportDependencies,
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
    credential_ciphertext: string | number[];
    credential_nonce: string | number[];
  }>) {
    const password = await decryptCredential(
      postgresByteaToBytes(row.credential_ciphertext),
      postgresByteaToBytes(row.credential_nonce),
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
    return jsonResponse(
      { error: "Unable to finalise credential export." },
      500,
    );
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
