import { afterEach, describe, expect, it, vi } from "vitest";

import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("seedCookieWorksFoundation databaseUrl contract", () => {
  it("uses the supplied databaseUrl for role permission sync", async () => {
    const syncModule =
      await import("../../scripts/qa-tenant/sync-role-permissions");
    const organisationModule =
      await import("../../scripts/qa-tenant/shared/organisation");
    const authModule = await import("../../scripts/qa-tenant/shared/auth");
    const localEnvModule = await import("../../scripts/qa-tenant/local-env");

    vi.spyOn(authModule, "ensureAuthUser").mockResolvedValue(undefined);
    vi.spyOn(organisationModule, "provisionOrganisation").mockResolvedValue(
      "org-id",
    );
    vi.spyOn(authModule, "signInUser").mockResolvedValue({} as never);
    vi.spyOn(organisationModule, "resolveOrganisationId").mockResolvedValue(
      "org-id",
    );
    vi.spyOn(organisationModule, "switchOrganisation").mockResolvedValue(
      undefined,
    );
    vi.spyOn(organisationModule, "ensureUnits").mockResolvedValue({});
    vi.spyOn(organisationModule, "ensurePublishedRole").mockResolvedValue(
      "role-version-id",
    );
    vi.spyOn(organisationModule, "ensureInvitationAccepted").mockResolvedValue(
      undefined,
    );
    vi.spyOn(organisationModule, "ensureDisplayNames").mockResolvedValue(
      undefined,
    );
    const syncSpy = vi
      .spyOn(syncModule, "syncAllCookieWorksRolePermissions")
      .mockImplementation(() => undefined);
    const localEnvSpy = vi.spyOn(localEnvModule, "loadLocalSupabaseEnv");

    await seedCookieWorksFoundation({
      admin: {} as never,
      apiUrl: "https://abc123.supabase.co",
      publishableKey: "publishable-key",
      databaseUrl:
        "postgresql://postgres:postgres@db.abc123.supabase.co:5432/postgres",
    });

    expect(syncSpy).toHaveBeenCalledWith(
      "postgresql://postgres:postgres@db.abc123.supabase.co:5432/postgres",
    );
    expect(localEnvSpy).not.toHaveBeenCalled();
  });
});
