/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getServerEnvironment = vi.fn();
const verifyOtp = vi.fn();
const getUser = vi.fn();
const finaliseIdentityEnrolment = vi.fn();
const finaliseFoundingSignup = vi.fn();

vi.mock("@/platform/env", () => ({
  getPublicEnvironment: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  }),
  getServerEnvironment: () => getServerEnvironment(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
          headers?: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      verifyOtp: async (...args: unknown[]) => {
        options.cookies.setAll(
          [
            {
              name: "sb-127-auth-token",
              value: "session-cookie",
              options: { path: "/", sameSite: "lax" },
            },
          ],
          {},
        );
        return verifyOtp(...args);
      },
      getUser: (...args: unknown[]) => getUser(...args),
      signOut: vi.fn(async () => ({ error: null })),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }),
}));

vi.mock("@/platform/supabase/secret", () => ({
  finaliseIdentityEnrolment: (...args: unknown[]) =>
    finaliseIdentityEnrolment(...args),
  finaliseFoundingSignup: (...args: unknown[]) =>
    finaliseFoundingSignup(...args),
}));

import { GET, POST } from "@/app/auth/confirm/route";

const canonicalEnvironment = {
  APP_ORIGIN: "https://leanexcellencehub.com",
  AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
  NODE_ENV: "production" as const,
  SUPABASE_SECRET_KEY: "test-secret-key",
};

describe("auth confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvironment.mockReturnValue(canonicalEnvironment);
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: {} } },
      error: null,
    });
    finaliseIdentityEnrolment.mockResolvedValue({ error: null, data: true });
  });

  it("forwards recovery callbacks to the dedicated recovery route", async () => {
    const response = await GET(
      new NextRequest(
        "https://leanexcellencehub.com/auth/confirm?token_hash=abc123tokenhash&type=recovery&next=/platform",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/auth/recovery?token_hash=abc123tokenhash&type=recovery",
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("stages signup confirmation without consuming the token", async () => {
    const response = await GET(
      new NextRequest(
        "https://leanexcellencehub.com/auth/confirm?token_hash=signup-hash&type=signup",
      ),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(finaliseIdentityEnrolment).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/confirm?continue=true",
    );
    expect(response.headers.get("Location")).not.toContain("token_hash");
    expect(response.cookies.get("leh_confirm_token_hash")?.value).toBe(
      "signup-hash",
    );
    expect(response.cookies.get("leh_confirm_type")?.value).toBe("signup");
  });

  it("verifies signup confirmation on POST and keeps the session cookie", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            invitation_signup_binding: "22222222-2222-4222-8222-222222222222",
          },
        },
      },
      error: null,
    });

    const response = await POST(
      new NextRequest("https://leanexcellencehub.com/auth/confirm", {
        method: "POST",
        headers: {
          origin: "https://leanexcellencehub.com",
          cookie: "leh_confirm_token_hash=signup-hash; leh_confirm_type=signup",
        },
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "signup-hash",
      type: "signup",
    });
    expect(finaliseIdentityEnrolment).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/invitations/continue/22222222-2222-4222-8222-222222222222",
    );
    expect(response.headers.get("Location")).not.toContain("token_hash");
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe(
      "session-cookie",
    );
    expect(response.cookies.get("leh_confirm_token_hash")?.value).toBe("");
  });

  it("keeps failed confirmation on a confirmation error, not credentials copy", async () => {
    const response = await GET(
      new NextRequest("https://leanexcellencehub.com/auth/confirm"),
    );

    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/login?error=confirm",
    );
  });
});
