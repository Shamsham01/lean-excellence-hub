/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getClaims = vi.fn();
const rpc = vi.fn();
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

vi.mock("@/modules/organisations/context", () => ({
  listEligibleOrganisations: async () => [],
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getClaims },
    rpc,
  }),
}));

import { requirePlatformAccess } from "@/modules/identity/session";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("requirePlatformAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
      error: null,
    });
  });

  it("does not treat a current_identity_state failure as no-access", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    });

    await expect(requirePlatformAccess()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to no-access when identity is genuinely missing", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(requirePlatformAccess()).rejects.toThrow(
      "REDIRECT:/no-access",
    );
  });

  it("redirects to login when claims are genuinely missing", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: null }, error: null });

    await expect(requirePlatformAccess()).rejects.toThrow("REDIRECT:/login");
  });

  it("does not redirect to login when getClaims returns a Supabase error", async () => {
    getClaims.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    });

    await expect(requirePlatformAccess()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not swallow Next.js dynamic-rendering control errors", async () => {
    const dynamicError = Object.assign(
      new Error(
        "Dynamic server usage: Route /select-organisation used cookies",
      ),
      { digest: "DYNAMIC_SERVER_USAGE" },
    );
    getClaims.mockRejectedValueOnce(dynamicError);

    await expect(requirePlatformAccess()).rejects.toBe(dynamicError);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("fails closed when getClaims throws a transport error", async () => {
    getClaims.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(requirePlatformAccess()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
  });
});
