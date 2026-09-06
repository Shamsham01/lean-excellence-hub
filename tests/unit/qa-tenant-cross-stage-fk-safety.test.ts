import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  assertCrossStageForeignKeyDeletionOrderSafe,
  collectCrossStageForeignKeyInventory,
  collectUnsafeCrossStageForeignKeyEdges,
  evaluateCrossStageForeignKeyEdge,
} from "../../scripts/qa-tenant/cross-stage-fk-safety";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";

function isLocalSupabaseAvailable() {
  try {
    execFileSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    return true;
  } catch {
    return false;
  }
}

describe("cross-stage FK safety evaluation", () => {
  it("marks business_audit_events -> resource_records unsafe without deferred parent policy", () => {
    const edge = evaluateCrossStageForeignKeyEdge({
      constraintName: "business_audit_events_resource_fkey",
      childSchema: "public",
      childTable: "business_audit_events",
      childColumns: "organisation_id, resource_record_id",
      parentSchema: "public",
      parentTable: "resource_records",
      parentColumns: "organisation_id, id",
      onDelete: "RESTRICT",
    });

    expect(edge.childLifecycleStage).toBe("foundation-preserved");
    expect(edge.parentLifecycleStage).toBe("foundation-deferred");
    expect(edge.deletionOrderSafe).toBe(true);
  });

  it("flags unsafe edges when a deferred parent is treated as module-deleted", () => {
    const edge = evaluateCrossStageForeignKeyEdge({
      constraintName: "business_audit_events_resource_fkey",
      childSchema: "public",
      childTable: "business_audit_events",
      childColumns: "organisation_id, resource_record_id",
      parentSchema: "public",
      parentTable: "resource_records",
      parentColumns: "organisation_id, id",
      onDelete: "RESTRICT",
    });

    const unsafe = collectUnsafeCrossStageForeignKeyEdges([
      {
        ...edge,
        parentLifecycleStage: "module-deleted",
        deletionOrderSafe: false,
      },
    ]);

    expect(unsafe).toHaveLength(1);
    expect(unsafe[0]?.constraintName).toBe(
      "business_audit_events_resource_fkey",
    );
  });
});

describe
  .skipIf(!isLocalSupabaseAvailable())
  .sequential("cross-stage FK catalog against local Supabase", () => {
    it("passes the runtime deletion-order guard for the current schema", () => {
      const env = loadLocalSupabaseEnv("qa:cookie:seed");
      const inventory = assertCrossStageForeignKeyDeletionOrderSafe(
        env.databaseUrl,
      );

      const businessAuditResourceEdge = inventory.find(
        (edge) => edge.constraintName === "business_audit_events_resource_fkey",
      );

      expect(businessAuditResourceEdge).toBeDefined();
      expect(businessAuditResourceEdge?.deletionOrderSafe).toBe(true);
      expect(collectUnsafeCrossStageForeignKeyEdges(inventory)).toHaveLength(0);
    });

    it("derives the business_audit_events -> resource_records RESTRICT edge", () => {
      const env = loadLocalSupabaseEnv("qa:cookie:seed");
      const inventory = collectCrossStageForeignKeyInventory(env.databaseUrl);
      const edge = inventory.find(
        (entry) =>
          entry.constraintName === "business_audit_events_resource_fkey",
      );

      expect(edge).toMatchObject({
        childTable: "business_audit_events",
        parentTable: "resource_records",
        onDelete: "RESTRICT",
      });
    });
  });
