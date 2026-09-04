import { afterEach, describe, expect, it, vi } from "vitest";

import { QA_ORGANISATION_CODE } from "../../scripts/qa-tenant/constants";
import {
  assertHostedSeedAllowed,
  resolveHostedSeedCredentials,
} from "../../scripts/qa-tenant/guards";
import { runHostedCookieWorksSeed } from "../../scripts/qa-tenant/hosted-seed";

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

describe("hosted CookieWorks seed guards", () => {
  it("rejects localhost Supabase URLs", () => {
    expect(() =>
      assertHostedSeedAllowed({
        apiUrl: "http://127.0.0.1:54321",
        expectedProjectRef: "abc123",
      }),
    ).toThrow(/blocked for local Supabase URLs/i);
  });

  it("rejects unexpected hosted project refs", () => {
    expect(() =>
      assertHostedSeedAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "different-ref",
      }),
    ).toThrow(/expected project ref/i);
  });

  it("rejects invocation from Next.js application runtime", () => {
    process.env.NEXT_RUNTIME = "nodejs";

    expect(() =>
      assertHostedSeedAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
      }),
    ).toThrow(/Next\.js application runtime/i);

    delete process.env.NEXT_RUNTIME;
  });

  it("does not require destructive reset confirmation token", () => {
    delete process.env.LEANHUB_QA_RESET_CONFIRM;

    expect(() =>
      assertHostedSeedAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
      }),
    ).not.toThrow();
  });

  it("requires explicit hosted seed credentials", () => {
    delete process.env.LEANHUB_QA_RESET_SUPABASE_URL;
    delete process.env.LEANHUB_QA_RESET_SERVICE_ROLE_KEY;
    delete process.env.LEANHUB_QA_RESET_PROJECT_REF;
    delete process.env.LEANHUB_QA_RESET_PUBLISHABLE_KEY;

    expect(() => resolveHostedSeedCredentials()).toThrow(
      /LEANHUB_QA_RESET_SUPABASE_URL/i,
    );
  });
});

describe("hosted CookieWorks seed runner", () => {
  it("calls the existing foundation seed contract and returns verification", async () => {
    const seedFoundation = vi.fn().mockResolvedValue({
      organisationId: "org-uuid",
      unitIds: { "bodmin-cookie-factory": "unit-uuid" },
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
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");

    vi.spyOn(inventoryModule, "collectCookieWorksInventory").mockReturnValue(
      inventory as never,
    );
    vi.spyOn(inventoryModule, "formatInventoryReport").mockReturnValue(
      "inventory-report",
    );
    vi.spyOn(
      verificationModule,
      "assertCookieWorksFoundationOnlyVerified",
    ).mockReturnValue(verification);
    vi.spyOn(verificationModule, "formatVerificationSummary").mockReturnValue(
      "FOUNDATION-ONLY VERIFIED",
    );

    const result = await runHostedCookieWorksSeed({
      credentials: hostedCredentials,
      seedFoundation,
    });

    expect(seedFoundation).toHaveBeenCalledTimes(1);
    expect(seedFoundation).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: hostedCredentials.apiUrl,
        publishableKey: hostedCredentials.publishableKey,
      }),
    );
    expect(result.verification.isFoundationOnly).toBe(true);
    expect(result.organisationId).toBe("org-uuid");
  });

  it("requires database URL for post-seed verification", async () => {
    await expect(
      runHostedCookieWorksSeed({
        credentials: {
          ...hostedCredentials,
          databaseUrl: undefined,
        },
        seedFoundation: vi.fn(),
      }),
    ).rejects.toThrow(/LEANHUB_QA_RESET_DATABASE_URL/i);
  });

  it("remains safe to invoke repeatedly through the foundation seed contract", async () => {
    const seedFoundation = vi.fn().mockResolvedValue({
      organisationId: "org-uuid",
      unitIds: {},
    });

    const inventoryModule = await import("../../scripts/qa-tenant/inventory");
    const verificationModule =
      await import("../../scripts/qa-tenant/verification");

    vi.spyOn(inventoryModule, "collectCookieWorksInventory").mockReturnValue({
      organisation: {
        id: "org-uuid",
        code: QA_ORGANISATION_CODE,
        name: "CookieWorks Manufacturing",
      },
      sections: [],
    } as never);
    vi.spyOn(inventoryModule, "formatInventoryReport").mockReturnValue(
      "inventory-report",
    );
    vi.spyOn(
      verificationModule,
      "assertCookieWorksFoundationOnlyVerified",
    ).mockReturnValue({
      organisation: {
        id: "org-uuid",
        code: QA_ORGANISATION_CODE,
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

    await runHostedCookieWorksSeed({
      credentials: hostedCredentials,
      seedFoundation,
    });
    await runHostedCookieWorksSeed({
      credentials: hostedCredentials,
      seedFoundation,
    });

    expect(seedFoundation).toHaveBeenCalledTimes(2);
  });
});
