export type WorkforceProvisionIntent = {
  intent_id: string;
  organisation_id: string;
  organisation_code: string;
  status: string;
  target_canonical_alias: string;
  target_display_name: string;
  sealed_internal_login_identifier: string;
  created_auth_user_id: string | null;
};

export type WorkforceProvisionSuccess = {
  ok: true;
  organisationCode: string;
  username: string;
  displayName: string;
  temporaryPassword: string;
  membershipId: string;
};

export type WorkforceProvisionDependencies = {
  readEnv: (name: string) => string | undefined;
  createUserClient: (accessToken: string) => {
    auth: {
      getUser: () => Promise<{
        data: { user: { id: string } | null };
        error: { message: string } | null;
      }>;
    };
  };
  createServiceClient: () => {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: unknown;
      error: { message: string; code?: string } | null;
    }>;
  };
  createAuthAdminClient: () => {
    auth: {
      admin: {
        createUser: (input: {
          email: string;
          password: string;
          email_confirm: boolean;
          user_metadata: Record<string, string>;
        }) => Promise<{
          data: { user: { id: string } | null };
          error: { message: string } | null;
        }>;
        listUsers: () => Promise<{
          data: { users: Array<{ id: string; email?: string }> } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  generatePassword: () => string;
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

async function loadIntent(
  dependencies: WorkforceProvisionDependencies,
  intentId: string,
  callerUserId: string,
): Promise<WorkforceProvisionIntent | null> {
  const service = dependencies.createServiceClient();
  const { data, error } = await service.rpc(
    "get_workforce_provision_intent_for_worker",
    {
      target_intent_id: intentId,
      expected_caller_user_id: callerUserId,
    },
  );

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0] as WorkforceProvisionIntent;
  return row;
}

async function findAuthUserIdByEmail(
  dependencies: WorkforceProvisionDependencies,
  email: string,
): Promise<string | null> {
  const admin = dependencies.createAuthAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error || !data?.users) {
    return null;
  }

  const match = data.users.find(
    (user) => (user.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

export async function handleWorkforceProvisionRequest(
  request: Request,
  dependencies: WorkforceProvisionDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  let body: { intentId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const intentId = body.intentId?.trim();
  if (!intentId) {
    return jsonResponse({ error: "intentId is required." }, 400);
  }

  const userClient = dependencies.createUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const intent = await loadIntent(dependencies, intentId, userData.user.id);
  if (!intent) {
    return jsonResponse(
      { error: "Provisioning request is not available." },
      403,
    );
  }

  const service = dependencies.createServiceClient();

  if (intent.status === "completed") {
    return jsonResponse(
      { error: "This provisioning request has already completed." },
      409,
    );
  }

  let authUserId = intent.created_auth_user_id;
  let temporaryPassword: string | null = null;

  if (!authUserId) {
    temporaryPassword = dependencies.generatePassword();
    const admin = dependencies.createAuthAdminClient();
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: intent.sealed_internal_login_identifier,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          workforce_provision_intent_id: intent.intent_id,
        },
      });

    if (createError || !created.user?.id) {
      const existingUserId = await findAuthUserIdByEmail(
        dependencies,
        intent.sealed_internal_login_identifier,
      );

      if (!existingUserId) {
        await service.rpc("fail_workforce_provision", {
          target_intent_id: intentId,
          target_failure_reason: "auth user creation failed",
        });
        return jsonResponse(
          { error: "Unable to complete workforce provisioning." },
          500,
        );
      }

      authUserId = existingUserId;
    } else {
      authUserId = created.user.id;
    }

    const { error: recordError } = await service.rpc(
      "record_workforce_auth_created",
      {
        target_intent_id: intentId,
        target_auth_user_id: authUserId,
      },
    );

    if (recordError) {
      await service.rpc("fail_workforce_provision", {
        target_intent_id: intentId,
        target_failure_reason: "failed to record auth creation",
      });
      return jsonResponse(
        { error: "Unable to complete workforce provisioning." },
        500,
      );
    }
  }

  const { data: membershipId, error: finalizeError } = await service.rpc(
    "finalize_workforce_provision",
    {
      target_intent_id: intentId,
      target_auth_user_id: authUserId,
    },
  );

  if (finalizeError || typeof membershipId !== "string") {
    await service.rpc("fail_workforce_provision", {
      target_intent_id: intentId,
      target_failure_reason: "finalisation failed",
    });
    return jsonResponse(
      { error: "Unable to complete workforce provisioning." },
      500,
    );
  }

  if (!temporaryPassword) {
    return jsonResponse({
      ok: true,
      organisationCode: intent.organisation_code,
      username: intent.target_canonical_alias,
      displayName: intent.target_display_name,
      membershipId,
      credentialsRecovered: true,
    });
  }

  const result: WorkforceProvisionSuccess = {
    ok: true,
    organisationCode: intent.organisation_code,
    username: intent.target_canonical_alias,
    displayName: intent.target_display_name,
    temporaryPassword,
    membershipId,
  };

  return jsonResponse(result);
}
