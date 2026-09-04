import type { SupabaseClient } from "@supabase/supabase-js";

import { QA_ORGANISATION_CODE } from "./constants";
import {
  foundationTableSqlList,
  MAX_MODULE_PURGE_PASSES,
} from "./deletion-graph";
import { runSupabaseDbQuery } from "./db-cli";
import { purgeCookieWorksStorageObjects } from "./storage-cleanup";
import {
  assertCookieWorksFoundationOnlyVerified,
  verifyCookieWorksTenant,
} from "./verification";

function buildPurgeModuleDataSql() {
  return `
do $$
declare
  target_org_id uuid;
  target_org_code text := '${QA_ORGANISATION_CODE}';
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
    raise notice 'No CookieWorks organisation found for code %', target_org_code;
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
    raise exception 'CookieWorks purge failed: no module tables discovered from information_schema.';
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
            or SQLERRM like '%completed Gemba walk is immutable%' then
            null;
          else
            raise exception 'CookieWorks purge failed on public.%: %', table_name, SQLERRM
              using errcode = SQLSTATE;
          end if;
        when others then
          raise exception 'CookieWorks purge failed on public.%: %', table_name, SQLERRM
            using errcode = SQLSTATE;
      end;
    end loop;

    exit when total_deleted = 0;
  end loop;

  if total_deleted > 0 then
    raise exception
      'CookieWorks purge exceeded maximum pass count (% passes) with % rows deleted on final pass.',
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
      'CookieWorks purge left tenant-owned module rows: %',
      array_to_string(remaining_tables, ', ');
  end if;

  raise notice 'CookieWorks module purge complete for % (%).', target_org_code, target_org_id;
end
$$;
`;
}

export function executePurgeCookieWorksModuleDataSql(databaseUrl: string) {
  runSupabaseDbQuery({
    databaseUrl,
    sql: buildPurgeModuleDataSql(),
  });
}

export async function purgeCookieWorksTenantModules(
  databaseUrl: string,
  options?: { storageAdmin?: SupabaseClient },
) {
  executePurgeCookieWorksModuleDataSql(databaseUrl);
  await purgeCookieWorksStorageObjects({
    databaseUrl,
    ...(options?.storageAdmin ? { storageAdmin: options.storageAdmin } : {}),
  });

  const verification = verifyCookieWorksTenant(databaseUrl);
  if (!verification.isFoundationOnly) {
    throw new Error(
      `CookieWorks purge verification failed before reseed: ${verification.failures.join(", ")}`,
    );
  }
}

export async function deleteCookieWorksTenant(options: {
  databaseUrl: string;
  deleteAuthUsers?: () => Promise<void>;
}) {
  await purgeCookieWorksTenantModules(options.databaseUrl);

  if (options.deleteAuthUsers) {
    await options.deleteAuthUsers();
  }
}

export function assertCookieWorksResetVerified(databaseUrl: string) {
  return assertCookieWorksFoundationOnlyVerified(databaseUrl);
}
