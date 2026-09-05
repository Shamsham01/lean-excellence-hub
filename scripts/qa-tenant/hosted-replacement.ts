import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { QA_ORGANISATION, QA_ORGANISATION_CODE } from "./constants";
import { runSupabaseDbQueryJson } from "./db-cli";
import {
  assertLegacyHostedDemoAbsent,
  captureLegacyDeletionContext,
  deleteLegacyHostedDemoTenant,
  resolveLegacyHostedDemoOrganisation,
} from "./delete-legacy-hosted-demo";
import {
  assertHostedReplacementAllowed,
  extractSupabaseProjectRef,
  parseHostedReplacementArgs,
  resolveHostedCredentials,
} from "./guards";
import { runHostedCookieWorksSeed } from "./hosted-seed";
import {
  LEGACY_HOSTED_DEMO_ORGANISATION,
  QA_HOSTED_RECOVERY_CONFIRM_TOKEN,
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
  HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER,
  HOSTED_REPLACEMENT_VERIFIED_MARKER,
} from "./verification";

export type HostedReplacementMode = "dry-run" | "destructive";

export type HostedReplacementPlan = {
  mode: HostedReplacementMode;
  projectRef: string;
  preserveExistingCookieWorks: boolean;
  legacyOrganisation: ReturnType<typeof resolveLegacyHostedDemoOrganisation>;
  legacyAuthUserIds: string[];
  legacyDeletableAuthUserIds: string[];
  cookieWorksPresent: boolean;
  cookieWorksOrganisationId: string | null;
  planDetails: ReturnType<typeof collectLegacyReplacementPlanDetails>;
};

export function listCookieWorksAuthUserIds(databaseUrl: string) {
  const rows = runSupabaseDbQueryJson<{ user_id: string }>({
    databaseUrl,
    outputFormat: "json",
    sql: `
      select distinct membership.user_id
      from public.organisation_memberships membership
      join public.organisations organisation
        on organisation.id = membership.organisation_id
      where organisation.code = '${QA_ORGANISATION_CODE}'
      order by membership.user_id;
    `,
  });

  return rows.map((row) => row.user_id).filter(Boolean);
}

export function assertAuthIdentitySeparation(
  databaseUrl: string,
  legacyAuthUserIds: string[],
) {
  const cookieWorksAuthUserIds = listCookieWorksAuthUserIds(databaseUrl);
  const overlap = legacyAuthUserIds.filter((userId) =>
    cookieWorksAuthUserIds.includes(userId),
  );

  if (overlap.length > 0) {
    throw new Error(
      `Auth identity overlap detected between legacy demo and CookieWorks: ${overlap.join(", ")}.`,
    );
  }

  return { cookieWorksAuthUserIds, overlap };
}

export function buildHostedReplacementPlan(options: {
  databaseUrl: string;
  mode: HostedReplacementMode;
  projectRef: string;
  preserveExistingCookieWorks?: boolean;
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
    preserveExistingCookieWorks: options.preserveExistingCookieWorks ?? false,
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
    cookieWorksOrganisationId: cookieWorksInventory.organisation?.id ?? null,
    planDetails,
  };
}

export function formatDryRunRecoveryAssessment(options: {
  plan: HostedReplacementPlan;
  legacyContractVerified: boolean;
  legacyAuthIsolationVerified: boolean;
  cookieWorksFoundationVerified: boolean;
  cookieWorksVerificationError?: string;
  authIdentityOverlap: "none" | "present" | "unknown";
  cookieWorksOrganisationId?: string;
}) {
  const lines: string[] = [];

  lines.push("");
  lines.push("Dry-run recovery assessment");
  lines.push(
    `Legacy organisation: ${options.legacyContractVerified ? "VERIFIED" : "FAILED"}`,
  );
  lines.push(
    `Legacy auth isolation: ${options.legacyAuthIsolationVerified ? "VERIFIED" : "FAILED"}`,
  );
  lines.push(
    `CookieWorks already present: ${options.plan.cookieWorksPresent ? "YES" : "NO"}`,
  );

  if (options.plan.cookieWorksPresent) {
    lines.push(
      `CookieWorks foundation-only contract: ${options.cookieWorksFoundationVerified ? "VERIFIED" : "FAILED"}`,
    );
    if (
      !options.cookieWorksFoundationVerified &&
      options.cookieWorksVerificationError
    ) {
      lines.push(`  reason: ${options.cookieWorksVerificationError}`);
    }
    if (options.cookieWorksOrganisationId) {
      lines.push(
        `CookieWorks organisation UUID: ${options.cookieWorksOrganisationId}`,
      );
    }
  }

  if (options.authIdentityOverlap === "none") {
    lines.push("Auth identity overlap: NONE");
  } else if (options.authIdentityOverlap === "present") {
    lines.push("Auth identity overlap: PRESENT");
  } else {
    lines.push("Auth identity overlap: UNKNOWN");
  }

  if (options.plan.cookieWorksPresent) {
    lines.push(
      "Ordinary destructive replacement: REFUSED because CookieWorks exists",
    );
    lines.push(
      "Recovery path available: --preserve-existing-cookieworks (requires --destructive)",
    );
    lines.push(
      `Recovery confirmation token: ${QA_HOSTED_RECOVERY_CONFIRM_TOKEN}`,
    );
  }

  lines.push("No hosted data modified.");

  return lines.join("\n");
}

export function formatHostedReplacementPlan(plan: HostedReplacementPlan) {
  const lines: string[] = [];

  lines.push("Hosted pre-launch tenant replacement plan (QA2)");
  lines.push(`Mode: ${plan.mode}`);
  if (plan.preserveExistingCookieWorks) {
    lines.push("Recovery mode: preserve existing CookieWorks");
  }
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

  if (plan.preserveExistingCookieWorks) {
    lines.push("Recovery destructive execution order:");
    lines.push("  1. Validate legacy organisation contract (id, code, name)");
    lines.push("  2. Capture legacy auth user IDs before any mutation");
    lines.push(
      "  3. Abort if any legacy member belongs to another organisation",
    );
    lines.push(
      "  4. Verify existing CookieWorks complete foundation-only contract",
    );
    lines.push("  5. Abort if any auth identity overlaps with CookieWorks");
    lines.push("  6. Purge legacy tenant module/business data");
    lines.push("  7. Delete legacy tenant storage objects");
    lines.push("  8. Delete legacy foundation records and organisation row");
    lines.push("  9. Delete captured legacy-only auth identities");
    lines.push("  10. Skip CookieWorks seeding");
    lines.push(
      "  11. Re-verify legacy absence and preserved CookieWorks foundation-only state",
    );
  } else {
    lines.push("Destructive execution order:");
    lines.push("  1. Validate legacy organisation contract (id, code, name)");
    lines.push("  2. Capture legacy auth user IDs before any mutation");
    lines.push(
      "  3. Abort if any legacy member belongs to another organisation",
    );
    lines.push("  4. Purge legacy tenant module/business data");
    lines.push("  5. Delete legacy tenant storage objects");
    lines.push("  6. Delete legacy foundation records and organisation row");
    lines.push("  7. Delete captured legacy-only auth identities");
    lines.push("  8. Seed CookieWorks foundation");
    lines.push("  9. Verify legacy absence and CookieWorks foundation-only");
  }

  if (plan.mode === "dry-run") {
    lines.push("");
    lines.push("Dry-run only. No hosted data was modified.");
    if (plan.cookieWorksPresent) {
      lines.push(
        `Ordinary destructive replacement refused while CookieWorks exists. Recovery requires --destructive --preserve-existing-cookieworks and LEANHUB_QA_RESET_CONFIRM=${QA_HOSTED_RECOVERY_CONFIRM_TOKEN}.`,
      );
    } else {
      lines.push(
        `To execute destructively, set LEANHUB_QA_RESET_CONFIRM=${QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN} and rerun with --destructive.`,
      );
    }
  }

  return lines.join("\n");
}

async function verifyCookieWorksRecoveryPreconditions(
  databaseUrl: string,
  authAdmin: SupabaseClient,
) {
  const verification = await assertCookieWorksCompleteFoundationVerified(
    databaseUrl,
    authAdmin,
  );

  return verification;
}

export async function runHostedTenantReplacement(options?: {
  argv?: string[];
  credentials?: ReturnType<typeof resolveHostedCredentials>;
  deleteLegacyTenant?: typeof deleteLegacyHostedDemoTenant;
  seedCookieWorks?: typeof runHostedCookieWorksSeed;
}) {
  const argv = options?.argv ?? process.argv.slice(2);
  const { mode, preserveExistingCookieWorks } =
    parseHostedReplacementArgs(argv);
  const credentials = options?.credentials ?? resolveHostedCredentials();
  const deleteLegacyTenant =
    options?.deleteLegacyTenant ?? deleteLegacyHostedDemoTenant;
  const seedCookieWorks = options?.seedCookieWorks ?? runHostedCookieWorksSeed;

  assertHostedReplacementAllowed({
    apiUrl: credentials.apiUrl,
    expectedProjectRef: credentials.expectedProjectRef,
    mode,
    preserveExistingCookieWorks,
  });

  const projectRef =
    extractSupabaseProjectRef(credentials.apiUrl) ??
    credentials.expectedProjectRef;

  const plan = buildHostedReplacementPlan({
    databaseUrl: credentials.databaseUrl,
    mode,
    projectRef,
    preserveExistingCookieWorks,
  });

  console.log(formatHostedReplacementPlan(plan));

  if (mode === "dry-run") {
    let legacyContractVerified = false;
    let legacyAuthIsolationVerified = false;
    let cookieWorksFoundationVerified = false;
    let cookieWorksVerificationError: string | undefined;
    let authIdentityOverlap: "none" | "present" | "unknown" = "unknown";
    let cookieWorksOrganisationId = plan.cookieWorksOrganisationId ?? undefined;

    if (plan.legacyOrganisation) {
      try {
        captureLegacyDeletionContext(credentials.databaseUrl);
        legacyContractVerified = true;
        legacyAuthIsolationVerified = true;
      } catch (error) {
        cookieWorksVerificationError =
          error instanceof Error ? error.message : String(error);
      }
    }

    if (plan.cookieWorksPresent) {
      try {
        const admin = createClient(
          credentials.apiUrl,
          credentials.serviceRoleKey,
          {
            auth: { autoRefreshToken: false, persistSession: false },
          },
        );
        const verification = await verifyCookieWorksRecoveryPreconditions(
          credentials.databaseUrl,
          admin,
        );
        cookieWorksFoundationVerified = true;
        cookieWorksOrganisationId = verification.organisation.id;
      } catch (error) {
        cookieWorksVerificationError =
          error instanceof Error ? error.message : String(error);
      }

      if (legacyContractVerified) {
        try {
          assertAuthIdentitySeparation(
            credentials.databaseUrl,
            plan.legacyAuthUserIds,
          );
          authIdentityOverlap = "none";
        } catch {
          authIdentityOverlap = "present";
        }
      }
    }

    if (plan.cookieWorksPresent || plan.legacyOrganisation) {
      console.log(
        formatDryRunRecoveryAssessment({
          plan,
          legacyContractVerified,
          legacyAuthIsolationVerified,
          cookieWorksFoundationVerified,
          ...(cookieWorksVerificationError
            ? { cookieWorksVerificationError }
            : {}),
          authIdentityOverlap,
          ...(cookieWorksOrganisationId ? { cookieWorksOrganisationId } : {}),
        }),
      );
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

  const admin = createClient(credentials.apiUrl, credentials.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (preserveExistingCookieWorks) {
    if (!plan.cookieWorksPresent) {
      throw new Error(
        "Hosted tenant recovery refused: CookieWorks organisation is not present.",
      );
    }

    const cookieWorksOrganisationIdBefore =
      plan.cookieWorksOrganisationId ??
      (
        await verifyCookieWorksRecoveryPreconditions(
          credentials.databaseUrl,
          admin,
        )
      ).organisation.id;

    const deletionContext = captureLegacyDeletionContext(
      credentials.databaseUrl,
    );

    assertAuthIdentitySeparation(
      credentials.databaseUrl,
      deletionContext.legacyAuthUserIds,
    );

    await verifyCookieWorksRecoveryPreconditions(
      credentials.databaseUrl,
      admin,
    );

    const deletionResult = await deleteLegacyTenant({
      databaseUrl: credentials.databaseUrl,
      storageAdmin: admin,
      authAdmin: admin,
      deletionContext,
    });

    assertLegacyHostedDemoAbsent(credentials.databaseUrl);

    const verification = await assertCookieWorksCompleteFoundationVerified(
      credentials.databaseUrl,
      admin,
    );

    if (verification.organisation.id !== cookieWorksOrganisationIdBefore) {
      throw new Error(
        `CookieWorks organisation UUID changed during recovery: before ${cookieWorksOrganisationIdBefore}, after ${verification.organisation.id}.`,
      );
    }

    console.log("");
    console.log(formatVerificationSummary(verification.verification));
    console.log("");
    console.log(HOSTED_LEGACY_RECOVERY_VERIFIED_MARKER);
    console.log(
      `Legacy organisation absent: ${LEGACY_HOSTED_DEMO_ORGANISATION.code}`,
    );
    console.log(
      `CookieWorks organisation preserved: ${QA_ORGANISATION.name} (${QA_ORGANISATION_CODE})`,
    );
    console.log(`CookieWorks organisation ID: ${verification.organisation.id}`);
    console.log(
      `Deleted legacy auth identities: ${deletionResult.deletedAuthUserIds.join(", ") || "none"}`,
    );

    return { plan, verification, seedResult: null, deletionResult };
  }

  if (plan.cookieWorksPresent) {
    throw new Error(
      `Hosted tenant replacement refused: CookieWorks organisation ${QA_ORGANISATION_CODE} already exists. Use --preserve-existing-cookieworks for recovery.`,
    );
  }

  const deletionContext = captureLegacyDeletionContext(credentials.databaseUrl);

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
