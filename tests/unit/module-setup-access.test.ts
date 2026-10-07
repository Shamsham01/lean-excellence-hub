import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
  }),
}));

const managePermission = vi.fn();
const aiPermission = vi.fn();
const eligibility = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/modules/platform-shell/permissions", () => ({
  currentMemberHasOrganisationScopedPermission: (...args: unknown[]) =>
    managePermission(...args),
  currentMemberHasPermission: (...args: unknown[]) => aiPermission(...args),
}));

vi.mock("@/modules/leanai-context/coach/eligibility", () => ({
  assessCoachAiEligibility: (...args: unknown[]) => eligibility(...args),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({
      select: () => ({
        maybeSingle,
      }),
    }),
  }),
}));

import { loadModuleSetupBuilderAccess } from "@/modules/module-setup/ai-builder/access";

describe("module setup builder access", () => {
  beforeEach(() => {
    managePermission.mockReset();
    aiPermission.mockReset();
    eligibility.mockReset();
    maybeSingle.mockReset();
    managePermission.mockResolvedValue(true);
    aiPermission.mockResolvedValue(true);
    eligibility.mockResolvedValue({ ok: true });
    maybeSingle.mockResolvedValue({ data: { ai_enabled: true }, error: null });
  });

  it("blocks LeanAI when the module manage permission is missing", async () => {
    managePermission.mockResolvedValue(false);
    const access = await loadModuleSetupBuilderAccess({
      managePermission: "five_s.standards.manage",
      moduleLabel: "5S standards",
    });
    expect(access.available).toBe(false);
    expect(access.reason).toBe("manage_permission_required");
  });

  it("keeps setup available to explain a missing AI permission", async () => {
    aiPermission.mockResolvedValue(false);
    const access = await loadModuleSetupBuilderAccess({
      managePermission: "gemba.definitions.manage",
      moduleLabel: "Gemba definitions",
    });
    expect(access).toMatchObject({
      canManage: true,
      available: false,
      reason: "ai_permission_required",
    });
    expect(access.message).toMatch(/Quick Start/i);
  });

  it("reports organisation AI as turned off without hiding the other paths", async () => {
    maybeSingle.mockResolvedValue({ data: { ai_enabled: false }, error: null });
    const access = await loadModuleSetupBuilderAccess({
      managePermission: "five_s.standards.manage",
      moduleLabel: "5S standards",
    });
    expect(access.reason).toBe("organisation_ai_disabled");
    expect(access.message).toMatch(/Manual setup and LEH Quick Start/i);
  });
});
