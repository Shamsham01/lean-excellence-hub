import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  assertCrossStageForeignKeyDeletionOrderSafe,
  buildCrossStageForeignKeyGuardStatements,
  collectCrossStageForeignKeyInventory,
  collectUnsafeCrossStageForeignKeyEdges,
  evaluateCrossStageForeignKeyEdge,
  getFoundationPreservedPublicTableNames,
} from "../../scripts/qa-tenant/cross-stage-fk-safety";
import { buildLegacyHostedDemoModulePurgeSql } from "../../scripts/qa-tenant/tenant-purge-sql";
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
  it("A) treats business_audit_events -> resource_records as safe when resource_records is deferred", () => {
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

  it("B) flags synthetic foundation child -> module parent RESTRICT edges as unsafe", () => {
    const edge = evaluateCrossStageForeignKeyEdge({
      constraintName: "synthetic_membership_action_fkey",
      childSchema: "public",
      childTable: "organisation_memberships",
      childColumns: "organisation_id, id",
      parentSchema: "public",
      parentTable: "actions",
      parentColumns: "organisation_id, id",
      onDelete: "RESTRICT",
    });

    expect(edge.childLifecycleStage).toBe("foundation-preserved");
    expect(edge.parentLifecycleStage).toBe("module-deleted");
    expect(edge.deletionOrderSafe).toBe(false);
    expect(collectUnsafeCrossStageForeignKeyEdges([edge])).toHaveLength(1);
  });

  it("C) includes the full foundation-preserved public allowlist in the PostgreSQL guard", () => {
    const guard = buildCrossStageForeignKeyGuardStatements();

    for (const tableName of getFoundationPreservedPublicTableNames()) {
      expect(guard).toContain(`'${tableName}'`);
    }

    expect(guard).toContain("'workforce_aliases'");
    expect(guard).not.toMatch(
      /kcu\.table_name in \(\s*'security_audit_events',\s*'business_audit_events'\s*\)/,
    );
  });

  it("D) places the PostgreSQL guard before the first destructive mutation", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();
    const guardIndex = sql.indexOf("unsafe cross-stage FK dependencies");
    const firstMutationIndex = sql.indexOf(
      "delete from private.notification_projector_pre_cutover_skips",
    );

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(firstMutationIndex).toBeGreaterThan(guardIndex);
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

    it("returns exact composite column mapping for business_audit_events_resource_fkey", () => {
      const env = loadLocalSupabaseEnv("qa:cookie:seed");
      const inventory = collectCrossStageForeignKeyInventory(env.databaseUrl);
      const edge = inventory.find(
        (entry) =>
          entry.constraintName === "business_audit_events_resource_fkey",
      );

      expect(edge).toMatchObject({
        childTable: "business_audit_events",
        childColumns: "organisation_id, resource_record_id",
        parentTable: "resource_records",
        parentColumns: "organisation_id, id",
        onDelete: "RESTRICT",
      });
      expect(edge?.childColumns).not.toMatch(
        /organisation_id.*organisation_id/,
      );
      expect(edge?.parentColumns).not.toMatch(/\bid, id\b/);
    });
  });
