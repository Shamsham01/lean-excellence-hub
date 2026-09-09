import { afterEach, describe, expect, it, vi } from "vitest";

import {
  QA_FOUNDATION_CONTRACT,
  QA_ORGANISATION_CODE,
} from "../../scripts/qa-tenant/constants";
import {
  assertHostedResetAllowed,
  parseHostedResetArgs,
  resolveHostedCredentials,
} from "../../scripts/qa-tenant/guards";
import { runHostedCookieWorksReset } from "../../scripts/qa-tenant/hosted-reset";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

const hostedCredentials = {
  apiUrl: "https://abc123.supabase.co",
  serviceRoleKey: "service-role-key",
  expectedProjectRef: "abc123",
  publishableKey: "publishable-key",
  databaseUrl:
    "postgresql://postgres:postgres@db.abc123.supabase.co:5432/postgres",
};

describe("hosted CookieWorks reset guards", () => {
  it("rejects localhost Supabase URLs", () => {
    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "http://127.0.0.1:54321",
        expectedProjectRef: "abc123",
        organisationCode: QA_ORGANISATION_CODE,
        mode: "dry-run",
      }),
    ).toThrow(/requires a hosted Supabase API URL/i);
  });

  it("requires destructive confirmation token for destructive mode", () => {
    delete process.env.LEANHUB_QA_RESET_CONFIRM;

    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: QA_ORGANISATION_CODE,
        mode: "destructive",
      }),
    ).toThrow(/LEANHUB_QA_RESET_CONFIRM/i);
  });

  it("does not require destructive confirmation token for dry-run", () => {
    delete process.env.LEANHUB_QA_RESET_CONFIRM;

    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: QA_ORGANISATION_CODE,
        mode: "dry-run",
      }),
    ).not.toThrow();
  });
});

describe("hosted CookieWorks reset runner", () => {
  it("uses read-only verification during dry-run and skips destructive work", async () => {
    const purgeModules = vi.fn();
    const seedFoundation = vi.fn();
    const inventory = {
      organisation: {
        id: "org-uuid",
        code: QA_ORGANISATION_CODE,
        name: "CookieWorks Manufacturing",
      },
      sections: [],
    };
    const verification = {
      organisation: inventory.organisation,
      foundationCounts: [],
      moduleTableCounts: [],
      indirectCounts: [],
      failures: [],
      isFoundationOnly: true,
    };

    const inventoryModule = await import("../../scripts/qa-tenant/inventory");
    const storageModule =
      await import("../../scripts/qa-tenant/storage-cleanup");
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");

    vi.spyOn(inventoryModule, "collectCookieWorksInventory").mockReturnValue(
      inventory as never,
    );
    vi.spyOn(inventoryModule, "formatInventoryReport").mockReturnValue(
      "inventory-report",
    );
    vi.spyOn(storageModule, "countCookieWorksStorageObjects").mockReturnValue(
      0,
    );
    vi.spyOn(verificationModule, "verifyCookieWorksTenant").mockReturnValue(
      verification,
    );
    vi.spyOn(
      verificationModule,
      "assertCookieWorksCompleteFoundationVerified",
    ).mockResolvedValue({
      organisation: inventory.organisation,
      verification,
      membershipCount: QA_FOUNDATION_CONTRACT.personas,
      unitCount: QA_FOUNDATION_CONTRACT.units,
      roleGrantCount: QA_FOUNDATION_CONTRACT.personas,
    });
    vi.spyOn(verificationModule, "formatVerificationSummary").mockReturnValue(
      "FOUNDATION-ONLY VERIFIED",
    );

    const result = await runHostedCookieWorksReset({
      argv: ["--dry-run"],
      credentials: hostedCredentials,
      purgeModules,
      seedFoundation,
    });

    expect(result.mode).toBe("dry-run");
    expect(result.foundationVerification).toBeNull();
    expect(purgeModules).not.toHaveBeenCalled();
    expect(seedFoundation).not.toHaveBeenCalled();
    expect(
      verificationModule.assertCookieWorksCompleteFoundationVerified,
    ).not.toHaveBeenCalled();
    expect(verificationModule.verifyCookieWorksTenant).toHaveBeenCalledTimes(1);
  });

  it("verifies the complete PR4 foundation contract after destructive reset", async () => {
    const purgeModules = vi.fn().mockResolvedValue(undefined);
    const seedFoundation = vi.fn().mockResolvedValue({
      organisationId: "org-uuid",
      unitIds: {},
    });
    const inventory = {
      organisation: {
        id: "org-uuid",
        code: QA_ORGANISATION_CODE,
        name: "CookieWorks Manufacturing",
      },
      sections: [],
    };
    const verification = {
      organisation: inventory.organisation,
      foundationCounts: [],
      moduleTableCounts: [],
      indirectCounts: [],
      failures: [],
      isFoundationOnly: true,
    };

    const inventoryModule = await import("../../scripts/qa-tenant/inventory");
    const storageModule =
      await import("../../scripts/qa-tenant/storage-cleanup");
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");

    vi.spyOn(inventoryModule, "collectCookieWorksInventory").mockReturnValue(
      inventory as never,
    );
    vi.spyOn(inventoryModule, "formatInventoryReport").mockReturnValue(
      "inventory-report",
    );
    vi.spyOn(storageModule, "countCookieWorksStorageObjects").mockReturnValue(
      0,
    );
    vi.spyOn(verificationModule, "verifyCookieWorksTenant").mockReturnValue(
      verification,
    );
    const completeVerifierSpy = vi
      .spyOn(verificationModule, "assertCookieWorksCompleteFoundationVerified")
      .mockResolvedValue({
        organisation: inventory.organisation,
        verification,
        membershipCount: QA_FOUNDATION_CONTRACT.personas,
        unitCount: QA_FOUNDATION_CONTRACT.units,
        roleGrantCount: QA_FOUNDATION_CONTRACT.personas,
      });
    vi.spyOn(verificationModule, "formatVerificationSummary").mockReturnValue(
      "FOUNDATION-ONLY VERIFIED",
    );

    process.env.LEANHUB_QA_RESET_CONFIRM = "DELETE_COOKIEWORKS_ONLY";

    const result = await runHostedCookieWorksReset({
      argv: ["--destructive"],
      credentials: hostedCredentials,
      purgeModules,
      seedFoundation,
    });

    expect(purgeModules).toHaveBeenCalledTimes(1);
    expect(seedFoundation).toHaveBeenCalledTimes(1);
    expect(completeVerifierSpy).toHaveBeenCalledTimes(1);
    expect(completeVerifierSpy).toHaveBeenCalledWith(
      hostedCredentials.databaseUrl,
      expect.objectContaining({
        auth: expect.objectContaining({ autoRefreshToken: false }),
      }),
    );
    expect(result.foundationVerification?.membershipCount).toBe(
      QA_FOUNDATION_CONTRACT.personas,
    );
    expect(result.foundationVerification?.unitCount).toBe(
      QA_FOUNDATION_CONTRACT.units,
    );
  });
});

describe("hosted CookieWorks reset CLI args", () => {
  it("defaults to dry-run mode", () => {
    expect(parseHostedResetArgs([])).toEqual({
      mode: "dry-run",
      destructive: false,
    });
  });
});

describe("hosted CookieWorks reset credentials", () => {
  it("requires explicit hosted credentials", () => {
    delete process.env.LEANHUB_QA_RESET_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.LEANHUB_QA_RESET_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.LEANHUB_QA_RESET_PROJECT_REF;
    delete process.env.LEANHUB_QA_RESET_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.LEANHUB_QA_RESET_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    expect(() => resolveHostedCredentials()).toThrow(
      /LEANHUB_QA_RESET_SUPABASE_URL/i,
    );
  });
});
