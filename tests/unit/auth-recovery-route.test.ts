/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
const getServerEnvironment = vi.fn();

vi.mock("@/platform/env", () => ({
  getPublicEnvironment: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  }),
  getServerEnvironment: () => getServerEnvironment(),
}));

vi.mock("@/platform/supabase/route-handler", () => ({
  createRouteHandlerSupabaseClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      exchangeCodeForSession: (...args: unknown[]) =>
        exchangeCodeForSession(...args),
      getUser: (...args: unknown[]) => getUser(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  }),
}));

import { GET } from "@/app/auth/recovery/route";

const canonicalEnvironment = {
  APP_ORIGIN: "https://leanexcellencehub.com",
  AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
  NODE_ENV: "production" as const,
  SUPABASE_SECRET_KEY: "test-secret-key",
};

function recoveryRequest(path: string, host = "evil.example") {
  return new NextRequest(`https://${host}${path}`, {
    headers: {
      host,
      "x-forwarded-host": host,
    },
  });
}

describe("password recovery callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvironment.mockReturnValue(canonicalEnvironment);
    verifyOtp.mockResolvedValue({ error: null });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("verifies recovery TokenHash and redirects to update-password on APP_ORIGIN", async () => {
    const response = await GET(
      recoveryRequest(
        "/auth/recovery?token_hash=abc123tokenhash&type=recovery&next=https://evil.example",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "abc123tokenhash",
      type: "recovery",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/update-password",
    );
  });

  it("exchanges a PKCE code and does not keep it in the destination URL", async () => {
    const response = await GET(
      recoveryRequest("/auth/recovery?code=pkce-code"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/update-password",
    );
  });

  it("does not accept signup or invite OTP types", async () => {
    for (const type of ["signup", "invite", "magiclink"]) {
      const response = await GET(
        recoveryRequest(
          `/auth/recovery?token_hash=abc123tokenhash&type=${type}`,
        ),
      );

      expect(response.headers.get("Location")).toBe(
        "https://leanexcellencehub.com/recover?error=expired",
      );
    }

    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("sends expired and malformed callbacks to recover, not login credentials", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired" } });

    const expired = await GET(
      recoveryRequest("/auth/recovery?token_hash=used-token&type=recovery"),
    );
    const malformed = await GET(recoveryRequest("/auth/recovery"));

    expect(expired.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/recover?error=expired",
    );
    expect(malformed.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/recover?error=expired",
    );
    expect(expired.headers.get("Location")).not.toContain("login");
  });
});
