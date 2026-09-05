import { describe, expect, it } from "vitest";

import {
  buildLegacyHostedDemoModulePurgeSql,
  buildPurgeTenantModuleDataSql,
} from "../../scripts/qa-tenant/tenant-purge-sql";
import {
  buildTenantPrivateInfrastructureCountSql,
  buildTenantPrivateInfrastructurePurgeStatements,
  collectPrivateInfrastructureAbsenceFailures,
  formatPrivateInfrastructureCountLines,
} from "../../scripts/qa-tenant/private-infrastructure-purge";

describe("tenant private infrastructure purge SQL", () => {
  it("deletes pre-cutover skip rows before domain_event_outbox", () => {
    const purgeSql =
      buildTenantPrivateInfrastructurePurgeStatements("target_org_id");
    const skipIndex = purgeSql.indexOf(
      "delete from private.notification_projector_pre_cutover_skips",
    );
    const outboxIndex = purgeSql.indexOf(
      "delete from private.domain_event_outbox",
    );

    expect(skipIndex).toBeGreaterThanOrEqual(0);
    expect(outboxIndex).toBeGreaterThan(skipIndex);
  });

  it("scopes pre-cutover skip deletion through tenant outbox rows", () => {
    const purgeSql =
      buildTenantPrivateInfrastructurePurgeStatements("target_org_id");

    expect(purgeSql).toContain("from private.domain_event_outbox outbox_row");
    expect(purgeSql).toContain("outbox_row.organisation_id = target_org_id");
    expect(purgeSql).not.toContain(
      "delete from private.notification_projector_pre_cutover_skips;",
    );
  });

  it("includes the private infrastructure purge in tenant module purge SQL", () => {
    const modulePurgeSql = buildPurgeTenantModuleDataSql(
      "lean-excellence-demo",
    );
    const skipIndex = modulePurgeSql.indexOf(
      "notification_projector_pre_cutover_skips",
    );
    const outboxIndex = modulePurgeSql.indexOf(
      "delete from private.domain_event_outbox",
    );

    expect(skipIndex).toBeGreaterThanOrEqual(0);
    expect(outboxIndex).toBeGreaterThan(skipIndex);
  });

  it("classifies append-only tables before the generic delete loop", () => {
    const modulePurgeSql = buildLegacyHostedDemoModulePurgeSql();
    const controlledDeleteIndex = modulePurgeSql.indexOf(
      "disable trigger ai_usage_events_append_only",
    );
    const genericLoopIndex = modulePurgeSql.indexOf(
      "foreach table_name in array deletable_tables loop",
    );

    expect(controlledDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(genericLoopIndex).toBeGreaterThan(controlledDeleteIndex);
  });

  it("counts pre-cutover skip rows through tenant outbox relationship", () => {
    const countSql = buildTenantPrivateInfrastructureCountSql(
      "402811bb-aa05-4128-b7e5-a1e3b359b92e",
    );

    expect(countSql).toContain(
      "from private.notification_projector_pre_cutover_skips skip_row",
    );
    expect(countSql).toContain("from private.domain_event_outbox outbox_row");
  });

  it("formats dry-run private infrastructure inventory lines", () => {
    const lines = formatPrivateInfrastructureCountLines({
      notification_delivery_provider_envelopes: 8,
      notification_delivery_ledger: 11,
      domain_event_outbox: 61,
      notification_projector_pre_cutover_skips: 4,
      session_organisation_contexts: 4,
    });

    expect(lines).toContain(
      "  - private.notification_projector_pre_cutover_skips: 4",
    );
  });

  it("flags remaining private infrastructure rows during absence verification", () => {
    const failures = collectPrivateInfrastructureAbsenceFailures({
      notification_delivery_provider_envelopes: 0,
      notification_delivery_ledger: 0,
      domain_event_outbox: 0,
      notification_projector_pre_cutover_skips: 2,
      session_organisation_contexts: 0,
    });

    expect(failures).toEqual([
      "private.notification_projector_pre_cutover_skips=2",
    ]);
  });
});
