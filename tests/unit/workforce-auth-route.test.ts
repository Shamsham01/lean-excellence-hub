/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/workforce/route";

const authenticateWorkforce = vi.fn();
const getServerEnvironment = vi.fn();

vi.mock("@/modules/identity/workforce-login", () => ({
  authenticateWorkforce: (...args: unknown[]) => authenticateWorkforce(...args),
}));

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => getServerEnvironment(),
}));

const deployRequestUrl =
  "https://deploy-id--lean-excellence-hub.netlify.app/api/auth/workforce";
const canonicalEnvironment = {
  APP_ORIGIN: "https://leanexcellencehub.com",
  AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
  NODE_ENV: "production" as const,
  SUPABASE_SECRET_KEY: "test-secret-key",
};

function createTrustedWorkforceRequest() {
  return new Request(deployRequestUrl, {
    method: "POST",
    headers: {
      origin: "null",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    },
    body: new URLSearchParams({
      organisationCode: "apex-manufacturing",
      workforceAlias: "operator.one",
      password: "temporary-password",
    }),
  });
}

describe("workforce auth route redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvironment.mockReturnValue(canonicalEnvironment);
  });

  it("redirects successful logins to the canonical APP_ORIGIN", async () => {
    authenticateWorkforce.mockResolvedValue({
      ok: true,
      next: "/update-password",
    });

    const response = await POST(createTrustedWorkforceRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/update-password",
    );
  });

  it("redirects invalid logins to the canonical APP_ORIGIN", async () => {
    authenticateWorkforce.mockResolvedValue({
      ok: false,
      message: "Unable to sign in with those credentials.",
    });

    const response = await POST(createTrustedWorkforceRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/workforce-login?error=invalid",
    );
  });

  it("does not derive redirect locations from the incoming request URL", async () => {
    authenticateWorkforce.mockResolvedValue({
      ok: true,
      next: "/update-password",
    });

    const response = await POST(createTrustedWorkforceRequest());

    expect(response.headers.get("Location")).not.toContain("netlify.app");
    expect(response.headers.get("Location")).not.toContain("deploy-id");
  });

  it("keeps local APP_ORIGIN redirects on development hosts", async () => {
    getServerEnvironment.mockReturnValue({
      ...canonicalEnvironment,
      APP_ORIGIN: "http://127.0.0.1:3000",
      NODE_ENV: "development",
    });
    authenticateWorkforce.mockResolvedValue({
      ok: true,
      next: "/update-password",
    });

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/auth/workforce", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
        },
        body: new URLSearchParams({
          organisationCode: "apex-manufacturing",
          workforceAlias: "operator.one",
          password: "temporary-password",
        }),
      }),
    );

    expect(response.headers.get("Location")).toBe(
      "http://127.0.0.1:3000/update-password",
    );
  });
});
