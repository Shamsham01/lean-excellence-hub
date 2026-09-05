import { describe, expect, it } from "vitest";

import { FOUNDATION_TABLES } from "../../scripts/qa-tenant/deletion-graph";
import {
  assertTenantRetirementPolicyConsistency,
  buildControlledRetirementDeleteStatements,
  buildFoundationStageAppendOnlyDeleteStatements,
  collectAppendOnlyInventoryFailures,
  FOUNDATION_STAGE_APPEND_ONLY_TABLES,
  formatAppendOnlyInventoryLines,
  getFoundationStageAppendOnlyTableNames,
  MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES,
} from "../../scripts/qa-tenant/tenant-retirement-policy";
import {
  buildLegacyHostedDemoModulePurgeSql,
  buildPurgeTenantModuleDataSql,
} from "../../scripts/qa-tenant/tenant-purge-sql";

describe("tenant retirement policy", () => {
  it("passes policy consistency checks for foundation vs module classification", () => {
    expect(() =>
      assertTenantRetirementPolicyConsistency(FOUNDATION_TABLES),
    ).not.toThrow();
  });

  it("lists module-stage custom append-only tables with controlled retirement triggers", () => {
    expect(
      MODULE_STAGE_CUSTOM_APPEND_ONLY_TABLES.map((entry) => entry.table),
    ).toEqual(["ai_usage_events", "benefit_overlap_allocation_history"]);
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
    ]);

    expect(lines).toEqual([
      "  - public.ai_usage_events [module]: 3",
      "  - public.security_audit_events [foundation]: 2",
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

  it("does not target foundation audit ledgers during module-stage controlled retirement", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();
    const statements =
      buildControlledRetirementDeleteStatements("target_org_id");

    expect(sql).not.toContain("delete from public.security_audit_events");
    expect(sql).not.toContain("delete from public.business_audit_events");
    expect(statements).not.toContain("security_audit_events_append_only");
    expect(statements).not.toContain("business_audit_events_prevent_delete");
    expect(statements).toContain(
      "event_object_table not in ('security_audit_events', 'business_audit_events')",
    );
  });

  it("builds module-stage controlled retirement delete statements for custom append-only tables", () => {
    const statements =
      buildControlledRetirementDeleteStatements("target_org_id");

    expect(statements).toContain("ai_usage_events_append_only");
    expect(statements).toContain(
      "benefit_overlap_allocation_history_guard_mutation",
    );
    expect(statements).toContain("prevent_update_or_delete");
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
});
