import { describe, expect, it } from "vitest";

import {
  buildControlledRetirementDeleteStatements,
  collectAppendOnlyInventoryFailures,
  CUSTOM_APPEND_ONLY_DELETE_TABLES,
  formatAppendOnlyInventoryLines,
} from "../../scripts/qa-tenant/tenant-retirement-policy";
import {
  buildLegacyHostedDemoModulePurgeSql,
  buildPurgeTenantModuleDataSql,
} from "../../scripts/qa-tenant/tenant-purge-sql";

describe("tenant retirement policy", () => {
  it("lists custom append-only tables with controlled retirement triggers", () => {
    expect(
      CUSTOM_APPEND_ONLY_DELETE_TABLES.map((entry) => entry.table),
    ).toEqual(["ai_usage_events", "benefit_overlap_allocation_history"]);
  });

  it("formats append-only dry-run inventory lines", () => {
    const lines = formatAppendOnlyInventoryLines([
      { table: "ai_usage_events", count: 3 },
    ]);

    expect(lines).toEqual(["  - public.ai_usage_events: 3"]);
  });

  it("flags append-only rows during full tenant removal verification", () => {
    const failures = collectAppendOnlyInventoryFailures(
      [{ table: "ai_usage_events", count: 2 }],
      "full-tenant-removal",
    );

    expect(failures).toEqual(["public.ai_usage_events=2"]);
  });

  it("does not flag append-only rows during module foundation purge verification", () => {
    const failures = collectAppendOnlyInventoryFailures(
      [{ table: "ai_usage_events", count: 2 }],
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

  it("runs controlled append-only retirement deletes for legacy full removal", () => {
    const sql = buildLegacyHostedDemoModulePurgeSql();

    expect(sql).toContain("purge_retention text := 'full-tenant-removal'");
    expect(sql).toContain("disable trigger ai_usage_events_append_only");
    expect(sql).toContain("delete from public.ai_usage_events");
    expect(sql).toContain(
      "left append-only rows after controlled retirement delete",
    );
  });

  it("builds controlled retirement delete statements for custom append-only tables", () => {
    const statements =
      buildControlledRetirementDeleteStatements("target_org_id");

    expect(statements).toContain("ai_usage_events_append_only");
    expect(statements).toContain(
      "benefit_overlap_allocation_history_guard_mutation",
    );
    expect(statements).toContain("prevent_update_or_delete");
  });
});
