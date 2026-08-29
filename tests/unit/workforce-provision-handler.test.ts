import { describe, expect, it, vi } from "vitest";

import {
  handleWorkforceProvisionRequest,
  type WorkforceProvisionDependencies,
  type WorkforceProvisionIntent,
} from "../../supabase/functions/_shared/workforce-provision/handler";

const intentId = "11111111-1111-4111-8111-111111111111";
const callerUserId = "99999999-9999-4999-8999-999999999999";
const authUserId = "44444444-4444-4444-8444-444444444444";
const membershipId = "33333333-3333-4333-8333-333333333333";

const baseIntent: WorkforceProvisionIntent = {
  intent_id: intentId,
  organisation_id: "22222222-2222-4222-8222-222222222222",
  organisation_code: "tenant-a",
  status: "pending",
  target_canonical_alias: "jsmith",
  target_display_name: "Jane Smith",
  sealed_internal_login_identifier:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid",
  created_auth_user_id: null,
};

function createRequest(body: Record<string, unknown> = { intentId }) {
  return new Request("http://localhost/functions/v1/workforce-provision", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

type DependencyOverrides = {
  intent?: WorkforceProvisionIntent | null;
  serviceRpc?: ReturnType<typeof vi.fn>;
  createUser?: ReturnType<typeof vi.fn>;
  getUser?: ReturnType<typeof vi.fn>;
  generatePassword?: () => string;
};

function createDependencies(
  overrides: DependencyOverrides = {},
): WorkforceProvisionDependencies {
  const serviceRpc =
    overrides.serviceRpc ??
    vi
      .fn()
      .mockResolvedValueOnce({
        data: overrides.intent === null ? [] : [overrides.intent ?? baseIntent],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: membershipId, error: null });

  const createUser =
    overrides.createUser ??
    vi.fn().mockResolvedValue({
      data: { user: { id: authUserId } },
      error: null,
    });

  return {
    readEnv: () => undefined,
    createUserClient: () => ({
      auth: {
        getUser:
          overrides.getUser ??
          vi.fn().mockResolvedValue({
            data: { user: { id: callerUserId } },
            error: null,
          }),
      },
    }),
    createServiceClient: () => ({
      rpc: serviceRpc,
    }),
    createAuthAdminClient: () => ({
      auth: {
        admin: {
          createUser,
          listUsers: vi
            .fn()
            .mockResolvedValue({ data: { users: [] }, error: null }),
        },
      },
    }),
    generatePassword: overrides.generatePassword ?? (() => "Temp-Pass-123!"),
  } as WorkforceProvisionDependencies;
}

describe("handleWorkforceProvisionRequest", () => {
  it("returns temporary password once for a successful manual provision", async () => {
    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      createDependencies(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      organisationCode: "tenant-a",
      username: "jsmith",
      displayName: "Jane Smith",
      temporaryPassword: "Temp-Pass-123!",
      membershipId,
    });
  });

  it("rejects missing JWT", async () => {
    const response = await handleWorkforceProvisionRequest(
      new Request("http://localhost/functions/v1/workforce-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId }),
      }),
      createDependencies(),
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid JWT", async () => {
    const dependencies = createDependencies({
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "invalid" },
      }),
    });

    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      dependencies,
    );

    expect(response.status).toBe(401);
  });

  it("rejects callers that cannot access the intent", async () => {
    const dependencies = createDependencies({ intent: null });
    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      dependencies,
    );

    expect(response.status).toBe(403);
  });

  it("rejects completed intents", async () => {
    const dependencies = createDependencies({
      intent: { ...baseIntent, status: "completed" },
    });
    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      dependencies,
    );

    expect(response.status).toBe(409);
  });

  it("does not finalise when auth creation fails", async () => {
    const serviceRpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [baseIntent], error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "create failed" },
    });

    const dependencies = createDependencies({ serviceRpc, createUser });
    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      dependencies,
    );

    expect(response.status).toBe(500);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(serviceRpc).toHaveBeenCalledWith("fail_workforce_provision", {
      target_intent_id: intentId,
      target_failure_reason: "auth user creation failed",
    });
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("Temp-Pass-123!");
    expect(JSON.stringify(body)).not.toContain("SERVICE");
  });

  it("retries auth_created intents without creating a second auth user", async () => {
    const serviceRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            ...baseIntent,
            status: "auth_created",
            created_auth_user_id: authUserId,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: membershipId, error: null });
    const createUser = vi.fn();

    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      createDependencies({ serviceRpc, createUser }),
    );

    expect(response.status).toBe(200);
    expect(createUser).not.toHaveBeenCalled();
    const recoveredBody = await response.json();
    expect(recoveredBody).toMatchObject({
      ok: true,
      credentialsRecovered: true,
      membershipId,
    });
    expect(recoveredBody.temporaryPassword).toBeUndefined();
  });

  it("recovers after auth creation when finalisation fails on first attempt", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: authUserId } },
      error: null,
    });

    const firstAttemptRpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [baseIntent], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "finalise failed", code: "55000" },
      })
      .mockResolvedValueOnce({ data: false, error: null });

    const firstResponse = await handleWorkforceProvisionRequest(
      createRequest(),
      createDependencies({ serviceRpc: firstAttemptRpc, createUser }),
    );
    expect(firstResponse.status).toBe(500);
    expect(createUser).toHaveBeenCalledTimes(1);

    const retryRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            ...baseIntent,
            status: "auth_created",
            created_auth_user_id: authUserId,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: membershipId, error: null });
    const retryCreateUser = vi.fn();

    const retryResponse = await handleWorkforceProvisionRequest(
      createRequest(),
      createDependencies({
        serviceRpc: retryRpc,
        createUser: retryCreateUser,
      }),
    );

    expect(retryResponse.status).toBe(200);
    expect(retryCreateUser).not.toHaveBeenCalled();
    await expect(retryResponse.json()).resolves.toMatchObject({
      ok: true,
      credentialsRecovered: true,
      membershipId,
    });
  });

  it("does not echo secrets in error responses", async () => {
    const dependencies = createDependencies({
      intent: null,
      generatePassword: () => "SuperSecret-Temp-Password!",
    });
    const response = await handleWorkforceProvisionRequest(
      createRequest(),
      dependencies,
    );
    const bodyText = JSON.stringify(await response.json());
    expect(bodyText).not.toContain("SuperSecret-Temp-Password!");
    expect(bodyText).not.toContain("service_role");
  });
});
