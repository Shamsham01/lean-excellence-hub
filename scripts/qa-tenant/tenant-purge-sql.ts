import {
  foundationTableSqlList,
  MAX_MODULE_PURGE_PASSES,
} from "./deletion-graph";

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

export function buildPurgeTenantModuleDataSql(organisationCode: string) {
  const targetOrgCode = escapeSqlLiteral(organisationCode);

  return `
do $$
declare
  target_org_id uuid;
  target_org_code text := '${targetOrgCode}';
  table_name text;
  pass_count int := 0;
  deleted_rows int;
  total_deleted int := 0;
  tables text[];
  remaining_count bigint;
  remaining_tables text[] := array[]::text[];
  indirect_remaining bigint;
  append_only_tables text[];
begin
  select id into target_org_id
  from public.organisations
  where code = target_org_code;

  if target_org_id is null then
    raise notice 'No organisation found for code %', target_org_code;
    return;
  end if;

  delete from private.notification_delivery_provider_envelopes
  where organisation_id = target_org_id;

  delete from private.notification_delivery_ledger
  where organisation_id = target_org_id;

  delete from private.domain_event_outbox
  where organisation_id = target_org_id;

  delete from private.session_organisation_contexts
  where organisation_id = target_org_id;

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
    array_agg(distinct event_object_table order by event_object_table),
    array[]::text[]
  )
  into append_only_tables
  from information_schema.triggers
  where trigger_schema = 'public'
    and event_manipulation = 'DELETE'
    and action_statement ilike '%prevent_update_or_delete%';

  for pass_count in 1..${MAX_MODULE_PURGE_PASSES} loop
    total_deleted := 0;

    foreach table_name in array tables loop
      begin
        execute format(
          'delete from public.%I where organisation_id = $1',
          table_name
        )
        using target_org_id;

        get diagnostics deleted_rows = row_count;
        total_deleted := total_deleted + deleted_rows;
      exception
        when foreign_key_violation then
          null;
        when sqlstate '55000' then
          if SQLERRM like '%is append-only%'
            or SQLERRM like '%published template version is immutable%'
            or SQLERRM like '%completed submission is immutable%'
            or SQLERRM like '%completed 5S audit is immutable%'
            or SQLERRM like '%completed project is immutable%'
            or SQLERRM like '%completed Gemba walk is immutable%'
            or SQLERRM like '%maturity assessment context is immutable%' then
            null;
          else
            raise exception 'Tenant module purge failed on public.%: %', table_name, SQLERRM
              using errcode = SQLSTATE;
          end if;
        when others then
          raise exception 'Tenant module purge failed on public.%: %', table_name, SQLERRM
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

  foreach table_name in array tables loop
    if table_name = any(append_only_tables) then
      continue;
    end if;

    if table_name in ('resource_records', 'templates', 'template_versions', 'template_sections', 'template_questions') then
      continue;
    end if;

    execute format(
      'select count(*)::bigint from public.%I where organisation_id = $1',
      table_name
    )
    into remaining_count
    using target_org_id;

    if remaining_count > 0 then
      remaining_tables := array_append(
        remaining_tables,
        format('public.%s=%s', table_name, remaining_count)
      );
    end if;
  end loop;

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
