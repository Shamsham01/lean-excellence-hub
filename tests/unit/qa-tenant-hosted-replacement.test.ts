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
    session_organisation_contexts: 0,
  },
  storageObjectCount: 3,
  moduleRowTotal: 12,
  inventoryReport:
    "Legacy hosted demo inventory\nOrganisation: Lean Excellence Demo",
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
    const deleteLegacyModule =
      await import("../../scripts/qa-tenant/delete-legacy-hosted-demo");
    const planModule =
      await import("../../scripts/qa-tenant/legacy-replacement-plan");
    const tenantInventoryModule =
      await import("../../scripts/qa-tenant/tenant-inventory");

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
          ? null
          : LEGACY_HOSTED_DEMO_ORGANISATION,
      sections: [],
    }));

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
    expect(report).toContain("Dry-run only. No hosted data was modified.");
    expect(report).toContain(QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN);
    expect(plan.cookieWorksPresent).toBe(false);
  });
});

describe("hosted tenant replacement runner", () => {
  it("runs dry-run without modifying hosted data", async () => {
    const deleteLegacyModule =
      await import("../../scripts/qa-tenant/delete-legacy-hosted-demo");
    const planModule =
      await import("../../scripts/qa-tenant/legacy-replacement-plan");
    const tenantInventoryModule =
      await import("../../scripts/qa-tenant/tenant-inventory");

    vi.spyOn(
      deleteLegacyModule,
      "resolveLegacyHostedDemoOrganisation",
    ).mockReturnValue(LEGACY_HOSTED_DEMO_ORGANISATION);
    vi.spyOn(planModule, "collectLegacyReplacementPlanDetails").mockReturnValue(
      planDetailsFixture,
    );
    vi.spyOn(tenantInventoryModule, "collectTenantInventory").mockReturnValue({
      organisation: LEGACY_HOSTED_DEMO_ORGANISATION,
      sections: [],
    });
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

    const deleteLegacyModule =
      await import("../../scripts/qa-tenant/delete-legacy-hosted-demo");
    const planModule =
      await import("../../scripts/qa-tenant/legacy-replacement-plan");
    const tenantInventoryModule =
      await import("../../scripts/qa-tenant/tenant-inventory");
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");

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
          ? null
          : LEGACY_HOSTED_DEMO_ORGANISATION,
      sections: [],
    }));
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

    const deleteLegacyModule =
      await import("../../scripts/qa-tenant/delete-legacy-hosted-demo");
    const planModule =
      await import("../../scripts/qa-tenant/legacy-replacement-plan");
    const tenantInventoryModule =
      await import("../../scripts/qa-tenant/tenant-inventory");

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
          ? {
              id: "cookieworks-org-id",
              code: "cookieworks-manufacturing",
              name: "CookieWorks Manufacturing",
            }
          : LEGACY_HOSTED_DEMO_ORGANISATION,
      sections: [],
    }));

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
