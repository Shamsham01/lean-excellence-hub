/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const getClaims = vi.fn();
const updateUser = vi.fn();
const finaliseIdentityEnrolment = vi.fn();
const recordAuthenticationSecurityEvent = vi.fn();
const routeAfterAuthentication = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/modules/identity/session", () => ({
  routeAfterAuthentication: (...args: unknown[]) =>
    routeAfterAuthentication(...args),
}));

vi.mock("@/platform/supabase/secret", () => ({
  finaliseIdentityEnrolment: (...args: unknown[]) =>
    finaliseIdentityEnrolment(...args),
  recordAuthenticationSecurityEvent: (...args: unknown[]) =>
    recordAuthenticationSecurityEvent(...args),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getClaims: (...args: unknown[]) => getClaims(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  }),
}));

import { updatePassword } from "@/app/(auth)/update-password/actions";

function passwordForm(password: string) {
  const formData = new FormData();
  formData.set("password", password);
  return formData;
}

describe("update password action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    updateUser.mockResolvedValue({ error: null });
    finaliseIdentityEnrolment.mockResolvedValue({ error: null, data: true });
    routeAfterAuthentication.mockImplementation(() => {
      throw new Error("REDIRECT:/platform");
    });
  });

  it("rejects unauthenticated password updates", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    await expect(
      updatePassword(passwordForm("Strong-Password-2026!")),
    ).rejects.toThrow("REDIRECT:/update-password?error=session");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects weak passwords without calling Auth", async () => {
    await expect(updatePassword(passwordForm("short"))).rejects.toThrow(
      "REDIRECT:/update-password?error=weak",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("records a failed security event when Auth rejects the update", async () => {
    updateUser.mockResolvedValue({ error: { message: "same password" } });

    await expect(
      updatePassword(passwordForm("Strong-Password-2026!")),
    ).rejects.toThrow("REDIRECT:/update-password?error=failed");
    expect(recordAuthenticationSecurityEvent).toHaveBeenCalledWith(
      "authentication.password_changed",
      "failed",
    );
  });
});
