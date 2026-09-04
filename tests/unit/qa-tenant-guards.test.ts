import { afterEach, describe, expect, it } from "vitest";

import {
  QA_HOSTED_RESET_CONFIRM_TOKEN,
  QA_ORGANISATION_CODE,
} from "../../scripts/qa-tenant/constants";
import {
  assertHostedResetAllowed,
  assertQaLocalCommandAllowed,
  extractSupabaseProjectRef,
  isLocalSupabaseUrl,
  parseHostedResetArgs,
  resolveHostedSeedCredentials,
} from "../../scripts/qa-tenant/guards";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("QA tenant local guards", () => {
  it("allows local commands for localhost Supabase URLs via npm script", () => {
    process.env.npm_lifecycle_event = "qa:cookie:seed";

    expect(() =>
      assertQaLocalCommandAllowed("http://127.0.0.1:54321", "qa:cookie:seed"),
    ).not.toThrow();
  });

  it("blocks local commands for hosted Supabase URLs", () => {
    process.env.npm_lifecycle_event = "qa:cookie:seed";

    expect(() =>
      assertQaLocalCommandAllowed(
        "https://abc123.supabase.co",
        "qa:cookie:seed",
      ),
    ).toThrow(/blocked/i);
  });

  it("keeps qa:cookie:seed local-only even when hosted credentials are set", () => {
    process.env.npm_lifecycle_event = "qa:cookie:seed";
    process.env.LEANHUB_QA_RESET_SUPABASE_URL = "https://abc123.supabase.co";
    process.env.LEANHUB_QA_RESET_PROJECT_REF = "abc123";

    expect(() =>
      assertQaLocalCommandAllowed(
        "https://abc123.supabase.co",
        "qa:cookie:seed",
      ),
    ).toThrow(/blocked/i);
  });
});

describe("hosted QA reset guards", () => {
  it("parses dry-run mode by default", () => {
    expect(parseHostedResetArgs([])).toEqual({
      mode: "dry-run",
      destructive: false,
    });
    expect(parseHostedResetArgs(["--destructive"])).toEqual({
      mode: "destructive",
      destructive: true,
    });
  });

  it("extracts hosted project refs from Supabase URLs", () => {
    expect(extractSupabaseProjectRef("https://abc123.supabase.co")).toBe(
      "abc123",
    );
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
  });

  it("refuses destructive hosted reset without explicit confirmation token", () => {
    delete process.env.LEANHUB_QA_RESET_CONFIRM;

    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: QA_ORGANISATION_CODE,
        mode: "destructive",
      }),
    ).toThrow(QA_HOSTED_RESET_CONFIRM_TOKEN);
  });

  it("refuses hosted reset when project ref does not match URL", () => {
    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "different-ref",
        organisationCode: QA_ORGANISATION_CODE,
        mode: "dry-run",
      }),
    ).toThrow(/expected project ref/i);
  });

  it("refuses hosted reset for unexpected organisation codes", () => {
    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: "apex-manufacturing",
        mode: "dry-run",
      }),
    ).toThrow(/organisation code must be exactly/i);
  });

  it("refuses hosted reset from Next.js application runtime", () => {
    process.env.NEXT_RUNTIME = "nodejs";

    expect(() =>
      assertHostedResetAllowed({
        apiUrl: "https://abc123.supabase.co",
        expectedProjectRef: "abc123",
        organisationCode: QA_ORGANISATION_CODE,
        mode: "dry-run",
      }),
    ).toThrow(/Next\.js application runtime/i);

    delete process.env.NEXT_RUNTIME;
  });
});

describe("hosted CookieWorks seed credential resolution", () => {
  it("resolves hosted seed credentials from explicit runtime env vars", () => {
    process.env.LEANHUB_QA_RESET_SUPABASE_URL = "https://abc123.supabase.co";
    process.env.LEANHUB_QA_RESET_SERVICE_ROLE_KEY = "service-role-key";
    process.env.LEANHUB_QA_RESET_PROJECT_REF = "abc123";
    process.env.LEANHUB_QA_RESET_PUBLISHABLE_KEY = "publishable-key";
    process.env.LEANHUB_QA_RESET_DATABASE_URL =
      "postgresql://postgres:postgres@db.abc123.supabase.co:5432/postgres";

    expect(resolveHostedSeedCredentials()).toEqual({
      apiUrl: "https://abc123.supabase.co",
      serviceRoleKey: "service-role-key",
      expectedProjectRef: "abc123",
      publishableKey: "publishable-key",
      databaseUrl:
        "postgresql://postgres:postgres@db.abc123.supabase.co:5432/postgres",
    });
  });
});
