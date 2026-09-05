import { describe, expect, it, vi } from "vitest";

import { collectTenantInventoryViaSql } from "../../scripts/qa-tenant/tenant-inventory-sql";
import { buildPurgeTenantModuleDataSql } from "../../scripts/qa-tenant/tenant-purge-sql";

vi.mock("../../scripts/qa-tenant/db-cli", () => ({
  runSupabaseDbQueryJson: vi.fn(),
}));

describe("tenant inventory SQL", () => {
  it("collects inventory for an arbitrary organisation code", async () => {
    const { runSupabaseDbQueryJson } = await import(
      "../../scripts/qa-tenant/db-cli"
    );

    vi.mocked(runSupabaseDbQueryJson).mockReturnValue([
      {
        inventory: {
          organisation: {
            id: "402811bb-aa05-4128-b7e5-a1e3b359b92e",
            code: "lean-excellence-demo",
            name: "Lean Excellence Demo",
          },
          counts: {
            memberships: 8,
            units: 4,
            role_grants: 7,
            maturity_models: 1,
            storage_objects: 2,
          },
        },
      },
    ]);

    const payload = collectTenantInventoryViaSql(
      "postgresql://example",
      "lean-excellence-demo",
    );

    expect(payload.organisation?.code).toBe("lean-excellence-demo");
    expect(payload.counts.memberships).toBe(8);
    expect(payload.counts.storage_objects).toBe(2);
  });
});

describe("tenant purge SQL", () => {
  it("parameterises organisation code in purge SQL", () => {
    const sql = buildPurgeTenantModuleDataSql("lean-excellence-demo");
    expect(sql).toContain("target_org_code text := 'lean-excellence-demo'");
    expect(sql).toContain("Tenant module purge complete");
  });
});
