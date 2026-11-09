/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const pendingByKey = new Map<string, Promise<unknown>>();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
      return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);
        const existing = pendingByKey.get(key);
        if (existing) {
          return existing;
        }
        const pending = Promise.resolve(fn(...args));
        pendingByKey.set(key, pending);
        return pending;
      }) as T;
    },
  };
});

const loadCurrentOrganisationBilling = vi.fn();

vi.mock("@/modules/billing/current-billing", () => ({
  loadCurrentOrganisationBilling: (...args: unknown[]) =>
    loadCurrentOrganisationBilling(...args),
}));

const loadCurrentOrganisationId = vi.fn();

vi.mock("@/modules/organisations/context", () => ({
  loadCurrentOrganisationId: () => loadCurrentOrganisationId(),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ tag: "server-client" })),
}));

type EntitlementsModule =
  typeof import("@/modules/billing/load-current-entitlements");

async function importEntitlementsModule(): Promise<EntitlementsModule> {
  return import("@/modules/billing/load-current-entitlements");
}

describe("loadCurrentOrganisationEntitlements", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    pendingByKey.clear();
    loadCurrentOrganisationBilling.mockImplementation(async () => ({
      plan_code: "professional",
      billing_state: "active",
    }));
  });

  it("fetches billing at most once per organisation per request scope", async () => {
    loadCurrentOrganisationId.mockResolvedValue("org-a");
    const { loadCurrentOrganisationEntitlements } =
      await importEntitlementsModule();

    await Promise.all([
      loadCurrentOrganisationEntitlements(),
      loadCurrentOrganisationEntitlements(),
      loadCurrentOrganisationEntitlements(),
      loadCurrentOrganisationEntitlements(),
      loadCurrentOrganisationEntitlements(),
    ]);

    expect(loadCurrentOrganisationBilling).toHaveBeenCalledTimes(1);
  });

  it("does not share cached entitlements across organisation ids", async () => {
    const { loadCurrentOrganisationEntitlements } =
      await importEntitlementsModule();

    loadCurrentOrganisationId.mockResolvedValue("org-a");
    const entitlementsA = await loadCurrentOrganisationEntitlements();

    loadCurrentOrganisationId.mockResolvedValue("org-b");
    loadCurrentOrganisationBilling.mockImplementationOnce(async () => ({
      plan_code: "essentials",
      billing_state: "active",
    }));
    const entitlementsB = await loadCurrentOrganisationEntitlements();

    expect(loadCurrentOrganisationBilling).toHaveBeenCalledTimes(2);
    expect(entitlementsA.modules.benefits).toBe(true);
    expect(entitlementsB.modules.benefits).toBe(false);

    loadCurrentOrganisationId.mockResolvedValue("org-a");
    const entitlementsAAgain = await loadCurrentOrganisationEntitlements();

    expect(loadCurrentOrganisationBilling).toHaveBeenCalledTimes(2);
    expect(entitlementsAAgain).toEqual(entitlementsA);
  });
});
