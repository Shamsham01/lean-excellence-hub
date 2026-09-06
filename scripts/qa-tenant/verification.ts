import type { SupabaseClient } from "@supabase/supabase-js";

import {
  QA_ORGANISATION,
  QA_ORGANISATION_CODE,
  QA_UNITS,
  QA_USER_IDS,
  QA_USERS,
} from "./constants";
import {
  buildOrganisationScopeCte,
  foundationTableSqlList,
  INDIRECT_TENANT_CHECKS,
  listAppendOnlyDeleteTablesSql,
  PURGE_INFRASTRUCTURE_TABLES,
} from "./deletion-graph";
import { runSupabaseDbQueryJson, SupabaseDbQueryError } from "./db-cli";
import { CUSTOM_APPEND_ONLY_DELETE_TABLES } from "./tenant-retirement-policy";

export type TenantVerificationRow = {
  resource: string;
  count: number;
};

export type CookieWorksVerificationResult = {
  organisation: { id: string; code: string; name: string } | null;
  foundationCounts: TenantVerificationRow[];
  moduleTableCounts: TenantVerificationRow[];
  indirectCounts: TenantVerificationRow[];
  failures: string[];
  isFoundationOnly: boolean;
};

function listModuleTablesSql() {
  return `
select coalesce(array_to_json(array_agg(c.table_name order by c.table_name)), '[]'::json) as tables
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema
 and t.table_name = c.table_name
where c.table_schema = 'public'
  and c.column_name = 'organisation_id'
  and t.table_type = 'BASE TABLE'
  and c.table_name not in (${foundationTableSqlList()});
`;
}

function listFoundationTablesSql() {
  return `
select coalesce(array_to_json(array_agg(table_name order by table_name)), '[]'::json) as tables
from unnest(array[${foundationTableSqlList()}]) as table_name
where table_name <> 'organisations';
`;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function buildCountUnion(tables: string[], category: "module" | "foundation") {
  if (tables.length === 0) {
    return `select null::text as resource, 0::bigint as count, '${category}'::text as category where false`;
  }

  return tables
    .map((tableName) => {
      const resource = `public.${tableName}`;
      return `
        select '${resource}' as resource,
               (select count(*)::bigint
                from public.${quoteIdentifier(tableName)}
                where organisation_id = (select id from target_org)) as count,
               '${category}'::text as category
      `;
    })
    .join("\nunion all\n");
}

function buildIndirectUnion() {
  return INDIRECT_TENANT_CHECKS.map(
    (check) => `
      select '${check.resource}' as resource,
             (${check.countSql}) as count,
             'indirect'::text as category
    `,
  ).join("\nunion all\n");
}

function buildVerificationSql(
  moduleTables: string[],
  foundationTables: string[],
) {
  return `
with ${buildOrganisationScopeCte()},
counts as (
  ${buildCountUnion(moduleTables, "module")}
  union all
  ${buildCountUnion(foundationTables, "foundation")}
  union all
  ${buildIndirectUnion()}
)
select jsonb_build_object(
  'organisation', (select jsonb_build_object('id', id, 'code', code, 'name', name) from target_org),
  'rows', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'resource', counts.resource,
      'count', counts.count,
      'category', counts.category
    ) order by counts.category, counts.resource)
    from counts),
    '[]'::jsonb
  )
) as verification;
`;
}

function discoverTableLists(databaseUrl: string) {
  const moduleRows = runSupabaseDbQueryJson<{ tables: string[] }>({
    databaseUrl,
    outputFormat: "json",
    heavy: true,
    sql: listModuleTablesSql(),
  });

  const foundationRows = runSupabaseDbQueryJson<{ tables: string[] }>({
    databaseUrl,
    outputFormat: "json",
    heavy: true,
    sql: listFoundationTablesSql(),
  });

  const appendOnlyRows = runSupabaseDbQueryJson<{
    tables: Array<{ table: string; trigger: string }>;
  }>({
    databaseUrl,
    outputFormat: "json",
    heavy: true,
    sql: listAppendOnlyDeleteTablesSql(),
  });

  const moduleTables = (moduleRows[0]?.tables ?? []) as string[];
  const foundationTables = (foundationRows[0]?.tables ?? []) as string[];
  const appendOnlyTables = new Set<string>([
    ...((appendOnlyRows[0]?.tables ?? []) as Array<{ table: string }>).map(
      (entry) => entry.table,
    ),
    ...CUSTOM_APPEND_ONLY_DELETE_TABLES.map((policy) => policy.table),
  ]);

  return { moduleTables, foundationTables, appendOnlyTables };
}

function parseVerificationPayload(
  payload: {
    organisation: CookieWorksVerificationResult["organisation"];
    rows: Array<{
      resource: string;
      count: number | string;
      category: "module" | "foundation" | "indirect";
    }>;
  },
  appendOnlyTables: Set<string>,
): CookieWorksVerificationResult {
  const foundationCounts: TenantVerificationRow[] = [];
  const moduleTableCounts: TenantVerificationRow[] = [];
  const indirectCounts: TenantVerificationRow[] = [];
  const failures: string[] = [];

  for (const row of payload.rows ?? []) {
    const count = Number(row.count ?? 0);
    const entry = { resource: row.resource, count };

    if (row.category === "foundation") {
      foundationCounts.push(entry);
      continue;
    }

    if (row.category === "indirect") {
      indirectCounts.push(entry);
      if (count > 0) {
        failures.push(`${row.resource}=${count}`);
      }
      continue;
    }

    moduleTableCounts.push(entry);
    const tableName = row.resource.replace(/^public\./, "");
    if (
      appendOnlyTables.has(tableName) ||
      PURGE_INFRASTRUCTURE_TABLES.includes(
        tableName as (typeof PURGE_INFRASTRUCTURE_TABLES)[number],
      )
    ) {
      continue;
    }
    if (count > 0) {
      failures.push(`${row.resource}=${count}`);
    }
  }

  return {
    organisation: payload.organisation,
    foundationCounts,
    moduleTableCounts,
    indirectCounts,
    failures,
    isFoundationOnly: failures.length === 0,
  };
}

export function verifyCookieWorksTenant(databaseUrl: string) {
  const { moduleTables, foundationTables, appendOnlyTables } =
    discoverTableLists(databaseUrl);

  if (moduleTables.length === 0) {
    throw new Error(
      "CookieWorks verification failed: no module tables discovered from information_schema.",
    );
  }

  const rows = runSupabaseDbQueryJson<{
    verification: {
      organisation: CookieWorksVerificationResult["organisation"];
      rows: Array<{
        resource: string;
        count: number | string;
        category: "module" | "foundation" | "indirect";
      }>;
    };
  }>(
    {
      databaseUrl,
      outputFormat: "json",
      heavy: true,
      sql: buildVerificationSql(moduleTables, foundationTables),
    },
    { minRows: 1, maxRows: 1 },
  );

  const verification = rows[0]?.verification;
  if (!verification) {
    throw new Error("CookieWorks verification query returned no payload.");
  }

  return parseVerificationPayload(verification, appendOnlyTables);
}

export function assertCookieWorksOrganisationContract(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<{
    id: string;
    code: string;
    name: string;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select id, code, name
      from public.organisations
      where code = '${QA_ORGANISATION_CODE}';
    `,
  });
  if (rows.length !== 1) {
    throw new Error(
      `CookieWorks organisation contract failed: expected exactly one organisation with code ${QA_ORGANISATION_CODE}, found ${rows.length}.`,
    );
  }

  const organisation = rows[0]!;
  if (organisation.name !== QA_ORGANISATION.name) {
    throw new Error(
      `CookieWorks organisation contract failed: expected name ${QA_ORGANISATION.name}, found ${organisation.name}.`,
    );
  }

  return organisation;
}

export function assertCookieWorksFoundationOnlyVerified(
  databaseUrl: string,
): CookieWorksVerificationResult {
  assertCookieWorksOrganisationContract(databaseUrl);
  const result = verifyCookieWorksTenant(databaseUrl);

  if (!result.organisation) {
    throw new Error(
      `CookieWorks foundation verification failed: organisation ${QA_ORGANISATION_CODE} not found.`,
    );
  }

  if (!result.isFoundationOnly) {
    throw new SupabaseDbQueryError(
      `CookieWorks foundation verification failed. Remaining tenant-owned module data: ${result.failures.join(", ")}`,
      JSON.stringify(result, null, 2),
      "",
    );
  }

  return result;
}

export function formatVerificationSummary(
  result: CookieWorksVerificationResult,
) {
  const lines: string[] = [];

  if (!result.organisation) {
    lines.push(`Organisation: not provisioned (${QA_ORGANISATION_CODE})`);
    return lines.join("\n");
  }

  lines.push("Verification summary");
  lines.push(`Organisation: ${result.organisation.name}`);
  lines.push(`Code: ${result.organisation.code}`);
  lines.push(`UUID: ${result.organisation.id}`);
  lines.push("");

  const moduleTotal = result.moduleTableCounts.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const indirectTotal = result.indirectCounts.reduce(
    (sum, row) => sum + row.count,
    0,
  );

  lines.push("Foundation counts");
  for (const row of result.foundationCounts) {
    lines.push(`  - ${row.resource}: ${row.count}`);
  }
  lines.push("");

  lines.push("Module table counts (non-zero only)");
  const nonZeroModule = result.moduleTableCounts.filter((row) => row.count > 0);
  if (nonZeroModule.length === 0) {
    lines.push("  - none");
  } else {
    for (const row of nonZeroModule) {
      lines.push(`  - ${row.resource}: ${row.count}`);
    }
  }
  lines.push("");

  lines.push("Indirect tenant-owned counts");
  for (const row of result.indirectCounts) {
    lines.push(`  - ${row.resource}: ${row.count}`);
  }
  lines.push("");

  lines.push(`Module row total: ${moduleTotal}`);
  lines.push(`Indirect row total: ${indirectTotal}`);
  lines.push("");

  if (result.isFoundationOnly) {
    lines.push("FOUNDATION-ONLY VERIFIED");
  } else {
    lines.push("FOUNDATION-ONLY VERIFICATION FAILED");
    lines.push(`Failures: ${result.failures.join(", ")}`);
  }

  return lines.join("\n");
}

export function countOrganisationModuleRows(
  databaseUrl: string,
  organisationCode: string,
  tableName: string,
) {
  const rows = runSupabaseDbQueryJson<{ count: number }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select count(*)::int as count
      from public.${quoteIdentifier(tableName)}
      where organisation_id = (
        select id from public.organisations where code = '${organisationCode}' limit 1
      );
    `,
  });

  return rows[0]?.count ?? 0;
}

export const HOSTED_REPLACEMENT_VERIFIED_MARKER =
  "HOSTED DEMO → COOKIEWORKS REPLACEMENT VERIFIED";

export const HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER =
  "HOSTED LEGACY DEMO REMOVED — EXISTING COOKIEWORKS PRESERVED AND VERIFIED";

export async function assertCookieWorksCompleteFoundationVerified(
  databaseUrl: string,
  authAdmin?: SupabaseClient,
) {
  const organisation = assertCookieWorksOrganisationContract(databaseUrl);
  const verification = assertCookieWorksFoundationOnlyVerified(databaseUrl);

  const counts = runSupabaseDbQueryJson<{
    memberships: number;
    units: number;
    role_grants: number;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        (select count(*)::int from public.organisation_memberships where organisation_id = '${organisation.id}'::uuid) as memberships,
        (select count(*)::int from public.organisation_units where organisation_id = '${organisation.id}'::uuid) as units,
        (select count(*)::int from public.access_grants where organisation_id = '${organisation.id}'::uuid and status = 'active') as role_grants;
    `,
  });

  const membershipCount = counts[0]?.memberships ?? 0;
  const unitCount = counts[0]?.units ?? 0;
  const roleGrantCount = counts[0]?.role_grants ?? 0;
  const expectedPersonas = Object.keys(QA_USERS).length;

  if (membershipCount !== expectedPersonas) {
    throw new Error(
      `CookieWorks foundation verification failed: expected ${expectedPersonas} memberships, found ${membershipCount}.`,
    );
  }

  if (unitCount !== QA_UNITS.length) {
    throw new Error(
      `CookieWorks foundation verification failed: expected ${QA_UNITS.length} organisational units, found ${unitCount}.`,
    );
  }

  if (roleGrantCount !== expectedPersonas) {
    throw new Error(
      `CookieWorks foundation verification failed: expected ${expectedPersonas} active role grants, found ${roleGrantCount}.`,
    );
  }

  if (authAdmin) {
    const missingAuthUsers: string[] = [];
    for (const userId of QA_USER_IDS) {
      const existing = await authAdmin.auth.admin.getUserById(userId);
      if (!existing.data.user) {
        missingAuthUsers.push(userId);
      }
    }

    if (missingAuthUsers.length > 0) {
      throw new Error(
        `CookieWorks foundation verification failed: missing auth identities ${missingAuthUsers.join(", ")}.`,
      );
    }
  }

  return {
    organisation,
    verification,
    membershipCount,
    unitCount,
    roleGrantCount,
  };
}
