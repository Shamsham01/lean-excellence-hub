/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  RECOVERY_CODE_COOKIE,
  RECOVERY_TOKEN_COOKIE,
} from "@/modules/identity/recovery-callback";

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

import { GET, POST } from "@/app/auth/recovery/route";

const canonicalEnvironment = {
  APP_ORIGIN: "https://leanexcellencehub.com",
  AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
  NODE_ENV: "production" as const,
  SUPABASE_SECRET_KEY: "test-secret-key",
};

function recoveryRequest(
  path: string,
  options: { method?: "GET" | "POST"; cookie?: string } = {},
) {
  return new NextRequest(`https://leanexcellencehub.com${path}`, {
    method: options.method ?? "GET",
    headers: {
      host: "leanexcellencehub.com",
      origin: "https://leanexcellencehub.com",
      ...(options.cookie ? { cookie: options.cookie } : {}),
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

  it("stages a recovery TokenHash on GET without consuming it", async () => {
    const response = await GET(
      recoveryRequest(
        "/auth/recovery?token_hash=abc123tokenhash&type=recovery&next=https://evil.example",
      ),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/recover?continue=true",
    );
    expect(response.cookies.get(RECOVERY_TOKEN_COOKIE)?.value).toBe(
      "abc123tokenhash",
    );
    expect(response.cookies.get(RECOVERY_TOKEN_COOKIE)?.httpOnly).toBe(true);
  });

  it("stages a PKCE code on GET without exchanging it", async () => {
    const response = await GET(
      recoveryRequest("/auth/recovery?code=pkce-code"),
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/recover?continue=true",
    );
    expect(response.cookies.get(RECOVERY_CODE_COOKIE)?.value).toBe("pkce-code");
  });

  it("consumes a staged TokenHash only on an explicit same-origin POST", async () => {
    const response = await POST(
      recoveryRequest("/auth/recovery", {
        method: "POST",
        cookie: `${RECOVERY_TOKEN_COOKIE}=abc123tokenhash`,
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "abc123tokenhash",
      type: "recovery",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/update-password",
    );
    expect(response.cookies.get(RECOVERY_TOKEN_COOKIE)?.value ?? "").toBe("");
  });

  it("consumes a staged PKCE code only on POST", async () => {
    const response = await POST(
      recoveryRequest("/auth/recovery", {
        method: "POST",
        cookie: `${RECOVERY_CODE_COOKIE}=pkce-code`,
      }),
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

  it("fails safely for malformed callbacks and consumed tokens", async () => {
    const malformed = await GET(recoveryRequest("/auth/recovery"));
    expect(malformed.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/recover?error=expired",
    );

    verifyOtp.mockResolvedValue({ error: { message: "Token has expired" } });
    const expired = await POST(
      recoveryRequest("/auth/recovery", {
        method: "POST",
        cookie: `${RECOVERY_TOKEN_COOKIE}=used-token`,
      }),
    );

    expect(expired.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/recover?error=expired",
    );
    expect(expired.headers.get("Location")).not.toContain("login");
  });
});
