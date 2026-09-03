import type { SupabaseClient } from "@supabase/supabase-js";

import { QA_USERS } from "./constants";
import {
  ensureDisplayNames,
  ensureInvitationAccepted,
  ensurePublishedRole,
  ensureUnits,
  provisionOrganisation,
  resolveOrganisationId,
  switchOrganisation,
} from "./shared/organisation";
import { ensureAuthUser, signInUser, type QaUserKey } from "./shared/auth";
import { syncAllCookieWorksRolePermissions } from "./sync-role-permissions";
import { loadLocalSupabaseEnv } from "./local-env";

export async function seedCookieWorksFoundation(options: {
  admin: SupabaseClient;
  apiUrl: string;
  publishableKey: string;
}) {
  for (const userKey of Object.keys(QA_USERS) as QaUserKey[]) {
    await ensureAuthUser(options.admin, userKey);
  }

  await provisionOrganisation(options.admin);

  const adminClient = await signInUser(
    options.apiUrl,
    options.publishableKey,
    "admin",
  );
  const organisationId = await resolveOrganisationId(adminClient);
  await switchOrganisation(adminClient, organisationId);

  const unitIds = await ensureUnits(adminClient, organisationId);

  const roleVersionIds = {
    ciManager: await ensurePublishedRole(
      adminClient,
      organisationId,
      "ciManager",
    ),
    productionManager: await ensurePublishedRole(
      adminClient,
      organisationId,
      "productionManager",
    ),
    teamLeader: await ensurePublishedRole(
      adminClient,
      organisationId,
      "teamLeader",
    ),
    operator: await ensurePublishedRole(
      adminClient,
      organisationId,
      "operator",
    ),
    assessor: await ensurePublishedRole(
      adminClient,
      organisationId,
      "assessor",
    ),
    financeValidator: await ensurePublishedRole(
      adminClient,
      organisationId,
      "financeValidator",
    ),
  };

  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "ciManager",
    roleVersionIds.ciManager,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "productionManager",
    roleVersionIds.productionManager,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "teamLeader",
    roleVersionIds.teamLeader,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "operator",
    roleVersionIds.operator,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "assessor",
    roleVersionIds.assessor,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "finance",
    roleVersionIds.financeValidator,
    unitIds,
  );

  await ensureDisplayNames(options.apiUrl, options.publishableKey);

  const env = loadLocalSupabaseEnv("qa:cookie:seed");
  syncAllCookieWorksRolePermissions(env.databaseUrl);

  return { organisationId, unitIds };
}
