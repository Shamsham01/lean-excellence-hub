import { describe, expect, it, vi } from "vitest";

import { handleNotificationDeliveryRequest } from "../../supabase/functions/_shared/notification-delivery/handler.ts";
import { createFakeOperationalEmailProvider } from "../../supabase/functions/_shared/notification-delivery/provider/fake.ts";
import type { NotificationDeliveryWorkerClient } from "../../supabase/functions/_shared/notification-delivery/worker-client.ts";
import {
  authenticateNotificationWorkerRequest,
  parseSupabaseSecretKeys,
  resolvePrivilegedSupabaseKey,
  resolveWorkerAuthConfig,
} from "../../supabase/functions/_shared/notification-delivery/worker-auth.ts";

const SECRET_KEY = "sb_secret_test_key_value";
const LEGACY_KEY = "legacy-service-role-jwt";
const SECOND_SECRET_KEY = "sb_secret_secondary_key";

function createMockClient(): NotificationDeliveryWorkerClient {
  return {
    claimNotificationDeliveries: vi.fn(async () => ({
      deliveries: [],
      error: null,
    })),
    getDeliveryContext: vi.fn(),
    getProviderEnvelope: vi.fn(),
    storeProviderEnvelope: vi.fn(),
    completeNotificationDelivery: vi.fn(),
    failNotificationDeliveryRetryable: vi.fn(),
    failNotificationDeliveryTerminal: vi.fn(),
  };
}

function createEnvReader(
  values: Record<string, string | undefined>,
): (name: string) => string | undefined {
  return (name) => values[name];
}

function createAuthorizedRequest(
  headers: Record<string, string> = {},
  body: Record<string, unknown> = { batch_size: 1 },
) {
  return new Request("https://example.test/notification-delivery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function createHandlerDependencies(
  env: Record<string, string | undefined> = {},
) {
  const readEnv = createEnvReader({
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
    APP_ORIGIN: "https://hub.example.test",
    OPERATIONAL_EMAIL_FROM: "notifications@example.test",
    OPERATIONAL_EMAIL_FROM_NAME: "Lean Excellence Hub",
    ...env,
  });

  return {
    readEnv,
    createWorkerClient: () => createMockClient(),
    createProvider: () => createFakeOperationalEmailProvider(),
  };
}

describe("parseSupabaseSecretKeys", () => {
  it("parses multiple named secret keys", () => {
    const parsed = parseSupabaseSecretKeys(
      JSON.stringify({
        default: SECRET_KEY,
        scheduler: SECOND_SECRET_KEY,
      }),
    );

    expect(parsed.parseError).toBe(false);
    expect(parsed.keys).toEqual([SECRET_KEY, SECOND_SECRET_KEY]);
    expect(parsed.preferredKey).toBe(SECRET_KEY);
  });

  it("returns parseError for malformed JSON", () => {
    const parsed = parseSupabaseSecretKeys("{not-json");

    expect(parsed.parseError).toBe(true);
    expect(parsed.keys).toEqual([]);
    expect(parsed.preferredKey).toBeNull();
  });
});

describe("authenticateNotificationWorkerRequest", () => {
  it("accepts a valid apikey matching SUPABASE_SECRET_KEYS", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({ apikey: SECRET_KEY }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
      }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("rejects a wrong apikey", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({ apikey: "sb_secret_wrong" }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized.",
    });
  });

  it("rejects missing apikey and missing bearer", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest(),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized.",
    });
  });

  it("rejects whitespace-only apikey", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({ apikey: "   " }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized.",
    });
  });

  it("accepts any configured named secret key", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({ apikey: SECOND_SECRET_KEY }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({
          default: SECRET_KEY,
          scheduler: SECOND_SECRET_KEY,
        }),
      }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("fails closed when secret keys are malformed and no fallback exists", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({ apikey: SECRET_KEY }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: "{not-json",
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized.",
    });
  });

  it("accepts valid legacy service_role bearer fallback", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({
        Authorization: `Bearer ${LEGACY_KEY}`,
      }),
      createEnvReader({
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("rejects invalid legacy bearer", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({
        Authorization: "Bearer wrong-legacy-key",
      }),
      createEnvReader({
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized.",
    });
  });

  it("accepts when both headers are present and apikey is valid", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({
        apikey: SECRET_KEY,
        Authorization: "Bearer wrong-legacy-key",
      }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("rejects when both headers are invalid", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({
        apikey: "sb_secret_wrong",
        Authorization: "Bearer wrong-legacy-key",
      }),
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized.",
    });
  });

  it("returns worker-not-configured when no secret keys or legacy key exist", () => {
    const result = authenticateNotificationWorkerRequest(
      createAuthorizedRequest({ apikey: SECRET_KEY }),
      createEnvReader({}),
    );

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "Worker is not configured.",
    });
  });
});

describe("resolvePrivilegedSupabaseKey", () => {
  it("prefers a configured modern secret key", () => {
    const key = resolvePrivilegedSupabaseKey(
      createEnvReader({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    expect(key).toBe(SECRET_KEY);
  });

  it("falls back to legacy service_role when modern key is unavailable", () => {
    const key = resolvePrivilegedSupabaseKey(
      createEnvReader({
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    expect(key).toBe(LEGACY_KEY);
  });
});

describe("notification delivery worker auth integration", () => {
  it("accepts valid apikey invocation through the handler", async () => {
    const response = await handleNotificationDeliveryRequest(
      createAuthorizedRequest({ apikey: SECRET_KEY }),
      createHandlerDependencies(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      summary: {
        claimed: 0,
      },
    });
  });

  it("does not echo secrets in auth error responses", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await handleNotificationDeliveryRequest(
      createAuthorizedRequest({
        apikey: "sb_secret_wrong",
        Authorization: "Bearer wrong-legacy-key",
      }),
      createHandlerDependencies({
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET_KEY }),
        SUPABASE_SERVICE_ROLE_KEY: LEGACY_KEY,
      }),
    );

    const bodyText = JSON.stringify(await response.json());
    expect(response.status).toBe(401);
    expect(bodyText).not.toContain(SECRET_KEY);
    expect(bodyText).not.toContain(LEGACY_KEY);
    expect(bodyText).not.toContain("sb_secret_wrong");
    expect(consoleInfo).not.toHaveBeenCalled();
    consoleInfo.mockRestore();
  });
});

describe("resolveWorkerAuthConfig", () => {
  it("treats empty secret-key configuration without legacy as invalid", () => {
    expect(
      resolveWorkerAuthConfig(
        createEnvReader({
          SUPABASE_SECRET_KEYS: "{}",
        }),
      ),
    ).toEqual({
      configured: false,
      reason: "invalid_secret_keys_without_fallback",
    });
  });
});
