import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AI_DEFAULTS, parseAiEnvironment } from "@/platform/ai/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseAiEnvironment", () => {
  it("accepts supported reasoning effort values", () => {
    expect(
      parseAiEnvironment({ AI_MODEL_REASONING: "low" }).AI_MODEL_REASONING,
    ).toBe("low");
  });

  it("rejects invalid reasoning effort values", () => {
    expect(() => parseAiEnvironment({ AI_MODEL_REASONING: "turbo" })).toThrow();
  });

  it("does not invent reasoning effort when omitted", () => {
    expect(parseAiEnvironment({}).AI_MODEL_REASONING).toBeUndefined();
  });

  it("defaults max output tokens to the safe structured budget", () => {
    expect(AI_DEFAULTS.maxOutputTokens).toBe(6000);
  });

  it("defaults Problem Solving to gpt-6.1-sol when AI_MODEL_DEFAULT is unset", () => {
    expect(AI_DEFAULTS.model).toBe("gpt-6.1-sol");
  });

  it("treats AI_ENABLED=0 as a disabled application provider", () => {
    expect(parseAiEnvironment({ AI_ENABLED: "0" }).AI_ENABLED).toBe("0");
  });

  it("accepts optional logical model class mappings", () => {
    const env = parseAiEnvironment({
      AI_MODEL_ECONOMY: "gpt-6-luna",
      AI_MODEL_STANDARD: "gpt-6.1-terra",
      AI_MODEL_DEEP: "gpt-6.1-sol",
    });
    expect(env.AI_MODEL_ECONOMY).toBe("gpt-6-luna");
    expect(env.AI_MODEL_STANDARD).toBe("gpt-6.1-terra");
    expect(env.AI_MODEL_DEEP).toBe("gpt-6.1-sol");
  });
});

describe("isApplicationAiProviderAvailable", () => {
  it("allows fake provider in production when E2E_WITH_SUPABASE=1 (Playwright webServer)", async () => {
    vi.resetModules();
    vi.stubEnv("AI_ENABLED", "1");
    vi.stubEnv("AI_PROVIDER", "fake");
    vi.stubEnv("AI_ALLOW_FAKE_PROVIDER", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_WITH_SUPABASE", "1");

    const { isApplicationAiProviderAvailable } =
      await import("@/platform/ai/config");
    expect(isApplicationAiProviderAvailable()).toBe(true);
  });

  it("allows fake provider in development without E2E_WITH_SUPABASE", async () => {
    vi.resetModules();
    vi.stubEnv("AI_ENABLED", "1");
    vi.stubEnv("AI_PROVIDER", "fake");
    vi.stubEnv("AI_ALLOW_FAKE_PROVIDER", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_WITH_SUPABASE", "");

    const { isApplicationAiProviderAvailable } =
      await import("@/platform/ai/config");
    expect(isApplicationAiProviderAvailable()).toBe(true);
  });

  it("blocks fake provider in production when E2E_WITH_SUPABASE is unset (e.g. hosted)", async () => {
    vi.resetModules();
    vi.stubEnv("AI_ENABLED", "1");
    vi.stubEnv("AI_PROVIDER", "fake");
    vi.stubEnv("AI_ALLOW_FAKE_PROVIDER", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_WITH_SUPABASE", "");
    vi.stubEnv("CI", "true");

    const { isApplicationAiProviderAvailable } =
      await import("@/platform/ai/config");
    expect(isApplicationAiProviderAvailable()).toBe(false);
  });

  it("blocks fake provider in production when E2E_WITH_SUPABASE is empty string", async () => {
    vi.resetModules();
    vi.stubEnv("AI_ENABLED", "1");
    vi.stubEnv("AI_PROVIDER", "fake");
    vi.stubEnv("AI_ALLOW_FAKE_PROVIDER", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_WITH_SUPABASE", "");
    vi.stubEnv("CI", "1");

    const { isApplicationAiProviderAvailable } =
      await import("@/platform/ai/config");
    expect(isApplicationAiProviderAvailable()).toBe(false);
  });
});
