import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildInventoryFromSqlPayload,
  isFoundationOnlyInventory,
} from "../../scripts/qa-tenant/inventory";
import type { InventorySqlPayload } from "../../scripts/qa-tenant/inventory-sql";
import { SupabaseDbQueryParseError } from "../../scripts/qa-tenant/db-query-result";
import * as dbCli from "../../scripts/qa-tenant/db-cli";
import { collectCookieWorksInventoryViaSql } from "../../scripts/qa-tenant/inventory-sql";

describe("buildInventoryFromSqlPayload", () => {
  const foundationPayload: InventorySqlPayload = {
    organisation: {
      id: "org-id",
      code: "cookieworks-manufacturing",
      name: "CookieWorks Manufacturing",
    },
    counts: {
      memberships: 7,
      units: 1,
      role_grants: 7,
      storage_objects: 0,
      maturity_models: 0,
      suggestions: 0,
    },
  };

  it("builds inventory when organisation exists", () => {
    const inventory = buildInventoryFromSqlPayload(foundationPayload);

    expect(inventory.organisation?.code).toBe("cookieworks-manufacturing");
    expect(isFoundationOnlyInventory(inventory)).toBe(true);
  });

  it("does not treat missing organisation as foundation-only pass", () => {
    const inventory = buildInventoryFromSqlPayload({
      organisation: null,
      counts: {},
    });

    expect(inventory.organisation).toBeNull();
    expect(isFoundationOnlyInventory(inventory)).toBe(false);
  });

  it("fails foundation-only when module records exist", () => {
    const inventory = buildInventoryFromSqlPayload({
      ...foundationPayload,
      counts: {
        ...foundationPayload.counts,
        suggestions: 3,
      },
    });

    expect(isFoundationOnlyInventory(inventory)).toBe(false);
  });

  it("allows retained template infrastructure after module-foundation-only purge", () => {
    const inventory = buildInventoryFromSqlPayload({
      ...foundationPayload,
      counts: {
        ...foundationPayload.counts,
        templates: 2,
      },
    });

    expect(isFoundationOnlyInventory(inventory)).toBe(true);
  });
});

describe("collectCookieWorksInventoryViaSql", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails when query returns zero rows", () => {
    vi.spyOn(dbCli, "runSupabaseDbQueryJson").mockReturnValue([]);

    expect(() =>
      collectCookieWorksInventoryViaSql("postgresql://example"),
    ).toThrow(SupabaseDbQueryParseError);
  });

  it("fails when inventory column is missing", () => {
    vi.spyOn(dbCli, "runSupabaseDbQueryJson").mockReturnValue([{ other: 1 }]);

    expect(() =>
      collectCookieWorksInventoryViaSql("postgresql://example"),
    ).toThrow("missing inventory column");
  });

  it("fails when inventory payload is malformed", () => {
    vi.spyOn(dbCli, "runSupabaseDbQueryJson").mockReturnValue([
      { inventory: { organisation: null } },
    ]);

    expect(() =>
      collectCookieWorksInventoryViaSql("postgresql://example"),
    ).toThrow("Inventory row is malformed");
  });

  it("returns payload for valid one-row inventory", () => {
    vi.spyOn(dbCli, "runSupabaseDbQueryJson").mockReturnValue([
      {
        inventory: {
          organisation: {
            id: "id",
            code: "cookieworks-manufacturing",
            name: "CookieWorks Manufacturing",
          },
          counts: { memberships: 7, suggestions: 0 },
        },
      },
    ]);

    const payload = collectCookieWorksInventoryViaSql("postgresql://example");
    expect(payload.organisation?.code).toBe("cookieworks-manufacturing");
    expect(payload.counts.memberships).toBe(7);
  });
});
