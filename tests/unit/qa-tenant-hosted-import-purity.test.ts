import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("hosted QA module import purity", () => {
  it("importing hosted-seed does not execute the seed runner", async () => {
    const seedFoundation = vi.fn();
    const guardsModule = await import("../../scripts/qa-tenant/guards");
    vi.spyOn(guardsModule, "resolveHostedSeedCredentials").mockImplementation(
      () => {
        throw new Error("seed runner should not resolve credentials on import");
      },
    );

    const hostedSeedModule =
      await import("../../scripts/qa-tenant/hosted-seed");

    expect(hostedSeedModule.runHostedCookieWorksSeed).toBeTypeOf("function");
    expect(seedFoundation).not.toHaveBeenCalled();
  });

  it("importing hosted-replacement does not execute the replacement runner", async () => {
    const guardsModule = await import("../../scripts/qa-tenant/guards");
    vi.spyOn(guardsModule, "resolveHostedCredentials").mockImplementation(
      () => {
        throw new Error(
          "replacement runner should not resolve credentials on import",
        );
      },
    );

    const hostedReplacementModule =
      await import("../../scripts/qa-tenant/hosted-replacement");

    expect(hostedReplacementModule.runHostedTenantReplacement).toBeTypeOf(
      "function",
    );
  });
});

describe("hosted seed CLI entrypoint", () => {
  it("invokes runHostedCookieWorksSeed when the dedicated CLI is executed", async () => {
    const hostedSeedModule =
      await import("../../scripts/qa-tenant/hosted-seed");
    const runSpy = vi
      .spyOn(hostedSeedModule, "runHostedCookieWorksSeed")
      .mockResolvedValue({
        organisationId: "org-id",
        inventory: {
          organisation: null,
          sections: [],
          bootstrapExceptions: [],
        },
        verification: {
          organisation: null,
          foundationCounts: [],
          moduleTableCounts: [],
          indirectCounts: [],
          failures: [],
          isFoundationOnly: true,
        },
      });

    await import("../../scripts/qa-tenant/hosted-seed-cli");
    await new Promise((resolve) => setImmediate(resolve));

    expect(runSpy).toHaveBeenCalledTimes(1);
  });
});

function isLocalSupabaseAvailable() {
  try {
    execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

const hasLocalSupabase = isLocalSupabaseAvailable();

describe.skipIf(!hasLocalSupabase)(
  "hosted replacement CLI dry-run subprocess",
  () => {
    it("exits without invoking write-capable dependencies", () => {
      const output = execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/qa-tenant/hosted-replacement-cli.ts"],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            LEANHUB_QA_RESET_SUPABASE_URL:
              "https://zsadfvjtknbbfomlmttv.supabase.co",
            LEANHUB_QA_RESET_SERVICE_ROLE_KEY: "test-service-role-key",
            LEANHUB_QA_RESET_DATABASE_URL:
              "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
            LEANHUB_QA_RESET_PROJECT_REF: "zsadfvjtknbbfomlmttv",
            LEANHUB_QA_RESET_PUBLISHABLE_KEY: "test-publishable-key",
          },
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120_000,
        },
      );

      expect(output).toContain("Mode: dry-run");
      expect(output).toContain("No hosted data was modified.");
    }, 120_000);
  },
);
