#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { QA_ORGANISATION, QA_ORGANISATION_CODE } from "./constants";
import {
  assertLegacyHostedDemoAbsent,
  captureLegacyDeletionContext,
  deleteLegacyHostedDemoTenant,
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
  collectLegacyReplacementPlanDetails,
  formatLegacyReplacementPlanDetails,
} from "./legacy-replacement-plan";
import { collectTenantInventory } from "./tenant-inventory";
import {
  assertCookieWorksCompleteFoundationVerified,
  formatVerificationSummary,
  HOSTED_REPLACEMENT_VERIFIED_MARKER,
} from "./verification";

export type HostedReplacementMode = "dry-run" | "destructive";

export type HostedReplacementPlan = {
  mode: HostedReplacementMode;
  projectRef: string;
  legacyOrganisation: ReturnType<typeof resolveLegacyHostedDemoOrganisation>;
  legacyAuthUserIds: string[];
  legacyDeletableAuthUserIds: string[];
  cookieWorksPresent: boolean;
  planDetails: ReturnType<typeof collectLegacyReplacementPlanDetails>;
};

export function buildHostedReplacementPlan(options: {
  databaseUrl: string;
  mode: HostedReplacementMode;
  projectRef: string;
}): HostedReplacementPlan {
  const legacyOrganisation = resolveLegacyHostedDemoOrganisation(
    options.databaseUrl,
  );
  const cookieWorksInventory = collectTenantInventory(
    options.databaseUrl,
    QA_ORGANISATION_CODE,
  );
  const planDetails = collectLegacyReplacementPlanDetails(
    options.databaseUrl,
    legacyOrganisation,
  );

  return {
    mode: options.mode,
    projectRef: options.projectRef,
    legacyOrganisation,
    legacyAuthUserIds: legacyOrganisation
      ? planDetails.members.map((member) => member.user_id)
      : [],
    legacyDeletableAuthUserIds: legacyOrganisation
      ? planDetails.members
          .filter((member) => member.legacy_only)
          .map((member) => member.user_id)
      : [],
    cookieWorksPresent: cookieWorksInventory.organisation !== null,
    planDetails,
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
  lines.push(
    formatLegacyReplacementPlanDetails(plan.planDetails, {
      cookieWorksPresent: plan.cookieWorksPresent,
      legacyAuthUserIds: plan.legacyAuthUserIds,
      legacyDeletableAuthUserIds: plan.legacyDeletableAuthUserIds,
    }),
  );
  lines.push("");
  lines.push("Destructive execution order:");
  lines.push("  1. Validate legacy organisation contract (id, code, name)");
  lines.push("  2. Capture legacy auth user IDs before any mutation");
  lines.push("  3. Abort if any legacy member belongs to another organisation");
  lines.push("  4. Purge legacy tenant module/business data");
  lines.push("  5. Delete legacy tenant storage objects");
  lines.push("  6. Delete legacy foundation records and organisation row");
  lines.push("  7. Delete captured legacy-only auth identities");
  lines.push("  8. Seed CookieWorks foundation");
  lines.push("  9. Verify legacy absence and CookieWorks foundation-only");

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
        captureLegacyDeletionContext(credentials.databaseUrl);
        console.log("");
        console.log("Legacy organisation contract: VERIFIED");
        console.log("Legacy auth isolation: VERIFIED");
      } catch (error) {
        console.log("");
        console.log(
          `Legacy organisation contract / isolation: FAILED (${error instanceof Error ? error.message : error})`,
        );
      }
    }

    return { plan, verification: null };
  }

  if (!credentials.databaseUrl) {
    throw new Error(
      "Hosted tenant replacement requires LEANHUB_QA_RESET_DATABASE_URL before destructive execution.",
    );
  }

  if (!credentials.publishableKey) {
    throw new Error(
      "Hosted tenant replacement requires LEANHUB_QA_RESET_PUBLISHABLE_KEY before destructive execution.",
    );
  }

  if (plan.cookieWorksPresent) {
    throw new Error(
      `Hosted tenant replacement refused: CookieWorks organisation ${QA_ORGANISATION_CODE} already exists. Investigate manually before rerunning.`,
    );
  }

  const deletionContext = captureLegacyDeletionContext(credentials.databaseUrl);

  const admin = createClient(credentials.apiUrl, credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const deletionResult = await deleteLegacyTenant({
    databaseUrl: credentials.databaseUrl,
    storageAdmin: admin,
    authAdmin: admin,
    deletionContext,
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

  const verification = await assertCookieWorksCompleteFoundationVerified(
    credentials.databaseUrl,
    admin,
  );

  console.log("");
  console.log(formatVerificationSummary(verification.verification));
  console.log("");
  console.log(HOSTED_REPLACEMENT_VERIFIED_MARKER);
  console.log(
    `Legacy organisation absent: ${LEGACY_HOSTED_DEMO_ORGANISATION.code}`,
  );
  console.log(
    `CookieWorks organisation present: ${QA_ORGANISATION.name} (${QA_ORGANISATION_CODE})`,
  );
  console.log(`CookieWorks organisation ID: ${seedResult.organisationId}`);
  console.log(
    `Deleted legacy auth identities: ${deletionResult.deletedAuthUserIds.join(", ") || "none"}`,
  );

  return { plan, verification, seedResult, deletionResult };
}

async function main() {
  await runHostedTenantReplacement();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
