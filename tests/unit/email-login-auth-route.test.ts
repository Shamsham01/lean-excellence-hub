/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/auth/login/route";

const recordAuthenticationSecurityEvent = vi.fn();
const resolveEmailPasswordLoginRedirectPath = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("@/platform/supabase/secret", () => ({
  recordAuthenticationSecurityEvent: (...args: unknown[]) =>
    recordAuthenticationSecurityEvent(...args),
}));

vi.mock("@/modules/identity/email-login", () => ({
  resolveEmailPasswordLoginRedirectPath: (...args: unknown[]) =>
    resolveEmailPasswordLoginRedirectPath(...args),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    },
  }),
}));

const getServerEnvironment = vi.fn();

vi.mock("@/platform/env", () => ({
  getPublicEnvironment: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  }),
  getServerEnvironment: () => getServerEnvironment(),
}));

const canonicalEnvironment = {
  APP_ORIGIN: "https://leanexcellencehub.com",
  AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
  NODE_ENV: "production" as const,
  SUPABASE_SECRET_KEY: "test-secret-key",
};

function createTrustedLoginRequest() {
  return new NextRequest(
    "https://deploy-id--lean-excellence-hub.netlify.app/api/auth/login",
    {
      method: "POST",
      headers: {
        origin: "null",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
      body: new URLSearchParams({
        email: "manager@example.test",
        password: "DemoPassword123!",
      }),
    },
  );
}

describe("email login auth route redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvironment.mockReturnValue(canonicalEnvironment);
    signInWithPassword.mockResolvedValue({ error: null });
    resolveEmailPasswordLoginRedirectPath.mockResolvedValue("/platform");
  });

  it("redirects successful logins to the canonical APP_ORIGIN", async () => {
    const response = await POST(createTrustedLoginRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/platform",
    );
    expect(recordAuthenticationSecurityEvent).toHaveBeenCalledWith(
      "authentication.email_password",
      "succeeded",
    );
  });

  it("keeps a valid invitation continuation when sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const continuation =
      "/invitations/continue/11111111-1111-4111-8111-111111111111";

    const response = await POST(
      new NextRequest(
        "https://deploy-id--lean-excellence-hub.netlify.app/api/auth/login",
        {
          method: "POST",
          headers: {
            origin: "null",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
          },
          body: new URLSearchParams({
            email: "manager@example.test",
            password: "DemoPassword123!",
            next: continuation,
          }),
        },
      ),
    );

    expect(response.headers.get("Location")).toBe(
      `https://leanexcellencehub.com/login?error=invalid&next=${encodeURIComponent(continuation)}`,
    );
  });

  it("drops an unrelated next path when sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(
      new NextRequest(
        "https://deploy-id--lean-excellence-hub.netlify.app/api/auth/login",
        {
          method: "POST",
          headers: {
            origin: "null",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
          },
          body: new URLSearchParams({
            email: "manager@example.test",
            password: "DemoPassword123!",
            next: "https://evil.example/phish",
          }),
        },
      ),
    );

    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/login?error=invalid",
    );
  });

  it("redirects invalid credentials to the canonical APP_ORIGIN", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const response = await POST(createTrustedLoginRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/login?error=invalid",
    );
    expect(recordAuthenticationSecurityEvent).toHaveBeenCalledWith(
      "authentication.email_password",
      "denied",
    );
  });

  it("rejects requests without a trusted origin", async () => {
    const response = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/login", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
        body: new URLSearchParams({
          email: "manager@example.test",
          password: "DemoPassword123!",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
