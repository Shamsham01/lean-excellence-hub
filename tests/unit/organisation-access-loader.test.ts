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
const readRequestPathname = vi.fn(async () => "/platform/gemba");

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { signOut },
    rpc,
  }),
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: () => readRequestPathname(),
}));

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => ({ APP_ORIGIN: "http://127.0.0.1:3000" }),
}));

import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
} from "@/modules/organisations/context";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("shared organisation loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns organisations when the RPC succeeds, including an empty list", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(listEligibleOrganisations()).resolves.toEqual([]);
  });

  it("redirects to login on list_my_eligible_organisations auth-session failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    });

    await expect(listEligibleOrganisations()).rejects.toThrow(
      "REDIRECT:/login?next=%2Fplatform%2Fgemba",
    );
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("fails closed on list_my_eligible_organisations infrastructure errors", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    await expect(listEligibleOrganisations()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("fails closed on current_organisation_id errors instead of treating them as no org", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    await expect(loadCurrentOrganisationId()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
  });

  it("returns the organisation id when the RPC succeeds", async () => {
    rpc.mockResolvedValueOnce({
      data: "11111111-1111-1111-1111-111111111111",
      error: null,
    });
    await expect(loadCurrentOrganisationId()).resolves.toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
