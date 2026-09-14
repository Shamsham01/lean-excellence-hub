/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getClaims = vi.fn();
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

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims },
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

    await expect(requireClaims()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("throws PlatformBoundaryError when getClaims returns a Supabase error", async () => {
    getClaims.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    });

    await expect(requireClaims()).rejects.toBeInstanceOf(PlatformBoundaryError);
    expect(redirect).not.toHaveBeenCalled();
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
