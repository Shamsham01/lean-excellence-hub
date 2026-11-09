/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
  readRequestPathname: async () => "/platform/gemba",
}));

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => ({ APP_ORIGIN: "http://127.0.0.1:3000" }),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { signOut },
  }),
}));

import {
  clearSessionAndRedirectToLogin,
  isRecoverableAuthSessionFailure,
} from "@/modules/identity/auth-session-redirect";

describe("auth session redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognises refresh token and JWT auth failures", () => {
    expect(
      isRecoverableAuthSessionFailure({
        code: "refresh_token_not_found",
        message: "Invalid Refresh Token: Refresh Token Not Found",
      }),
    ).toBe(true);
    expect(
      isRecoverableAuthSessionFailure({
        code: "PGRST301",
        message: "JWT expired",
      }),
    ).toBe(true);
    expect(isRecoverableAuthSessionFailure({ code: "57014" })).toBe(false);
  });

  it("clears the local session and redirects to login with next", async () => {
    await expect(clearSessionAndRedirectToLogin()).rejects.toThrow(
      "REDIRECT:/login?next=%2Fplatform%2Fgemba",
    );
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
