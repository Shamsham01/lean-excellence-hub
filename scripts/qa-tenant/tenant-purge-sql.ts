import {
  buildFullTenantRemovalFoundationBridgeClearStatements,
  foundationTableSqlList,
  foundationStageDependencyTableSqlList,
  MAX_MODULE_PURGE_PASSES,
  modulePurgeInfrastructureTableSqlList,
} from "./deletion-graph";
import { buildCrossStageForeignKeyGuardStatements } from "./cross-stage-fk-safety";
import { buildTenantPrivateInfrastructurePurgeStatements } from "./private-infrastructure-purge";
import {
  buildAppendOnlyUnknownGuardStatements,
  buildControlledRetirementDeleteStatements,
  moduleStageAppendOnlyTableSqlList,
  type TenantPurgeRetention,
} from "./tenant-retirement-policy";

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

export function buildPurgeTenantModuleDataSql(
  organisationCode: string,
  options?: { retention?: TenantPurgeRetention },
) {
  const targetOrgCode = escapeSqlLiteral(organisationCode);
  const retention = options?.retention ?? "module-foundation-only";

  return `
do $$
declare
  target_org_id uuid;
  target_org_code text := '${targetOrgCode}';
  purge_retention text := '${retention}';
  purge_table_name text;
  pass_count int := 0;
  deleted_rows int;
  total_deleted int := 0;
  tables text[];
  deletable_tables text[];
  remaining_count bigint;
  remaining_tables text[] := array[]::text[];
  indirect_remaining bigint;
  append_only_tables text[];
  module_stage_append_only_tables text[];
  append_only_table text;
  rec record;
  unknown_append_only_tables text[];
  cross_stage_fk_violations text[];
begin
  select id into target_org_id
  from public.organisations
  where code = target_org_code;

  if target_org_id is null then
    raise notice 'No organisation found for code %', target_org_code;
    return;
  end if;

${buildAppendOnlyUnknownGuardStatements({ indent: "  " })}

  if purge_retention = 'full-tenant-removal' then
${buildCrossStageForeignKeyGuardStatements({ indent: "    " })}
${buildFullTenantRemovalFoundationBridgeClearStatements("target_org_id", {
  indent: "    ",
})}
  end if;

${buildTenantPrivateInfrastructurePurgeStatements("target_org_id")}

  delete from public.organisation_invitation_signup_bindings
  where invitation_id in (
    select id
    from public.organisation_invitations
    where organisation_id = target_org_id
  );

  delete from public.workforce_import_row_credentials
  where import_row_id in (
    select id
    from public.workforce_import_rows
    where organisation_id = target_org_id
  );

  update public.template_submissions submission_row
  set status = 'draft',
      completed_at = null,
      updated_at = statement_timestamp()
  where submission_row.organisation_id = target_org_id
    and submission_row.status = 'completed';

  update public.template_versions template_version
  set status = 'archived',
      archived_at = coalesce(template_version.archived_at, statement_timestamp())
  where template_version.organisation_id = target_org_id
    and template_version.status = 'published';

  update public.maturity_model_versions maturity_version
  set status = 'archived'
  where maturity_version.organisation_id = target_org_id
    and maturity_version.status = 'published';

  alter table public.maturity_evidence_links
    disable trigger maturity_evidence_links_guard_immutable;
  alter table public.maturity_action_context
    disable trigger maturity_action_context_guard_immutable;
  alter table public.maturity_assessment_criterion_notes
    disable trigger maturity_assessment_criterion_notes_guard_immutable;
  alter table public.maturity_official_results
    disable trigger maturity_official_results_prevent_delete;
  alter table public.maturity_official_result_pillars
    disable trigger maturity_official_result_pillars_prevent_delete;
  alter table public.maturity_official_result_levels
    disable trigger maturity_official_result_levels_prevent_delete;

  delete from public.maturity_evidence_links
  where organisation_id = target_org_id;

  delete from public.maturity_action_context
  where organisation_id = target_org_id;

  delete from public.maturity_assessment_scores
  where organisation_id = target_org_id;

  delete from public.maturity_assessment_criterion_notes
  where organisation_id = target_org_id;

  delete from public.maturity_official_result_pillars
  where organisation_id = target_org_id;

  delete from public.maturity_official_result_levels
  where organisation_id = target_org_id;

  delete from public.maturity_official_results
  where organisation_id = target_org_id;

  alter table public.maturity_assessment_transitions
    disable trigger maturity_assessment_transitions_prevent_delete;

  delete from public.maturity_assessment_transitions
  where organisation_id = target_org_id;

  alter table public.maturity_assessment_transitions
    enable trigger maturity_assessment_transitions_prevent_delete;

  delete from public.maturity_assessment_participants
  where organisation_id = target_org_id;

  delete from public.maturity_assessments
  where organisation_id = target_org_id;

  delete from public.maturity_criterion_questions
  where organisation_id = target_org_id;

  delete from public.maturity_criteria
  where organisation_id = target_org_id;

  delete from public.maturity_pillars
  where organisation_id = target_org_id;

  delete from public.maturity_levels
  where organisation_id = target_org_id;

  delete from public.maturity_model_version_assessment_scopes
  where organisation_id = target_org_id;

  delete from public.maturity_model_versions
  where organisation_id = target_org_id;

  delete from public.maturity_models
  where organisation_id = target_org_id;

  alter table public.maturity_evidence_links
    enable trigger maturity_evidence_links_guard_immutable;
  alter table public.maturity_action_context
    enable trigger maturity_action_context_guard_immutable;
  alter table public.maturity_assessment_criterion_notes
    enable trigger maturity_assessment_criterion_notes_guard_immutable;
  alter table public.maturity_official_results
    enable trigger maturity_official_results_prevent_delete;
  alter table public.maturity_official_result_pillars
    enable trigger maturity_official_result_pillars_prevent_delete;
  alter table public.maturity_official_result_levels
    enable trigger maturity_official_result_levels_prevent_delete;

  select array_agg(c.table_name order by c.table_name)
  into tables
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
  where c.table_schema = 'public'
    and c.column_name = 'organisation_id'
    and t.table_type = 'BASE TABLE'
    and c.table_name not in (${foundationTableSqlList()});

  if tables is null then
    raise exception 'Tenant module purge failed: no module tables discovered from information_schema.';
  end if;

  select coalesce(
    array_agg(distinct discovered_append_only_table order by discovered_append_only_table),
    array[]::text[]
  )
  into append_only_tables
  from (
    select distinct event_object_table as discovered_append_only_table
    from information_schema.triggers
    where trigger_schema = 'public'
      and event_manipulation = 'DELETE'
      and action_statement ilike '%prevent_update_or_delete%'
    union
    select distinct event_object_table as discovered_append_only_table
    from information_schema.triggers
    where trigger_schema = 'public'
      and event_manipulation in ('DELETE', 'UPDATE')
      and (
        action_statement ilike '%prevent_ai_usage_event_mutation%'
        or action_statement ilike '%guard_benefit_overlap_allocation_history_mutation%'
      )
  ) append_only_inventory;

  select coalesce(
    array_agg(append_only_table_name order by append_only_table_name),
    array[]::text[]
  )
  into module_stage_append_only_tables
  from unnest(append_only_tables) as append_only_table_name
  where append_only_table_name in (${moduleStageAppendOnlyTableSqlList()});

  if purge_retention = 'full-tenant-removal' then
${buildControlledRetirementDeleteStatements("target_org_id", { indent: "    " })}
  end if;

  select coalesce(
    array_agg(module_table_name order by module_table_name),
    array[]::text[]
  )
  into deletable_tables
  from unnest(tables) as module_table_name
  where module_table_name <> all(append_only_tables)
    and module_table_name not in (${modulePurgeInfrastructureTableSqlList()})
    and module_table_name not in (${foundationStageDependencyTableSqlList()});

  if deletable_tables is null or coalesce(array_length(deletable_tables, 1), 0) = 0 then
    raise exception 'Tenant module purge failed: no deletable module tables remain after classification.';
  end if;

  for pass_count in 1..${MAX_MODULE_PURGE_PASSES} loop
    total_deleted := 0;

    foreach purge_table_name in array deletable_tables loop
      begin
        execute format(
          'delete from public.%I where organisation_id = $1',
          purge_table_name
        )
        using target_org_id;

        get diagnostics deleted_rows = row_count;
        total_deleted := total_deleted + deleted_rows;
      exception
        when foreign_key_violation then
          null;
        when others then
          raise exception 'Tenant module purge failed on public.%: %', purge_table_name, SQLERRM
            using errcode = SQLSTATE;
      end;
    end loop;

    exit when total_deleted = 0;
  end loop;

  if total_deleted > 0 then
    raise exception
      'Tenant module purge exceeded maximum pass count (% passes) with % rows deleted on final pass.',
      ${MAX_MODULE_PURGE_PASSES},
      total_deleted;
  end if;

  foreach purge_table_name in array tables loop
    if purge_retention = 'module-foundation-only'
      and purge_table_name = any(append_only_tables) then
      continue;
    end if;

    if purge_table_name in (${modulePurgeInfrastructureTableSqlList()})
      or purge_table_name in (${foundationStageDependencyTableSqlList()}) then
      continue;
    end if;

    execute format(
      'select count(*)::bigint from public.%I where organisation_id = $1',
      purge_table_name
    )
    into remaining_count
    using target_org_id;

    if remaining_count > 0 then
      remaining_tables := array_append(
        remaining_tables,
        format('public.%s=%s', purge_table_name, remaining_count)
      );
    end if;
  end loop;

  if purge_retention = 'full-tenant-removal' then
    delete from public.template_answers
    where organisation_id = target_org_id;

    delete from public.template_submissions
    where organisation_id = target_org_id;

    delete from public.template_questions
    where organisation_id = target_org_id;

    delete from public.template_sections
    where organisation_id = target_org_id;

    delete from public.template_versions
    where organisation_id = target_org_id;

    delete from public.templates
    where organisation_id = target_org_id;
  end if;

  if purge_retention = 'full-tenant-removal' then
    foreach append_only_table in array module_stage_append_only_tables loop
      execute format(
        'select count(*)::bigint from public.%I where organisation_id = $1',
        append_only_table
      )
      into remaining_count
      using target_org_id;

      if remaining_count > 0 then
        raise exception
          'Tenant module purge left module-stage append-only rows after controlled retirement delete: public.%=%',
          append_only_table,
          remaining_count;
      end if;
    end loop;
  end if;

  select count(*)::bigint
  into indirect_remaining
  from public.organisation_invitation_signup_bindings binding
  where binding.invitation_id in (
    select invitation.id
    from public.organisation_invitations invitation
    where invitation.organisation_id = target_org_id
  );

  if indirect_remaining > 0 then
    remaining_tables := array_append(
      remaining_tables,
      format('public.organisation_invitation_signup_bindings=%s', indirect_remaining)
    );
  end if;

  if coalesce(array_length(remaining_tables, 1), 0) > 0 then
    raise exception
      'Tenant module purge left tenant-owned module rows: %',
      array_to_string(remaining_tables, ', ');
  end if;

  raise notice 'Tenant module purge complete for % (%).', target_org_code, target_org_id;
end
$$;
`;
}

export function buildLegacyHostedDemoModulePurgeSql() {
  return buildPurgeTenantModuleDataSql("lean-excellence-demo", {
    retention: "full-tenant-removal",
  });
}
