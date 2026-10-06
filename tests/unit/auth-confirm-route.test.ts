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
  createServerClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      getUser: (...args: unknown[]) => getUser(...args),
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

import { GET } from "@/app/auth/confirm/route";

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

  it("still accepts signup confirmation types", async () => {
    const response = await GET(
      new NextRequest(
        "https://leanexcellencehub.com/auth/confirm?token_hash=signup-hash&type=signup",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "signup-hash",
      type: "signup",
    });
    expect(response.status).toBe(303);
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
