import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HOSTED_PRELAUNCH_PROJECT_REF,
  LEGACY_HOSTED_DEMO_ORGANISATION,
  QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN,
} from "../../scripts/qa-tenant/legacy-hosted-demo";
import {
  assertHostedReplacementAllowed,
  assertLegacyHostedDemoTargetContract,
} from "../../scripts/qa-tenant/guards";
import {
  buildHostedReplacementPlan,
  formatHostedReplacementPlan,
  runHostedTenantReplacement,
} from "../../scripts/qa-tenant/hosted-replacement";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

const hostedCredentials = {
  apiUrl: `https://${HOSTED_PRELAUNCH_PROJECT_REF}.supabase.co`,
  serviceRoleKey: "service-role-key",
  expectedProjectRef: HOSTED_PRELAUNCH_PROJECT_REF,
  publishableKey: "publishable-key",
  databaseUrl:
    "postgresql://postgres:postgres@db.zsadfvjtknbbfomlmttv.supabase.co:5432/postgres",
};

describe("hosted tenant replacement guards", () => {
  it("allows dry-run for the hosted pre-launch project ref", () => {
    expect(() =>
      assertHostedReplacementAllowed({
        apiUrl: hostedCredentials.apiUrl,
        expectedProjectRef: HOSTED_PRELAUNCH_PROJECT_REF,
        mode: "dry-run",
      }),
    ).not.toThrow();
  });

  it("refuses destructive replacement without explicit confirmation token", () => {
    delete process.env.LEANHUB_QA_RESET_CONFIRM;

    expect(() =>
      assertHostedReplacementAllowed({
        apiUrl: hostedCredentials.apiUrl,
        expectedProjectRef: HOSTED_PRELAUNCH_PROJECT_REF,
        mode: "destructive",
      }),
    ).toThrow(QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN);
  });

  it("refuses replacement for non pre-launch project refs", () => {
    expect(() =>
      assertHostedReplacementAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        mode: "dry-run",
      }),
    ).toThrow(/must be exactly zsadfvjtknbbfomlmttv/i);
  });

  it("keeps legacy hosted demo constants pinned in repository", () => {
    expect(() => assertLegacyHostedDemoTargetContract()).not.toThrow();
  });
});

describe("hosted tenant replacement plan", () => {
  it("formats a dry-run plan with legacy inventory and execution order", async () => {
    const deleteLegacy = await import(
      "../../scripts/qa-tenant/delete-legacy-hosted-demo"
    );
    const tenantInventory = await import(
      "../../scripts/qa-tenant/tenant-inventory"
    );
    const tenantStorage = await import(
      "../../scripts/qa-tenant/tenant-storage-cleanup"
    );

    vi.spyOn(deleteLegacy, "resolveLegacyHostedDemoOrganisation").mockReturnValue(
      LEGACY_HOSTED_DEMO_ORGANISATION,
    );
    vi.spyOn(tenantInventory, "collectTenantInventory").mockImplementation(
      (databaseUrl, organisationCode) => {
        if (organisationCode === LEGACY_HOSTED_DEMO_ORGANISATION.code) {
          return {
            organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
            sections: [
              {
                title: "Foundation",
                items: [{ label: "memberships", count: 8 }],
              },
              {
                title: "Maturity",
                items: [{ label: "frameworks", count: 2 }],
              },
            ],
          };
        }

        return {
          organisation: null,
          sections: [],
        };
      },
    );
    vi.spyOn(tenantStorage, "countTenantStorageObjects").mockReturnValue(3);
    vi.spyOn(
      deleteLegacy,
      "listLegacyHostedDemoAuthUserIds",
    ).mockReturnValue(["user-1", "user-2"]);
    vi.spyOn(
      deleteLegacy,
      "listLegacyHostedDemoDeletableAuthUserIds",
    ).mockReturnValue(["user-1", "user-2"]);

    const plan = buildHostedReplacementPlan({
      databaseUrl: hostedCredentials.databaseUrl,
      mode: "dry-run",
      projectRef: HOSTED_PRELAUNCH_PROJECT_REF,
    });

    const report = formatHostedReplacementPlan(plan);

    expect(report).toContain("Hosted pre-launch tenant replacement plan (QA2)");
    expect(report).toContain(LEGACY_HOSTED_DEMO_ORGANISATION.code);
    expect(report).toContain("auth identities safe to delete: 2");
    expect(report).toContain("Dry-run only. No hosted data was modified.");
    expect(report).toContain(QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN);
    expect(plan.cookieWorksPresent).toBe(false);
  });
});

describe("hosted tenant replacement runner", () => {
  it("runs dry-run without modifying hosted data", async () => {
    const deleteLegacy = await import(
      "../../scripts/qa-tenant/delete-legacy-hosted-demo"
    );
    const tenantInventory = await import(
      "../../scripts/qa-tenant/tenant-inventory"
    );
    const tenantStorage = await import(
      "../../scripts/qa-tenant/tenant-storage-cleanup"
    );

    vi.spyOn(deleteLegacy, "resolveLegacyHostedDemoOrganisation").mockReturnValue(
      LEGACY_HOSTED_DEMO_ORGANISATION,
    );
    vi.spyOn(tenantInventory, "collectTenantInventory").mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      sections: [],
    });
    vi.spyOn(tenantStorage, "countTenantStorageObjects").mockReturnValue(0);
    vi.spyOn(deleteLegacy, "listLegacyHostedDemoAuthUserIds").mockReturnValue(
      [],
    );
    vi.spyOn(
      deleteLegacy,
      "listLegacyHostedDemoDeletableAuthUserIds",
    ).mockReturnValue([]);
    vi.spyOn(deleteLegacy, "assertLegacyHostedDemoContract").mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      membershipCount: 8,
    });

    const deleteLegacyTenant = vi.fn();
    const seedCookieWorks = vi.fn();

    const result = await runHostedTenantReplacement({
      argv: [],
      credentials: hostedCredentials,
      deleteLegacyTenant,
      seedCookieWorks,
    });

    expect(deleteLegacyTenant).not.toHaveBeenCalled();
    expect(seedCookieWorks).not.toHaveBeenCalled();
    expect(result.verification).toBeNull();
  });

  it("executes destructive replacement then seeds CookieWorks foundation", async () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN;

    const deleteLegacy = await import(
      "../../scripts/qa-tenant/delete-legacy-hosted-demo"
    );
    const tenantInventory = await import(
      "../../scripts/qa-tenant/tenant-inventory"
    );
    const tenantStorage = await import(
      "../../scripts/qa-tenant/tenant-storage-cleanup"
    );
    const verificationModule = await import(
      "../../scripts/qa-tenant/verification"
    );

    vi.spyOn(deleteLegacy, "resolveLegacyHostedDemoOrganisation").mockReturnValue(
      LEGACY_HOSTED_DEMO_ORGANISATION,
    );
    vi.spyOn(tenantInventory, "collectTenantInventory").mockImplementation(
      (_databaseUrl, organisationCode) => {
        if (organisationCode === "cookieworks-manufacturing") {
          return {
            organisation: null,
            sections: [],
          };
        }

        return {
          organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
          sections: [],
        };
      },
    );
    vi.spyOn(tenantStorage, "countTenantStorageObjects").mockReturnValue(0);
    vi.spyOn(deleteLegacy, "listLegacyHostedDemoAuthUserIds").mockReturnValue(
      [],
    );
    vi.spyOn(
      deleteLegacy,
      "listLegacyHostedDemoDeletableAuthUserIds",
    ).mockReturnValue([]);
    vi.spyOn(deleteLegacy, "assertLegacyHostedDemoAbsent").mockImplementation(
      () => undefined,
    );

    const deleteLegacyTenant = vi.fn().mockResolvedValue({
      deletedAuthUserIds: ["user-1"],
    });
    const seedCookieWorks = vi.fn().mockResolvedValue({
      organisationId: "cookieworks-org-id",
      inventory: {},
      verification: { isFoundationOnly: true },
    });
    vi.spyOn(
      verificationModule,
      "assertCookieWorksFoundationOnlyVerified",
    ).mockReturnValue({
      organisation: {
        id: "cookieworks-org-id",
        code: "cookieworks-manufacturing",
        name: "CookieWorks Manufacturing",
      },
      foundationCounts: [],
      moduleTableCounts: [],
      indirectCounts: [],
      failures: [],
      isFoundationOnly: true,
    });
    vi.spyOn(verificationModule, "formatVerificationSummary").mockReturnValue(
      "FOUNDATION-ONLY VERIFIED",
    );

    const result = await runHostedTenantReplacement({
      argv: ["--destructive"],
      credentials: hostedCredentials,
      deleteLegacyTenant,
      seedCookieWorks,
    });

    expect(deleteLegacyTenant).toHaveBeenCalledTimes(1);
    expect(seedCookieWorks).toHaveBeenCalledTimes(1);
    expect(result.verification?.isFoundationOnly).toBe(true);
  });

  it("refuses destructive replacement when CookieWorks already exists", async () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN;

    const deleteLegacy = await import(
      "../../scripts/qa-tenant/delete-legacy-hosted-demo"
    );
    const tenantInventory = await import(
      "../../scripts/qa-tenant/tenant-inventory"
    );
    const tenantStorage = await import(
      "../../scripts/qa-tenant/tenant-storage-cleanup"
    );

    vi.spyOn(deleteLegacy, "resolveLegacyHostedDemoOrganisation").mockReturnValue(
      LEGACY_HOSTED_DEMO_ORGANISATION,
    );
    vi.spyOn(tenantInventory, "collectTenantInventory").mockImplementation(
      (_databaseUrl, organisationCode) => {
        if (organisationCode === "cookieworks-manufacturing") {
          return {
            organisation: {
              id: "cookieworks-org-id",
              code: "cookieworks-manufacturing",
              name: "CookieWorks Manufacturing",
            },
            sections: [],
          };
        }

        return {
          organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
          sections: [],
        };
      },
    );
    vi.spyOn(tenantStorage, "countTenantStorageObjects").mockReturnValue(0);
    vi.spyOn(deleteLegacy, "listLegacyHostedDemoAuthUserIds").mockReturnValue(
      [],
    );
    vi.spyOn(
      deleteLegacy,
      "listLegacyHostedDemoDeletableAuthUserIds",
    ).mockReturnValue([]);

    await expect(
      runHostedTenantReplacement({
        argv: ["--destructive"],
        credentials: hostedCredentials,
        deleteLegacyTenant: vi.fn(),
        seedCookieWorks: vi.fn(),
      }),
    ).rejects.toThrow(/CookieWorks organisation .* already exists/i);
  });
});
