/**
 * Tenant-scoped private notification infrastructure purge and inventory.
 *
 * Deletion graph (children before parents):
 *   notification_delivery_provider_envelopes -> notification_delivery_ledger -> domain_event_outbox
 *   notification_projector_pre_cutover_skips -> domain_event_outbox
 *   session_organisation_contexts (organisation-scoped; no outbox FK)
 */

export type TenantPrivateInfrastructureCounts = {
  notification_delivery_provider_envelopes: number;
  notification_delivery_ledger: number;
  domain_event_outbox: number;
  notification_projector_pre_cutover_skips: number;
  session_organisation_contexts: number;
};

export const EMPTY_PRIVATE_INFRASTRUCTURE_COUNTS: TenantPrivateInfrastructureCounts =
  {
    notification_delivery_provider_envelopes: 0,
    notification_delivery_ledger: 0,
    domain_event_outbox: 0,
    notification_projector_pre_cutover_skips: 0,
    session_organisation_contexts: 0,
  };

/**
 * Emits tenant-scoped DELETE statements for private notification infrastructure.
 * `targetOrgIdExpression` must be a PL/pgSQL expression resolving to the target UUID
 * (for example `target_org_id`).
 */
export function buildTenantPrivateInfrastructurePurgeStatements(
  targetOrgIdExpression: string,
) {
  return `
  delete from private.notification_delivery_provider_envelopes
  where organisation_id = ${targetOrgIdExpression};

  delete from private.notification_delivery_ledger
  where organisation_id = ${targetOrgIdExpression};

  delete from private.notification_projector_pre_cutover_skips skip_row
  where exists (
    select 1
    from private.domain_event_outbox outbox_row
    where outbox_row.organisation_id = ${targetOrgIdExpression}
      and outbox_row.organisation_id = skip_row.organisation_id
      and outbox_row.id = skip_row.event_id
  );

  delete from private.domain_event_outbox
  where organisation_id = ${targetOrgIdExpression};

  delete from private.session_organisation_contexts
  where organisation_id = ${targetOrgIdExpression};
`;
}

export function buildTenantPrivateInfrastructureCountSql(
  organisationId: string,
) {
  return `
    select
      (select count(*)::int
       from private.notification_delivery_provider_envelopes
       where organisation_id = '${organisationId}'::uuid) as notification_delivery_provider_envelopes,
      (select count(*)::int
       from private.notification_delivery_ledger
       where organisation_id = '${organisationId}'::uuid) as notification_delivery_ledger,
      (select count(*)::int
       from private.domain_event_outbox
       where organisation_id = '${organisationId}'::uuid) as domain_event_outbox,
      (select count(*)::int
       from private.notification_projector_pre_cutover_skips skip_row
       where exists (
         select 1
         from private.domain_event_outbox outbox_row
         where outbox_row.organisation_id = '${organisationId}'::uuid
           and outbox_row.organisation_id = skip_row.organisation_id
           and outbox_row.id = skip_row.event_id
       )) as notification_projector_pre_cutover_skips,
      (select count(*)::int
       from private.session_organisation_contexts
       where organisation_id = '${organisationId}'::uuid) as session_organisation_contexts;
  `;
}

export function formatPrivateInfrastructureCountLines(
  counts: TenantPrivateInfrastructureCounts,
) {
  return [
    `  - private.notification_delivery_provider_envelopes: ${counts.notification_delivery_provider_envelopes}`,
    `  - private.notification_delivery_ledger: ${counts.notification_delivery_ledger}`,
    `  - private.domain_event_outbox: ${counts.domain_event_outbox}`,
    `  - private.notification_projector_pre_cutover_skips: ${counts.notification_projector_pre_cutover_skips}`,
    `  - private.session_organisation_contexts: ${counts.session_organisation_contexts}`,
  ];
}

export function collectPrivateInfrastructureAbsenceFailures(
  counts: TenantPrivateInfrastructureCounts,
) {
  const failures: string[] = [];

  if (counts.notification_delivery_provider_envelopes > 0) {
    failures.push(
      `private.notification_delivery_provider_envelopes=${counts.notification_delivery_provider_envelopes}`,
    );
  }
  if (counts.notification_delivery_ledger > 0) {
    failures.push(
      `private.notification_delivery_ledger=${counts.notification_delivery_ledger}`,
    );
  }
  if (counts.domain_event_outbox > 0) {
    failures.push(`private.domain_event_outbox=${counts.domain_event_outbox}`);
  }
  if (counts.notification_projector_pre_cutover_skips > 0) {
    failures.push(
      `private.notification_projector_pre_cutover_skips=${counts.notification_projector_pre_cutover_skips}`,
    );
  }
  if (counts.session_organisation_contexts > 0) {
    failures.push(
      `private.session_organisation_contexts=${counts.session_organisation_contexts}`,
    );
  }

  return failures;
}
