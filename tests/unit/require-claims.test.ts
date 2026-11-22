/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getClaims = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const redirect = vi.fn((path: string) => {
  throw Object.assign(new Error(`REDIRECT:${path}`), {
    digest: `NEXT_REDIRECT;replace;${path}`,
  });
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
  unstable_rethrow: (error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      (error.digest.startsWith("NEXT_REDIRECT") ||
        error.digest === "DYNAMIC_SERVER_USAGE")
    ) {
      throw error;
    }
  },
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform/gemba",
}));

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => ({ APP_ORIGIN: "http://127.0.0.1:3000" }),
  getPublicEnvironment: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
  }),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims, signOut },
  }),
}));

import { requireClaims } from "@/modules/identity/session";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("requireClaims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });
  });

  it("redirects to login when getClaims succeeds but claims.sub is missing", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: null }, error: null });

    await expect(requireClaims()).rejects.toThrow(
      "REDIRECT:/login?next=%2Fplatform%2Fgemba",
    );
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("redirects to login when getClaims returns a recoverable auth error", async () => {
    getClaims.mockResolvedValueOnce({
      data: null,
      error: {
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      },
    });

    await expect(requireClaims()).rejects.toThrow(
      "REDIRECT:/login?next=%2Fplatform%2Fgemba",
    );
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("throws PlatformBoundaryError when getClaims throws a transport error", async () => {
    getClaims.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(requireClaims()).rejects.toBeInstanceOf(PlatformBoundaryError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rethrows Next.js dynamic-rendering control errors", async () => {
    const dynamicError = Object.assign(
      new Error("Dynamic server usage: Route /platform used cookies"),
      { digest: "DYNAMIC_SERVER_USAGE" },
    );
    getClaims.mockRejectedValueOnce(dynamicError);

    await expect(requireClaims()).rejects.toBe(dynamicError);
    expect(redirect).not.toHaveBeenCalled();
  });
});
