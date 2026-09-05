import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HOSTED_PRELAUNCH_PROJECT_REF,
  LEGACY_HOSTED_DEMO_ORGANISATION,
  QA_HOSTED_RECOVERY_CONFIRM_TOKEN,
  QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN,
} from "../../scripts/qa-tenant/legacy-hosted-demo";
import {
  assertHostedReplacementAllowed,
  assertLegacyHostedDemoTargetContract,
} from "../../scripts/qa-tenant/guards";
import {
  assertAuthIdentitySeparation,
  buildHostedReplacementPlan,
  formatDryRunRecoveryAssessment,
  formatHostedReplacementPlan,
  runHostedTenantReplacement,
} from "../../scripts/qa-tenant/hosted-replacement";
import { HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER } from "../../scripts/qa-tenant/verification";

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

const planDetailsFixture = {
  legacyOrganisation: LEGACY_HOSTED_DEMO_ORGANISATION,
  membershipCount: 8,
  members: [
    {
      user_id: "user-1",
      email: "legacy-1@lean-excellence.local",
      display_name: "Legacy Member 1",
      membership_count: 1,
      legacy_only: true,
      conflicting_organisations: [],
    },
    {
      user_id: "user-2",
      email: "legacy-2@lean-excellence.local",
      display_name: "Legacy Member 2",
      membership_count: 1,
      legacy_only: true,
      conflicting_organisations: [],
    },
  ],
  foundation: {
    organisational_units: 4,
    roles: 5,
    role_versions: 5,
    role_grants: 7,
    memberships: 8,
    invitations: 0,
  },
  privateInfrastructure: {
    notification_delivery_provider_envelopes: 1,
    notification_delivery_ledger: 2,
    domain_event_outbox: 3,
    notification_projector_pre_cutover_skips: 4,
    session_organisation_contexts: 0,
  },
  storageObjectCount: 3,
  moduleRowTotal: 12,
  appendOnlyInventory: [],
  inventoryReport:
    "Legacy hosted demo inventory\nOrganisation: Lean Excellence Demo",
};

const cookieWorksOrganisation = {
  id: "7994b7fe-de98-49eb-aec1-4b9731d9264e",
  code: "cookieworks-manufacturing",
  name: "CookieWorks Manufacturing",
};

function mockReplacementDependencies(options?: {
  cookieWorksPresent?: boolean;
}) {
  const cookieWorksPresent = options?.cookieWorksPresent ?? false;

  return Promise.all([
    import("../../scripts/qa-tenant/delete-legacy-hosted-demo"),
    import("../../scripts/qa-tenant/legacy-replacement-plan"),
    import("../../scripts/qa-tenant/tenant-inventory"),
  ]).then(([deleteLegacyModule, planModule, tenantInventoryModule]) => {
    vi.spyOn(
      deleteLegacyModule,
      "resolveLegacyHostedDemoOrganisation",
    ).mockReturnValue(LEGACY_HOSTED_DEMO_ORGANISATION);
    vi.spyOn(planModule, "collectLegacyReplacementPlanDetails").mockReturnValue(
      planDetailsFixture,
    );
    vi.spyOn(
      tenantInventoryModule,
      "collectTenantInventory",
    ).mockImplementation((_databaseUrl, organisationCode) => ({
      organisation:
        organisationCode === "cookieworks-manufacturing"
          ? cookieWorksPresent
            ? cookieWorksOrganisation
            : null
          : LEGACY_HOSTED_DEMO_ORGANISATION,
      sections: [],
    }));

    return { deleteLegacyModule, planModule, tenantInventoryModule };
  });
}

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

  it("requires recovery confirmation token for preserve-existing-cookieworks", () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN;

    expect(() =>
      assertHostedReplacementAllowed({
        apiUrl: hostedCredentials.apiUrl,
        expectedProjectRef: HOSTED_PRELAUNCH_PROJECT_REF,
        mode: "destructive",
        preserveExistingCookieWorks: true,
      }),
    ).toThrow(QA_HOSTED_RECOVERY_CONFIRM_TOKEN);
  });

  it("accepts recovery confirmation token for preserve-existing-cookieworks", () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_RECOVERY_CONFIRM_TOKEN;

    expect(() =>
      assertHostedReplacementAllowed({
        apiUrl: hostedCredentials.apiUrl,
        expectedProjectRef: HOSTED_PRELAUNCH_PROJECT_REF,
        mode: "destructive",
        preserveExistingCookieWorks: true,
      }),
    ).not.toThrow();
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
    await mockReplacementDependencies({ cookieWorksPresent: false });

    const plan = buildHostedReplacementPlan({
      databaseUrl: hostedCredentials.databaseUrl,
      mode: "dry-run",
      projectRef: HOSTED_PRELAUNCH_PROJECT_REF,
    });

    const report = formatHostedReplacementPlan(plan);

    expect(report).toContain("Hosted pre-launch tenant replacement plan (QA2)");
    expect(report).toContain(LEGACY_HOSTED_DEMO_ORGANISATION.code);
    expect(report).toContain("legacy-1@lean-excellence.local");
    expect(report).toContain("private.domain_event_outbox: 3");
    expect(report).toContain(
      "private.notification_projector_pre_cutover_skips: 4",
    );
    expect(report).toContain("Dry-run only. No hosted data was modified.");
    expect(report).toContain(QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN);
    expect(plan.cookieWorksPresent).toBe(false);
  });

  it("formats recovery dry-run assessment when CookieWorks already exists", () => {
    const plan = {
      mode: "dry-run" as const,
      projectRef: HOSTED_PRELAUNCH_PROJECT_REF,
      preserveExistingCookieWorks: false,
      legacyOrganisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      legacyAuthUserIds: ["user-1", "user-2"],
      legacyDeletableAuthUserIds: ["user-1", "user-2"],
      cookieWorksPresent: true,
      cookieWorksOrganisationId: cookieWorksOrganisation.id,
      planDetails: planDetailsFixture,
    };

    const assessment = formatDryRunRecoveryAssessment({
      plan,
      legacyContractVerified: true,
      legacyAuthIsolationVerified: true,
      cookieWorksFoundationVerified: true,
      authIdentityOverlap: "none",
      cookieWorksOrganisationId: cookieWorksOrganisation.id,
    });

    expect(assessment).toContain("Legacy organisation: VERIFIED");
    expect(assessment).toContain("Legacy auth isolation: VERIFIED");
    expect(assessment).toContain("CookieWorks already present: YES");
    expect(assessment).toContain(
      "CookieWorks foundation-only contract: VERIFIED",
    );
    expect(assessment).toContain(
      `CookieWorks organisation UUID: ${cookieWorksOrganisation.id}`,
    );
    expect(assessment).toContain("Auth identity overlap: NONE");
    expect(assessment).toContain(
      "Ordinary destructive replacement: REFUSED because CookieWorks exists",
    );
    expect(assessment).toContain(
      "Recovery path available: --preserve-existing-cookieworks",
    );
    expect(assessment).toContain("No hosted data modified.");
  });
});

describe("hosted tenant replacement runner", () => {
  it("runs dry-run without modifying hosted data", async () => {
    const { deleteLegacyModule } = await mockReplacementDependencies();

    vi.spyOn(
      deleteLegacyModule,
      "captureLegacyDeletionContext",
    ).mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      membershipCount: 8,
      legacyAuthUserIds: ["user-1", "user-2"],
      deletableAuthUserIds: ["user-1", "user-2"],
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

    const { deleteLegacyModule } = await mockReplacementDependencies({
      cookieWorksPresent: false,
    });
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");

    vi.spyOn(
      deleteLegacyModule,
      "captureLegacyDeletionContext",
    ).mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      membershipCount: 8,
      legacyAuthUserIds: ["user-1"],
      deletableAuthUserIds: ["user-1"],
    });
    vi.spyOn(
      deleteLegacyModule,
      "assertLegacyHostedDemoAbsent",
    ).mockImplementation(() => undefined);

    const deleteLegacyTenant = vi.fn().mockResolvedValue({
      deletedAuthUserIds: ["user-1"],
      deletionContext: {
        organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
        membershipCount: 8,
        legacyAuthUserIds: ["user-1"],
        deletableAuthUserIds: ["user-1"],
      },
    });
    const seedCookieWorks = vi.fn().mockResolvedValue({
      organisationId: "cookieworks-org-id",
      inventory: {},
      verification: { isFoundationOnly: true },
    });
    vi.spyOn(
      verificationModule,
      "assertCookieWorksCompleteFoundationVerified",
    ).mockResolvedValue({
      organisation: {
        id: "cookieworks-org-id",
        code: "cookieworks-manufacturing",
        name: "CookieWorks Manufacturing",
      },
      verification: {
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
      },
      membershipCount: 7,
      unitCount: 10,
      roleGrantCount: 7,
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
    expect(result.verification?.verification.isFoundationOnly).toBe(true);
  });

  it("refuses destructive replacement when CookieWorks already exists", async () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN;

    await mockReplacementDependencies({ cookieWorksPresent: true });

    await expect(
      runHostedTenantReplacement({
        argv: ["--destructive"],
        credentials: hostedCredentials,
        deleteLegacyTenant: vi.fn(),
        seedCookieWorks: vi.fn(),
      }),
    ).rejects.toThrow(/CookieWorks organisation .* already exists/i);
  });

  it("executes recovery destructive path without seeding CookieWorks", async () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_RECOVERY_CONFIRM_TOKEN;

    const { deleteLegacyModule } = await mockReplacementDependencies({
      cookieWorksPresent: true,
    });
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");
    const dbModule = await import("../../scripts/qa-tenant/db-cli");

    vi.spyOn(
      deleteLegacyModule,
      "captureLegacyDeletionContext",
    ).mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      membershipCount: 8,
      legacyAuthUserIds: ["user-1"],
      deletableAuthUserIds: ["user-1"],
    });
    vi.spyOn(
      deleteLegacyModule,
      "assertLegacyHostedDemoAbsent",
    ).mockImplementation(() => undefined);
    vi.spyOn(dbModule, "runSupabaseDbQueryJson").mockReturnValue([
      { user_id: "cookie-user-1" },
    ]);
    vi.spyOn(
      verificationModule,
      "assertCookieWorksCompleteFoundationVerified",
    ).mockResolvedValue({
      organisation: cookieWorksOrganisation,
      verification: {
        organisation: cookieWorksOrganisation,
        foundationCounts: [],
        moduleTableCounts: [],
        indirectCounts: [],
        failures: [],
        isFoundationOnly: true,
      },
      membershipCount: 7,
      unitCount: 10,
      roleGrantCount: 7,
    });
    vi.spyOn(verificationModule, "formatVerificationSummary").mockReturnValue(
      "FOUNDATION-ONLY VERIFIED",
    );

    const deleteLegacyTenant = vi.fn().mockResolvedValue({
      deletedAuthUserIds: ["user-1"],
      deletionContext: {
        organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
        membershipCount: 8,
        legacyAuthUserIds: ["user-1"],
        deletableAuthUserIds: ["user-1"],
      },
    });
    const seedCookieWorks = vi.fn();

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await runHostedTenantReplacement({
      argv: ["--destructive", "--preserve-existing-cookieworks"],
      credentials: hostedCredentials,
      deleteLegacyTenant,
      seedCookieWorks,
    });

    expect(deleteLegacyTenant).toHaveBeenCalledTimes(1);
    expect(seedCookieWorks).not.toHaveBeenCalled();
    expect(result.verification?.organisation.id).toBe(
      cookieWorksOrganisation.id,
    );
    expect(consoleSpy.mock.calls.flat().join("\n")).toContain(
      HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER,
    );
  });

  it("refuses recovery when CookieWorks is missing", async () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_RECOVERY_CONFIRM_TOKEN;

    await mockReplacementDependencies({ cookieWorksPresent: false });

    await expect(
      runHostedTenantReplacement({
        argv: ["--destructive", "--preserve-existing-cookieworks"],
        credentials: hostedCredentials,
        deleteLegacyTenant: vi.fn(),
        seedCookieWorks: vi.fn(),
      }),
    ).rejects.toThrow(/CookieWorks organisation is not present/i);
  });

  it("refuses recovery when auth identities overlap", async () => {
    process.env.LEANHUB_QA_RESET_CONFIRM = QA_HOSTED_RECOVERY_CONFIRM_TOKEN;

    const { deleteLegacyModule } = await mockReplacementDependencies({
      cookieWorksPresent: true,
    });
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");
    const dbModule = await import("../../scripts/qa-tenant/db-cli");

    vi.spyOn(
      deleteLegacyModule,
      "captureLegacyDeletionContext",
    ).mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      membershipCount: 8,
      legacyAuthUserIds: ["shared-user"],
      deletableAuthUserIds: ["shared-user"],
    });
    vi.spyOn(
      verificationModule,
      "assertCookieWorksCompleteFoundationVerified",
    ).mockResolvedValue({
      organisation: cookieWorksOrganisation,
      verification: {
        organisation: cookieWorksOrganisation,
        foundationCounts: [],
        moduleTableCounts: [],
        indirectCounts: [],
        failures: [],
        isFoundationOnly: true,
      },
      membershipCount: 7,
      unitCount: 10,
      roleGrantCount: 7,
    });
    vi.spyOn(dbModule, "runSupabaseDbQueryJson").mockReturnValue([
      { user_id: "shared-user" },
    ]);

    await expect(
      runHostedTenantReplacement({
        argv: ["--destructive", "--preserve-existing-cookieworks"],
        credentials: hostedCredentials,
        deleteLegacyTenant: vi.fn(),
        seedCookieWorks: vi.fn(),
      }),
    ).rejects.toThrow(/Auth identity overlap detected/i);
  });
});

describe("auth identity separation", () => {
  it("aborts when legacy and CookieWorks auth user IDs overlap", async () => {
    const dbModule = await import("../../scripts/qa-tenant/db-cli");
    vi.spyOn(dbModule, "runSupabaseDbQueryJson").mockReturnValue([
      { user_id: "shared-user" },
      { user_id: "cookie-only-user" },
    ]);

    expect(() =>
      assertAuthIdentitySeparation(hostedCredentials.databaseUrl, [
        "shared-user",
        "legacy-only-user",
      ]),
    ).toThrow(/Auth identity overlap detected/i);
  });
});
