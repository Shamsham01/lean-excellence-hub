import { describe, expect, it } from "vitest";

import {
  assertDeletionGraphPolicyConsistency,
  FOUNDATION_STAGE_DEPENDENCY_TABLES,
  MODULE_PURGE_INFRASTRUCTURE_TABLES,
  FOUNDATION_TABLES,
} from "../../scripts/qa-tenant/deletion-graph";
import {
  assertTenantRetirementPolicyConsistency,
  buildAppendOnlyUnknownGuardStatements,
  buildControlledRetirementDeleteStatements,
  buildFoundationStageAppendOnlyDeleteStatements,
  classifyDiscoveredAppendOnlyTable,
  collectAppendOnlyInventoryFailures,
  FOUNDATION_STAGE_APPEND_ONLY_TABLES,
  formatAppendOnlyInventoryLines,
  getApprovedAppendOnlyTableNames,
  getFoundationStageAppendOnlyTableNames,
  getModuleStageControlledRetirementTableNames,
  getModuleStageStandardAppendOnlyTableNames,
  MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES,
  MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES,
} from "../../scripts/qa-tenant/tenant-retirement-policy";
import {
  buildLegacyHostedDemoModulePurgeSql,
  buildPurgeTenantModuleDataSql,
} from "../../scripts/qa-tenant/tenant-purge-sql";
import { buildDeleteLegacyHostedDemoOrganisationSql } from "../../scripts/qa-tenant/delete-legacy-hosted-demo";
import { buildCrossStageForeignKeyGuardStatements } from "../../scripts/qa-tenant/cross-stage-fk-safety";

describe("tenant retirement policy", () => {
  it("passes policy consistency checks for foundation vs module classification", () => {
    expect(() =>
      assertTenantRetirementPolicyConsistency(FOUNDATION_TABLES),
    ).not.toThrow();
    expect(() => assertDeletionGraphPolicyConsistency()).not.toThrow();
  });

  it("classifies unknown append-only tables as unknown", () => {
    expect(classifyDiscoveredAppendOnlyTable("future_unknown_table")).toBe(
      "unknown",
    );
  });

  it("keeps known module and foundation classifications", () => {
    expect(classifyDiscoveredAppendOnlyTable("ai_usage_events")).toBe("module");
    expect(
      classifyDiscoveredAppendOnlyTable("benefit_overlap_allocation_history"),
    ).toBe("module");
    expect(classifyDiscoveredAppendOnlyTable("security_audit_events")).toBe(
      "foundation",
    );
    expect(classifyDiscoveredAppendOnlyTable("business_audit_events")).toBe(
      "foundation",
    );
  });

  it("lists module-stage custom append-only tables with controlled retirement triggers", () => {
    expect(
      MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.map((entry) => entry.table),
    ).toEqual(["ai_usage_events", "benefit_overlap_allocation_history"]);
  });

  it("lists explicit module-stage standard append-only tables", () => {
    expect(getModuleStageStandardAppendOnlyTableNames()).toEqual(
      MODULE_STAGE_STANDARD_APPEND_ONLY_TABLES.map((entry) => entry.table),
    );
    expect(getModuleStageStandardAppendOnlyTableNames().length).toBeGreaterThan(
      0,
    );
  });

  it("lists foundation-stage append-only audit ledgers", () => {
    expect(getFoundationStageAppendOnlyTableNames()).toEqual([
      "security_audit_events",
      "business_audit_events",
    ]);
  });

  it("keeps foundation-stage audit tables in FOUNDATION_TABLES", () => {
    for (const policy of FOUNDATION_STAGE_APPEND_ONLY_TABLES) {
      expect(FOUNDATION_TABLES).toContain(policy.table);
    }
  });

  it("formats append-only dry-run inventory lines with lifecycle stage", () => {
    const lines = formatAppendOnlyInventoryLines([
      { table: "ai_usage_events", count: 3, lifecycleStage: "module" },
      {
        table: "security_audit_events",
        count: 2,
        lifecycleStage: "foundation",
      },
      {
        table: "some_future_table",
        count: 1,
        lifecycleStage: "unknown",
      },
    ]);

    expect(lines).toEqual([
      "  - public.ai_usage_events [module]: 3",
      "  - public.security_audit_events [foundation]: 2",
      "  - public.some_future_table [unknown]: 1",
    ]);
  });

  it("flags module-stage append-only rows during module purge verification", () => {
    const failures = collectAppendOnlyInventoryFailures(
      [
        { table: "ai_usage_events", count: 2, lifecycleStage: "module" },
        {
          table: "security_audit_events",
          count: 1,
          lifecycleStage: "foundation",
        },
        {
          table: "some_future_table",
          count: 4,
          lifecycleStage: "unknown",
        },
      ],
      "module-purge",
    );

    expect(failures).toEqual(["public.ai_usage_events=2"]);
  });

  it("flags all append-only rows during full absence verification", () => {
    const failures = collectAppendOnlyInventoryFailures(
      [
        { table: "ai_usage_events", count: 1, lifecycleStage: "module" },
        {
          table: "security_audit_events",
          count: 1,
          lifecycleStage: "foundation",
        },
      ],
      "full-absence",
    );

    expect(failures).toEqual([
      "public.ai_usage_events=1",
      "public.security_audit_events=1",
    ]);
  });

  it("does not flag append-only rows during module foundation purge verification", () => {
    const failures = collectAppendOnlyInventoryFailures(
      [{ table: "ai_usage_events", count: 2, lifecycleStage: "module" }],
      "module-foundation-only",
    );

    expect(failures).toEqual([]);
  });

  it("covers every approved append-only table in exactly one lifecycle stage", () => {
    const approved = getApprovedAppendOnlyTableNames();
    const unique = new Set(approved);

    expect(unique.size).toBe(approved.length);
    expect(
      approved.every(
        (table) => classifyDiscoveredAppendOnlyTable(table) !== "unknown",
      ),
    ).toBe(true);
  });
});

describe("tenant purge SQL classification", () => {
  it("excludes append-only tables from the generic delete loop", () => {
    const sql = buildPurgeTenantModuleDataSql("cookieworks-manufacturing");

    expect(sql).toContain("deletable_tables");
    expect(sql).toContain("table_name <> all(append_only_tables)");
    expect(sql).not.toContain("SQLERRM like '%is append-only%'");
  });

  it("runs module-stage controlled append-only retirement deletes for legacy full removal", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();

    expect(sql).toContain("purge_retention text := 'full-tenant-removal'");
    expect(sql).toContain("disable trigger ai_usage_events_append_only");
    expect(sql).toContain("delete from public.ai_usage_events");
    expect(sql).toContain("module_stage_append_only_tables");
    expect(sql).toContain(
      "left module-stage append-only rows after controlled retirement delete",
    );
  });

  it("contains a pre-mutation unknown append-only guard for full tenant removal", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();
    const guard = buildAppendOnlyUnknownGuardStatements();
    const privatePurgeIndex = sql.indexOf(
      "delete from private.notification_projector_pre_cutover_skips",
    );
    const guardIndex = sql.indexOf(
      "Tenant module purge blocked: unclassified append-only tables discovered",
    );

    expect(guard).toContain("unclassified append-only tables discovered");
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(privatePurgeIndex).toBeGreaterThan(guardIndex);
  });

  it("does not target foundation audit ledgers during module-stage controlled retirement", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();
    const statements =
      buildControlledRetirementDeleteStatements("target_org_id");

    expect(sql).not.toContain("delete from public.security_audit_events");
    expect(sql).not.toContain("delete from public.business_audit_events");
    expect(statements).not.toContain("security_audit_events_append_only");
    expect(statements).not.toContain("business_audit_events_prevent_delete");
    expect(statements).not.toContain("for rec in");
    expect(statements).not.toContain("prevent_update_or_delete%'");
  });

  it("does not delete deferred resource_records during full-removal module purge", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();
    const moduleSection = sql.slice(
      0,
      sql.indexOf("Tenant module purge complete"),
    );

    expect(moduleSection).not.toMatch(
      /delete from public\.resource_records\b/i,
    );
  });

  it("includes a pre-mutation cross-stage FK guard for full tenant removal", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();
    const guard = buildCrossStageForeignKeyGuardStatements();

    expect(guard).toContain("unsafe cross-stage FK dependencies");
    expect(sql).toContain("unsafe cross-stage FK dependencies");
    expect(sql.indexOf("unsafe cross-stage FK dependencies")).toBeLessThan(
      sql.indexOf(
        "delete from private.notification_projector_pre_cutover_skips",
      ),
    );
  });

  it("deletes foundation dependencies only after append-only audit retirement", () => {
    const sql = buildDeleteLegacyHostedDemoOrganisationSql();
    const auditDeleteIndex = sql.indexOf(
      "delete from public.business_audit_events",
    );
    const resourceDeleteIndex = sql.indexOf(
      "delete from public.resource_records",
    );
    const membershipDeleteIndex = sql.indexOf(
      "delete from public.organisation_memberships",
    );

    expect(auditDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(resourceDeleteIndex).toBeGreaterThan(auditDeleteIndex);
    expect(membershipDeleteIndex).toBeGreaterThan(resourceDeleteIndex);
  });

  it("builds module-stage controlled retirement delete statements only for approved tables", () => {
    const statements =
      buildControlledRetirementDeleteStatements("target_org_id");

    for (const tableName of getModuleStageControlledRetirementTableNames()) {
      expect(statements).toContain(`delete from public.${tableName}`);
    }
    expect(statements).toContain("ai_usage_events_append_only");
    expect(statements).toContain(
      "benefit_overlap_allocation_history_guard_mutation",
    );
    expect(statements).toContain("action_status_transitions_prevent_delete");
    expect(statements).not.toContain(
      "maturity_official_results_prevent_delete",
    );
  });

  it("builds foundation-stage append-only delete statements before membership removal", () => {
    const statements =
      buildFoundationStageAppendOnlyDeleteStatements("target_org_id");

    expect(statements).toContain("business_audit_events_prevent_delete");
    expect(statements).toContain("security_audit_events_append_only");
    expect(statements).toContain(
      "Must run before organisation_memberships deletion",
    );
  });

  it("keeps foundation-stage dependency tables out of module-purge infrastructure", () => {
    for (const dependencyTable of FOUNDATION_STAGE_DEPENDENCY_TABLES) {
      expect(MODULE_PURGE_INFRASTRUCTURE_TABLES).not.toContain(dependencyTable);
    }
  });
});
