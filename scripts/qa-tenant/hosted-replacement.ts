#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION, QA_ORGANISATION_CODE } from "./constants";
import {
  assertLegacyHostedDemoAbsent,
  assertLegacyHostedDemoContract,
  deleteLegacyHostedDemoTenant,
  listLegacyHostedDemoAuthUserIds,
  listLegacyHostedDemoDeletableAuthUserIds,
  resolveLegacyHostedDemoOrganisation,
} from "./delete-legacy-hosted-demo";
import {
  assertHostedReplacementAllowed,
  extractSupabaseProjectRef,
  parseHostedResetArgs,
  resolveHostedCredentials,
} from "./guards";
import { runHostedCookieWorksSeed } from "./hosted-seed";
import {
  LEGACY_HOSTED_DEMO_ORGANISATION,
  QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN,
} from "./legacy-hosted-demo";
import {
  collectTenantInventory,
  countTenantModuleRows,
  formatTenantInventoryReport,
} from "./tenant-inventory";
import { countTenantStorageObjects } from "./tenant-storage-cleanup";
import {
  assertCookieWorksFoundationOnlyVerified,
  formatVerificationSummary,
} from "./verification";

export type HostedReplacementMode = "dry-run" | "destructive";

export type HostedReplacementPlan = {
  mode: HostedReplacementMode;
  projectRef: string;
  legacyOrganisation: ReturnType<typeof resolveLegacyHostedDemoOrganisation>;
  legacyInventory: ReturnType<typeof collectTenantInventory>;
  legacyStorageObjectCount: number;
  legacyAuthUserIds: string[];
  legacyDeletableAuthUserIds: string[];
  cookieWorksPresent: boolean;
};

export function buildHostedReplacementPlan(options: {
  databaseUrl: string;
  mode: HostedReplacementMode;
  projectRef: string;
}): HostedReplacementPlan {
  const legacyOrganisation = resolveLegacyHostedDemoOrganisation(
    options.databaseUrl,
  );
  const legacyInventory = collectTenantInventory(
    options.databaseUrl,
    LEGACY_HOSTED_DEMO_ORGANISATION.code,
  );
  const cookieWorksInventory = collectTenantInventory(
    options.databaseUrl,
    QA_ORGANISATION_CODE,
  );

  return {
    mode: options.mode,
    projectRef: options.projectRef,
    legacyOrganisation,
    legacyInventory,
    legacyStorageObjectCount: countTenantStorageObjects(
      options.databaseUrl,
      LEGACY_HOSTED_DEMO_ORGANISATION.code,
    ),
    legacyAuthUserIds: legacyOrganisation
      ? listLegacyHostedDemoAuthUserIds(options.databaseUrl)
      : [],
    legacyDeletableAuthUserIds: legacyOrganisation
      ? listLegacyHostedDemoDeletableAuthUserIds(options.databaseUrl)
      : [],
    cookieWorksPresent: cookieWorksInventory.organisation !== null,
  };
}

export function formatHostedReplacementPlan(plan: HostedReplacementPlan) {
  const lines: string[] = [];

  lines.push("Hosted pre-launch tenant replacement plan (QA2)");
  lines.push(`Mode: ${plan.mode}`);
  lines.push(`Target project ref: ${plan.projectRef}`);
  lines.push(
    `Expected legacy organisation: ${LEGACY_HOSTED_DEMO_ORGANISATION.name} (${LEGACY_HOSTED_DEMO_ORGANISATION.code})`,
  );
  lines.push(`Expected legacy UUID: ${LEGACY_HOSTED_DEMO_ORGANISATION.id}`);
  lines.push(
    `Target replacement organisation: ${QA_ORGANISATION.name} (${QA_ORGANISATION_CODE})`,
  );
  lines.push("");

  if (!plan.legacyOrganisation) {
    lines.push("Legacy organisation: not found");
  } else {
    lines.push("Legacy organisation resolved");
    lines.push(`  - name: ${plan.legacyOrganisation.name}`);
    lines.push(`  - code: ${plan.legacyOrganisation.code}`);
    lines.push(`  - uuid: ${plan.legacyOrganisation.id}`);
    lines.push(
      `  - storage objects (organisation-evidence): ${plan.legacyStorageObjectCount}`,
    );
    lines.push(
      `  - auth identities (memberships): ${plan.legacyAuthUserIds.length}`,
    );
    lines.push(
      `  - auth identities safe to delete: ${plan.legacyDeletableAuthUserIds.length}`,
    );
    lines.push(
      `  - module/business row total: ${countTenantModuleRows(plan.legacyInventory)}`,
    );
    lines.push("");
    lines.push(
      formatTenantInventoryReport(
        plan.legacyInventory,
        "Legacy hosted demo inventory",
      ),
    );
  }

  lines.push("");
  lines.push(
    `CookieWorks organisation currently present: ${plan.cookieWorksPresent ? "yes" : "no"}`,
  );
  lines.push("");
  lines.push("Destructive execution order:");
  lines.push("  1. Validate legacy organisation contract (id, code, name)");
  lines.push("  2. Purge legacy tenant module/business data");
  lines.push("  3. Delete legacy tenant storage objects");
  lines.push("  4. Delete legacy foundation records and organisation row");
  lines.push("  5. Delete legacy-only auth identities");
  lines.push("  6. Seed CookieWorks foundation");
  lines.push("  7. Verify legacy absent and CookieWorks foundation-only");

  if (plan.mode === "dry-run") {
    lines.push("");
    lines.push("Dry-run only. No hosted data was modified.");
    lines.push(
      `To execute destructively, set LEANHUB_QA_RESET_CONFIRM=${QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN} and rerun with --destructive.`,
    );
  }

  return lines.join("\n");
}

export async function runHostedTenantReplacement(options?: {
  argv?: string[];
  credentials?: ReturnType<typeof resolveHostedCredentials>;
  deleteLegacyTenant?: typeof deleteLegacyHostedDemoTenant;
  seedCookieWorks?: typeof runHostedCookieWorksSeed;
}) {
  const argv = options?.argv ?? process.argv.slice(2);
  const { mode } = parseHostedResetArgs(argv);
  const credentials = options?.credentials ?? resolveHostedCredentials();
  const deleteLegacyTenant =
    options?.deleteLegacyTenant ?? deleteLegacyHostedDemoTenant;
  const seedCookieWorks = options?.seedCookieWorks ?? runHostedCookieWorksSeed;

  assertHostedReplacementAllowed({
    apiUrl: credentials.apiUrl,
    expectedProjectRef: credentials.expectedProjectRef,
    mode,
  });

  const projectRef =
    extractSupabaseProjectRef(credentials.apiUrl) ??
    credentials.expectedProjectRef;

  const plan = buildHostedReplacementPlan({
    databaseUrl: credentials.databaseUrl,
    mode,
    projectRef,
  });

  console.log(formatHostedReplacementPlan(plan));

  if (mode === "dry-run") {
    if (plan.legacyOrganisation) {
      try {
        assertLegacyHostedDemoContract(credentials.databaseUrl);
        console.log("");
        console.log("Legacy organisation contract: VERIFIED");
      } catch (error) {
        console.log("");
        console.log(
          `Legacy organisation contract: FAILED (${error instanceof Error ? error.message : error})`,
        );
      }
    }

    return { plan, verification: null };
  }

  const admin = createClient(credentials.apiUrl, credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (plan.cookieWorksPresent) {
    throw new Error(
      `Hosted tenant replacement refused: CookieWorks organisation ${QA_ORGANISATION_CODE} already exists. Investigate manually before rerunning.`,
    );
  }

  await deleteLegacyTenant({
    databaseUrl: credentials.databaseUrl,
    storageAdmin: admin,
    authAdmin: admin,
  });

  assertLegacyHostedDemoAbsent(credentials.databaseUrl);

  const seedResult = await seedCookieWorks({
    credentials: {
      apiUrl: credentials.apiUrl,
      serviceRoleKey: credentials.serviceRoleKey,
      expectedProjectRef: credentials.expectedProjectRef,
      publishableKey: credentials.publishableKey,
      databaseUrl: credentials.databaseUrl,
    },
  });

  const verification = assertCookieWorksFoundationOnlyVerified(
    credentials.databaseUrl,
  );

  console.log("");
  console.log(formatVerificationSummary(verification));
  console.log("");
  console.log("Hosted pre-launch tenant replacement complete.");
  console.log(`Legacy organisation absent: ${LEGACY_HOSTED_DEMO_ORGANISATION.code}`);
  console.log(
    `CookieWorks organisation present: ${QA_ORGANISATION.name} (${QA_ORGANISATION_CODE})`,
  );
  console.log(`CookieWorks organisation ID: ${seedResult.organisationId}`);

  return { plan, verification, seedResult };
}

async function main() {
  await runHostedTenantReplacement();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
