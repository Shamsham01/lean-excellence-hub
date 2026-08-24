import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Milestone 3 OAuth boundary", () => {
  it("cannot enable Azure through runtime configuration", async () => {
    process.env.OAUTH_ENABLED_PROVIDERS = "azure";
    process.env.OAUTH_AZURE_TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const { beginOAuth, isEnabledOAuthProvider } =
      await import("@/modules/identity/oauth");

    expect(isEnabledOAuthProvider("azure")).toBe(false);
    await expect(beginOAuth("azure")).rejects.toThrow(
      "disabled and deferred beyond Milestone 3",
    );

    delete process.env.OAUTH_ENABLED_PROVIDERS;
    delete process.env.OAUTH_AZURE_TENANT_ID;
  });
});
