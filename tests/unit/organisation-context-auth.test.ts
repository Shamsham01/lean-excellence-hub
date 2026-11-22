/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const redirect = vi.fn((path: string) => {
  throw Object.assign(new Error(`REDIRECT:${path}`), {
    digest: `NEXT_REDIRECT;replace;${path}`,
  });
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform",
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
    auth: { signOut },
    rpc,
  }),
}));

import { listEligibleOrganisations } from "@/modules/organisations/context";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("organisation context auth recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("redirects to login when eligible-organisation listing fails with a stale session", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      },
    });

    await expect(listEligibleOrganisations()).rejects.toThrow(
      "REDIRECT:/login?next=%2Fplatform",
    );
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still surfaces non-auth organisation loader failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "canceling statement" },
    });

    await expect(listEligibleOrganisations()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
