import { QA_ORGANISATION_CODE } from "./constants";
import { SupabaseDbQueryParseError } from "./db-query-result";
import { runSupabaseDbQueryJson } from "./db-cli";

const INVENTORY_SQL = `
with target_org as (
  select id, code, name
  from public.organisations
  where code = '${QA_ORGANISATION_CODE}'
  limit 1
)
select jsonb_build_object(
  'organisation', (
    select jsonb_build_object('id', id, 'code', code, 'name', name)
    from target_org
  ),
  'counts', jsonb_build_object(
    'memberships', (select count(*) from public.organisation_memberships m join target_org o on o.id = m.organisation_id),
    'units', (select count(*) from public.organisation_units u join target_org o on o.id = u.organisation_id),
    'role_grants', (select count(*) from public.access_grants g join target_org o on o.id = g.organisation_id),
    'maturity_models', (select count(*) from public.maturity_models t join target_org o on o.id = t.organisation_id),
    'maturity_assessments', (select count(*) from public.maturity_assessments t join target_org o on o.id = t.organisation_id),
    'maturity_evidence', (select count(*) from public.maturity_evidence_links t join target_org o on o.id = t.organisation_id),
    'five_s_standards', (select count(*) from public.five_s_standards t join target_org o on o.id = t.organisation_id),
    'five_s_audits', (select count(*) from public.five_s_audits t join target_org o on o.id = t.organisation_id),
    'gemba_definitions', (select count(*) from public.gemba_definitions t join target_org o on o.id = t.organisation_id),
    'gemba_walks', (select count(*) from public.gemba_walks t join target_org o on o.id = t.organisation_id),
    'schedule_definitions', (select count(*) from public.schedule_definitions t join target_org o on o.id = t.organisation_id),
    'schedule_occurrences', (select count(*) from public.schedule_occurrences t join target_org o on o.id = t.organisation_id),
    'training_courses', (select count(*) from public.training_courses t join target_org o on o.id = t.organisation_id),
    'training_sessions', (select count(*) from public.training_sessions t join target_org o on o.id = t.organisation_id),
    'training_completions', (select count(*) from public.training_completions t join target_org o on o.id = t.organisation_id),
    'job_functions', (select count(*) from public.job_functions t join target_org o on o.id = t.organisation_id),
    'skill_assessments', (select count(*) from public.membership_skill_assessments t join target_org o on o.id = t.organisation_id),
    'suggestions', (select count(*) from public.improvement_suggestions t join target_org o on o.id = t.organisation_id),
    'recognition_awards', (select count(*) from public.recognition_awards t join target_org o on o.id = t.organisation_id),
    'ci_projects', (select count(*) from public.ci_projects t join target_org o on o.id = t.organisation_id),
    'benefits', (select count(*) from public.improvement_benefits t join target_org o on o.id = t.organisation_id),
    'benefit_forecasts', (select count(*) from public.benefit_forecast_versions t join target_org o on o.id = t.organisation_id),
    'benefit_realisations', (select count(*) from public.benefit_realisation_entries t join target_org o on o.id = t.organisation_id),
    'problem_solving_cases', (select count(*) from public.problem_solving_cases t join target_org o on o.id = t.organisation_id),
    'ai_sessions', (select count(*) from public.ai_sessions t join target_org o on o.id = t.organisation_id),
    'actions', (select count(*) from public.actions t join target_org o on o.id = t.organisation_id),
    'templates', (select count(*) from public.templates t join target_org o on o.id = t.organisation_id),
    'attachments', (select count(*) from public.attachments t join target_org o on o.id = t.organisation_id),
    'comments', (select count(*) from public.comments t join target_org o on o.id = t.organisation_id),
    'storage_objects', (
      select count(*)
      from storage.objects object_row
      join target_org o on object_row.name like o.id::text || '/%'
      where object_row.bucket_id = 'organisation-evidence'
    )
  )
) as inventory;
`;

export type InventorySqlPayload = {
  organisation: { id: string; code: string; name: string } | null;
  counts: Record<string, number>;
};

function parseInventoryPayload(
  inventory: unknown,
  stdoutBytes: number,
): InventorySqlPayload {
  if (
    typeof inventory !== "object" ||
    inventory === null ||
    !("organisation" in inventory) ||
    !("counts" in inventory)
  ) {
    throw new SupabaseDbQueryParseError(
      "Inventory row is malformed: expected object with organisation and counts.",
      stdoutBytes,
    );
  }

  const payload = inventory as InventorySqlPayload;

  if (
    payload.counts === null ||
    typeof payload.counts !== "object" ||
    Array.isArray(payload.counts)
  ) {
    throw new SupabaseDbQueryParseError(
      "Inventory row counts field is malformed.",
      stdoutBytes,
    );
  }

  return payload;
}

export function collectCookieWorksInventoryViaSql(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<{ inventory?: InventorySqlPayload }>(
    {
      databaseUrl,
      outputFormat: "json",
      sql: INVENTORY_SQL,
    },
    { minRows: 1, maxRows: 1 },
  );

  const row = rows[0];
  if (!row?.inventory) {
    throw new SupabaseDbQueryParseError(
      `Inventory SQL first row is missing inventory column; row keys: [${Object.keys(row ?? {}).sort().join(", ")}].`,
      0,
    );
  }

  return parseInventoryPayload(row.inventory, 0);
}
