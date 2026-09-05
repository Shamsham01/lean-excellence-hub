import { LEGACY_HOSTED_DEMO_ORGANISATION } from "./legacy-hosted-demo";
import { runSupabaseDbQueryJson } from "./db-cli";
import {
  collectTenantInventory,
  countTenantModuleRows,
  formatTenantInventoryReport,
} from "./tenant-inventory";
import { countTenantStorageObjects } from "./tenant-storage-cleanup";
import type { LegacyHostedDemoOrganisation } from "./delete-legacy-hosted-demo";

export type LegacyMemberIdentity = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  membership_count: number;
  legacy_only: boolean;
  conflicting_organisations: Array<{
    organisation_id: string;
    organisation_code: string;
    organisation_name: string;
  }>;
};

export type LegacyFoundationCounts = {
  organisational_units: number;
  roles: number;
  role_versions: number;
  role_grants: number;
  memberships: number;
  invitations: number;
};

export type LegacyPrivateInfrastructureCounts = {
  notification_delivery_provider_envelopes: number;
  notification_delivery_ledger: number;
  domain_event_outbox: number;
  session_organisation_contexts: number;
};

export type LegacyReplacementPlanDetails = {
  legacyOrganisation: LegacyHostedDemoOrganisation | null;
  membershipCount: number;
  members: LegacyMemberIdentity[];
  foundation: LegacyFoundationCounts | null;
  privateInfrastructure: LegacyPrivateInfrastructureCounts | null;
  storageObjectCount: number;
  moduleRowTotal: number;
  inventoryReport: string;
};

function collectLegacyMemberIdentities(
  databaseUrl: string,
  organisationId: string,
): LegacyMemberIdentity[] {
  const rows = runSupabaseDbQueryJson<{
    user_id: string;
    email: string | null;
    display_name: string | null;
    membership_count: number;
    conflicting_organisations: Array<{
      organisation_id: string;
      organisation_code: string;
      organisation_name: string;
    }> | null;
  }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      with legacy_members as (
        select distinct membership.user_id
        from public.organisation_memberships membership
        where membership.organisation_id = '${organisationId}'::uuid
      ),
      membership_totals as (
        select membership.user_id, count(*)::int as membership_count
        from public.organisation_memberships membership
        join legacy_members on legacy_members.user_id = membership.user_id
        group by membership.user_id
      ),
      conflicts as (
        select
          membership.user_id,
          jsonb_agg(
            jsonb_build_object(
              'organisation_id', other_org.id,
              'organisation_code', other_org.code,
              'organisation_name', other_org.name
            )
            order by other_org.code
          ) as conflicting_organisations
        from public.organisation_memberships membership
        join public.organisations other_org
          on other_org.id = membership.organisation_id
        join legacy_members on legacy_members.user_id = membership.user_id
        where membership.organisation_id <> '${organisationId}'::uuid
        group by membership.user_id
      )
      select
        legacy_members.user_id,
        auth_user.email,
        auth_user.raw_user_meta_data ->> 'full_name' as display_name,
        membership_totals.membership_count,
        coalesce(conflicts.conflicting_organisations, '[]'::jsonb) as conflicting_organisations
      from legacy_members
      join membership_totals on membership_totals.user_id = legacy_members.user_id
      left join auth.users auth_user on auth_user.id = legacy_members.user_id
      left join conflicts on conflicts.user_id = legacy_members.user_id
      order by legacy_members.user_id;
    `,
  });

  return rows.map((row) => {
    const conflicts = Array.isArray(row.conflicting_organisations)
      ? row.conflicting_organisations
      : [];

    return {
      user_id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      membership_count: Number(row.membership_count ?? 0),
      legacy_only: conflicts.length === 0,
      conflicting_organisations: conflicts,
    };
  });
}

function collectLegacyFoundationCounts(
  databaseUrl: string,
  organisationId: string,
): LegacyFoundationCounts {
  const rows = runSupabaseDbQueryJson<LegacyFoundationCounts>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        (select count(*)::int from public.organisation_units where organisation_id = '${organisationId}'::uuid) as organisational_units,
        (select count(*)::int from public.roles where organisation_id = '${organisationId}'::uuid) as roles,
        (select count(*)::int from public.role_versions where organisation_id = '${organisationId}'::uuid) as role_versions,
        (select count(*)::int from public.access_grants where organisation_id = '${organisationId}'::uuid) as role_grants,
        (select count(*)::int from public.organisation_memberships where organisation_id = '${organisationId}'::uuid) as memberships,
        (select count(*)::int from public.organisation_invitations where organisation_id = '${organisationId}'::uuid) as invitations;
    `,
  });

  return (
    rows[0] ?? {
      organisational_units: 0,
      roles: 0,
      role_versions: 0,
      role_grants: 0,
      memberships: 0,
      invitations: 0,
    }
  );
}

function collectLegacyPrivateInfrastructureCounts(
  databaseUrl: string,
  organisationId: string,
): LegacyPrivateInfrastructureCounts {
  const rows = runSupabaseDbQueryJson<LegacyPrivateInfrastructureCounts>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select
        (select count(*)::int from private.notification_delivery_provider_envelopes where organisation_id = '${organisationId}'::uuid) as notification_delivery_provider_envelopes,
        (select count(*)::int from private.notification_delivery_ledger where organisation_id = '${organisationId}'::uuid) as notification_delivery_ledger,
        (select count(*)::int from private.domain_event_outbox where organisation_id = '${organisationId}'::uuid) as domain_event_outbox,
        (select count(*)::int from private.session_organisation_contexts where organisation_id = '${organisationId}'::uuid) as session_organisation_contexts;
    `,
  });

  return (
    rows[0] ?? {
      notification_delivery_provider_envelopes: 0,
      notification_delivery_ledger: 0,
      domain_event_outbox: 0,
      session_organisation_contexts: 0,
    }
  );
}

export function collectLegacyReplacementPlanDetails(
  databaseUrl: string,
  legacyOrganisation: LegacyHostedDemoOrganisation | null,
): LegacyReplacementPlanDetails {
  if (!legacyOrganisation) {
    return {
      legacyOrganisation: null,
      membershipCount: 0,
      members: [],
      foundation: null,
      privateInfrastructure: null,
      storageObjectCount: 0,
      moduleRowTotal: 0,
      inventoryReport: formatTenantInventoryReport(
        collectTenantInventory(
          databaseUrl,
          LEGACY_HOSTED_DEMO_ORGANISATION.code,
        ),
        "Legacy hosted demo inventory",
      ),
    };
  }

  const inventory = collectTenantInventory(
    databaseUrl,
    LEGACY_HOSTED_DEMO_ORGANISATION.code,
  );
  const members = collectLegacyMemberIdentities(
    databaseUrl,
    legacyOrganisation.id,
  );

  return {
    legacyOrganisation,
    membershipCount: members.length,
    members,
    foundation: collectLegacyFoundationCounts(
      databaseUrl,
      legacyOrganisation.id,
    ),
    privateInfrastructure: collectLegacyPrivateInfrastructureCounts(
      databaseUrl,
      legacyOrganisation.id,
    ),
    storageObjectCount: countTenantStorageObjects(
      databaseUrl,
      LEGACY_HOSTED_DEMO_ORGANISATION.code,
    ),
    moduleRowTotal: countTenantModuleRows(inventory),
    inventoryReport: formatTenantInventoryReport(
      inventory,
      "Legacy hosted demo inventory",
    ),
  };
}

export function formatLegacyReplacementPlanDetails(
  details: LegacyReplacementPlanDetails,
  options: {
    cookieWorksPresent: boolean;
    legacyAuthUserIds: string[];
    legacyDeletableAuthUserIds: string[];
  },
) {
  const lines: string[] = [];

  lines.push("Legacy organisation");
  if (!details.legacyOrganisation) {
    lines.push("  - status: not found");
  } else {
    lines.push(`  - uuid: ${details.legacyOrganisation.id}`);
    lines.push(`  - code: ${details.legacyOrganisation.code}`);
    lines.push(`  - name: ${details.legacyOrganisation.name}`);
    lines.push(`  - membership count: ${details.membershipCount}`);
  }
  lines.push("");

  lines.push("Members / auth identities");
  if (details.members.length === 0) {
    lines.push("  - none");
  } else {
    for (const member of details.members) {
      lines.push(`  - user ID: ${member.user_id}`);
      lines.push(`    email: ${member.email ?? "n/a"}`);
      lines.push(`    display name: ${member.display_name ?? "n/a"}`);
      lines.push(`    organisation memberships: ${member.membership_count}`);
      lines.push(`    legacy-only: ${member.legacy_only ? "yes" : "no"}`);
      if (member.conflicting_organisations.length > 0) {
        for (const conflict of member.conflicting_organisations) {
          lines.push(
            `    conflicting organisation: ${conflict.organisation_name} (${conflict.organisation_code}, ${conflict.organisation_id})`,
          );
        }
      }
    }
  }
  lines.push("");
  lines.push(
    `Captured legacy auth user IDs: ${options.legacyAuthUserIds.join(", ") || "none"}`,
  );
  lines.push(
    `Captured deletable auth user IDs: ${options.legacyDeletableAuthUserIds.join(", ") || "none"}`,
  );
  lines.push("");

  lines.push("Tenant foundation");
  if (!details.foundation) {
    lines.push("  - n/a");
  } else {
    lines.push(
      `  - organisational units: ${details.foundation.organisational_units}`,
    );
    lines.push(`  - roles: ${details.foundation.roles}`);
    lines.push(`  - role versions: ${details.foundation.role_versions}`);
    lines.push(`  - role grants: ${details.foundation.role_grants}`);
    lines.push(`  - memberships: ${details.foundation.memberships}`);
    lines.push(`  - invitations: ${details.foundation.invitations}`);
  }
  lines.push("");

  lines.push("Private infrastructure");
  if (!details.privateInfrastructure) {
    lines.push("  - n/a");
  } else {
    lines.push(
      `  - private.notification_delivery_provider_envelopes: ${details.privateInfrastructure.notification_delivery_provider_envelopes}`,
    );
    lines.push(
      `  - private.notification_delivery_ledger: ${details.privateInfrastructure.notification_delivery_ledger}`,
    );
    lines.push(
      `  - private.domain_event_outbox: ${details.privateInfrastructure.domain_event_outbox}`,
    );
    lines.push(
      `  - private.session_organisation_contexts: ${details.privateInfrastructure.session_organisation_contexts}`,
    );
  }
  lines.push("");

  lines.push("Storage");
  lines.push(
    `  - organisation-evidence object count: ${details.storageObjectCount}`,
  );
  lines.push("");

  lines.push("Modules");
  lines.push(
    `  - total tenant-owned module row count: ${details.moduleRowTotal}`,
  );
  lines.push("");
  lines.push(details.inventoryReport);
  lines.push("");
  lines.push(
    `CookieWorks organisation currently present: ${options.cookieWorksPresent ? "yes" : "no"}`,
  );

  return lines.join("\n");
}
