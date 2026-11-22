/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const countActiveUnits = vi.fn();
const checkOrganisationOwner = vi.fn();
const checkCurrentAdminPrimaryAssignment = vi.fn();

vi.mock("@/modules/organisation-setup/queries", () => ({
  countActiveUnits: (...args: unknown[]) => countActiveUnits(...args),
  checkOrganisationOwner: (...args: unknown[]) =>
    checkOrganisationOwner(...args),
  checkCurrentAdminPrimaryAssignment: (...args: unknown[]) =>
    checkCurrentAdminPrimaryAssignment(...args),
  isPermissionDenied: () => false,
}));

const from = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: (...args: unknown[]) => from(...args),
  }),
}));

import { shouldShowSetupInNavigation } from "@/modules/organisation-setup/nav-setup-visibility";

describe("shouldShowSetupInNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockImplementation((table: string) => {
      if (table === "organisations") {
        return { select: () => ({ maybeSingle }) };
      }
      return { select: () => ({ maybeSingle: vi.fn() }) };
    });
    maybeSingle.mockResolvedValue({
      data: { name: "Acme", status: "active" },
      error: null,
    });
    countActiveUnits.mockResolvedValue({
      units: [{ id: "u1", unit_type: "site", status: "active" }],
      unavailable: false,
    });
    checkOrganisationOwner.mockResolvedValue({
      hasOwner: true,
      unavailable: false,
    });
    checkCurrentAdminPrimaryAssignment.mockResolvedValue({
      hasAssignment: true,
      unavailable: false,
    });
  });

  it("hides setup navigation when core setup is complete", async () => {
    await expect(shouldShowSetupInNavigation()).resolves.toBe(false);
  });

  it("shows setup navigation when core setup is incomplete", async () => {
    checkCurrentAdminPrimaryAssignment.mockResolvedValue({
      hasAssignment: false,
      unavailable: false,
    });
    await expect(shouldShowSetupInNavigation()).resolves.toBe(true);
  });

  it("shows setup navigation when the gate query fails", async () => {
    maybeSingle.mockRejectedValue(new Error("network"));
    await expect(shouldShowSetupInNavigation()).resolves.toBe(true);
  });
});
