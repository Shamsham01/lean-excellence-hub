import type { SupabaseClient } from "@supabase/supabase-js";

import {
  QA_ORGANISATION,
  QA_ROLES,
  QA_SITE_ROOT_CODES,
  QA_UNITS,
  QA_USER_ROLE_KEY,
  QA_USERS,
} from "../constants";
import { invitationTokenDigest, invitationTokenFromSeed } from "../crypto";
import type { QaAuthIdentity, QaUserKey } from "./auth";
import { signInIdentity, signInUser } from "./auth";

export type UnitMap = Record<string, string>;

export type QaRoleDefinition = {
  canonicalName: string;
  displayName: string;
  description: string;
  scopeType: "organisation" | "unit_subtree" | "self";
  scopeUnitKey: string | null;
  isProtected?: boolean;
  permissions: readonly string[];
  invitationTokenSeed: string;
};

export async function provisionOrganisation(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("provision_organisation", {
    owner_user_id: QA_USERS.admin.id,
    organisation_code: QA_ORGANISATION.code,
    organisation_name: QA_ORGANISATION.name,
  });

  if (error && !error.message.includes("duplicate key value")) {
    throw error;
  }

  return data as string | null;
}

export async function resolveOrganisationIdByCode(
  client: SupabaseClient,
  organisationCode: string,
) {
  const { data, error } = await client
    .from("organisations")
    .select("id, code, name")
    .eq("code", organisationCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function resolveOrganisationId(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_eligible_organisations");

  if (error) {
    throw error;
  }

  const organisations = (data ?? []) as Array<{
    organisation_id: string;
    organisation_code: string;
  }>;

  const organisation = organisations.find(
    (row) => row.organisation_code === QA_ORGANISATION.code,
  );

  if (!organisation) {
    throw new Error(
      "CookieWorks organisation was not found after provisioning.",
    );
  }

  return organisation.organisation_id;
}

export async function switchOrganisation(
  client: SupabaseClient,
  organisationId: string,
) {
  const { data, error } = await client.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw error ?? new Error("Unable to select CookieWorks organisation.");
  }
}

export async function ensureUnits(
  client: SupabaseClient,
  organisationId: string,
): Promise<UnitMap> {
  const unitIds: UnitMap = {};

  const { data: existingUnits, error: existingError } = await client
    .from("organisation_units")
    .select("id, code")
    .eq("organisation_id", organisationId);

  if (existingError) {
    throw existingError;
  }

  for (const unit of existingUnits ?? []) {
    unitIds[unit.code] = unit.id;
  }

  for (const unit of QA_UNITS) {
    if (unitIds[unit.code]) {
      continue;
    }

    const parentId = unit.parentKey ? unitIds[unit.parentKey] : null;
    const { data, error } = await client.rpc("create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: parentId,
      unit_code: unit.code,
      unit_name: unit.name,
      unit_type: unit.type,
    });

    if (error) {
      throw error;
    }

    unitIds[unit.code] = data as string;
  }

  return unitIds;
}

async function findPublishedRoleVersionId(
  client: SupabaseClient,
  organisationId: string,
  canonicalName: string,
) {
  const { data: roles, error: rolesError } = await client
    .from("roles")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("canonical_name", canonicalName)
    .maybeSingle();

  if (rolesError) {
    throw rolesError;
  }

  if (!roles) {
    return null;
  }

  const { data: version, error: versionError } = await client
    .from("role_versions")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("role_id", roles.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw versionError;
  }

  return version?.id ?? null;
}

export async function ensurePublishedRoleDefinition(
  client: SupabaseClient,
  organisationId: string,
  role: QaRoleDefinition,
) {
  const existingVersionId = await findPublishedRoleVersionId(
    client,
    organisationId,
    role.canonicalName,
  );

  if (existingVersionId) {
    return existingVersionId;
  }

  const createDraftRpc =
    "isProtected" in role && role.isProtected
      ? "create_protected_role_draft"
      : "create_role_draft";

  const { data: draftVersionId, error: draftError } = await client.rpc(
    createDraftRpc,
    {
      target_organisation_id: organisationId,
      role_canonical_name: role.canonicalName,
      role_display_name: role.displayName,
      role_description: role.description,
    },
  );

  if (draftError) {
    throw draftError;
  }

  for (const permissionKey of role.permissions) {
    const { error } = await client.rpc("add_role_permission", {
      target_organisation_id: organisationId,
      target_role_version_id: draftVersionId,
      target_permission_key: permissionKey,
    });

    if (error) {
      throw error;
    }
  }

  const { error: publishError } = await client.rpc("publish_role_version", {
    target_organisation_id: organisationId,
    target_role_version_id: draftVersionId,
  });

  if (publishError) {
    throw publishError;
  }

  return draftVersionId as string;
}

export async function ensurePublishedRole(
  client: SupabaseClient,
  organisationId: string,
  roleKey: keyof typeof QA_ROLES,
) {
  return ensurePublishedRoleDefinition(
    client,
    organisationId,
    QA_ROLES[roleKey],
  );
}

async function userHasOrganisationMembership(
  ownerClient: SupabaseClient,
  organisationId: string,
  userId: string,
) {
  const { data, error } = await ownerClient
    .from("organisation_memberships")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

type InvitedUserKey = Exclude<QaUserKey, "admin">;

export async function ensureInvitationAcceptedForIdentity(
  ownerClient: SupabaseClient,
  apiUrl: string,
  publishableKey: string,
  organisationId: string,
  user: QaAuthIdentity,
  role: QaRoleDefinition,
  roleVersionId: string,
  unitIds: UnitMap,
) {
  const alreadyMember = await userHasOrganisationMembership(
    ownerClient,
    organisationId,
    user.id,
  );

  if (alreadyMember) {
    return;
  }

  const token = invitationTokenFromSeed(role.invitationTokenSeed);
  const digest = invitationTokenDigest(token);
  const scopeUnitId =
    role.scopeUnitKey && unitIds[role.scopeUnitKey]
      ? unitIds[role.scopeUnitKey]
      : null;

  const invitee = await signInIdentity(apiUrl, publishableKey, user);
  const existingAccept = await invitee.rpc("accept_organisation_invitation", {
    invitation_token_digest: digest,
  });

  if (!existingAccept.error && existingAccept.data) {
    return;
  }

  const { error: inviteError } = await ownerClient.rpc(
    "issue_organisation_invitation",
    {
      target_organisation_id: organisationId,
      invitation_recipient_type: "email",
      invitation_canonical_recipient: user.email,
      invitation_token_digest: digest,
      invitation_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      offered_role_version_id: roleVersionId,
      offered_scope_type: role.scopeType,
      offered_scope_unit_id: scopeUnitId,
    },
  );

  if (inviteError && inviteError.code !== "23505") {
    throw inviteError;
  }

  const { error: acceptError } = await invitee.rpc(
    "accept_organisation_invitation",
    {
      invitation_token_digest: digest,
    },
  );

  if (acceptError) {
    throw acceptError;
  }
}

export async function ensureInvitationAccepted(
  ownerClient: SupabaseClient,
  apiUrl: string,
  publishableKey: string,
  organisationId: string,
  userKey: InvitedUserKey,
  roleVersionId: string,
  unitIds: UnitMap,
) {
  const roleKey = QA_USER_ROLE_KEY[userKey];
  await ensureInvitationAcceptedForIdentity(
    ownerClient,
    apiUrl,
    publishableKey,
    organisationId,
    QA_USERS[userKey],
    QA_ROLES[roleKey],
    roleVersionId,
    unitIds,
  );
}

export async function ensureDisplayNames(
  apiUrl: string,
  publishableKey: string,
) {
  for (const userKey of Object.keys(QA_USERS) as QaUserKey[]) {
    const user = QA_USERS[userKey];
    const client = await signInUser(apiUrl, publishableKey, userKey);
    const { error } = await client
      .from("profiles")
      .update({ display_name: user.displayName })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
  }
}

async function findMembershipId(
  client: SupabaseClient,
  organisationId: string,
  userId: string,
) {
  const { data, error } = await client
    .from("organisation_memberships")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

async function ensureJobFunction(
  client: SupabaseClient,
  code: string,
  name: string,
) {
  const { data: existing, error: existingError } = await client
    .from("job_functions")
    .select("id")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await client.rpc("create_job_function", {
    target_name: name,
    target_code: code,
  });

  if (error) {
    if (error.code === "23505") {
      const { data: retry, error: retryError } = await client
        .from("job_functions")
        .select("id")
        .eq("code", code)
        .eq("status", "active")
        .maybeSingle();

      if (retryError) {
        throw retryError;
      }

      if (retry?.id) {
        return retry.id;
      }
    }

    throw error ?? new Error(`Failed to create job function ${code}`);
  }

  if (!data) {
    throw new Error(`Failed to create job function ${code}`);
  }

  return data as string;
}

async function ensurePrimaryPlacement(
  client: SupabaseClient,
  membershipId: string,
  jobFunctionId: string,
  unitId: string,
) {
  const { data: existing, error: existingError } = await client
    .from("membership_job_function_assignments")
    .select("id, organisational_unit_id")
    .eq("membership_id", membershipId)
    .eq("job_function_id", jobFunctionId)
    .is("valid_to", null)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.organisational_unit_id === unitId) {
    return;
  }

  const { error } = await client.rpc("assign_membership_job_function", {
    target_membership_id: membershipId,
    target_job_function_id: jobFunctionId,
    target_primary: true,
    target_organisational_unit_id: unitId,
  });

  if (error) {
    throw error;
  }
}

export async function ensureFoundationPlacements(
  client: SupabaseClient,
  organisationId: string,
  unitIds: UnitMap,
) {
  const productionManagerJobFunctionId = await ensureJobFunction(
    client,
    "cookieworks-production-manager",
    "Production Manager",
  );
  const teamLeaderJobFunctionId = await ensureJobFunction(
    client,
    "cookieworks-team-leader",
    "Team Leader",
  );
  const operatorJobFunctionId = await ensureJobFunction(
    client,
    "cookieworks-operator",
    "Operator",
  );

  const bodminOperationsId = unitIds.operations;
  const bodminPackingId = unitIds.packing;
  const exeterOperationsId = unitIds["exeter-operations"];

  if (!bodminOperationsId || !bodminPackingId || !exeterOperationsId) {
    throw new Error(
      "CookieWorks foundation placement units missing from unit map.",
    );
  }

  const productionManagerMembershipId = await findMembershipId(
    client,
    organisationId,
    QA_USERS.productionManager.id,
  );
  const exeterProductionManagerMembershipId = await findMembershipId(
    client,
    organisationId,
    QA_USERS.exeterProductionManager.id,
  );
  const teamLeaderMembershipId = await findMembershipId(
    client,
    organisationId,
    QA_USERS.teamLeader.id,
  );
  const operatorMembershipId = await findMembershipId(
    client,
    organisationId,
    QA_USERS.operator.id,
  );

  if (
    !productionManagerMembershipId ||
    !exeterProductionManagerMembershipId ||
    !teamLeaderMembershipId ||
    !operatorMembershipId
  ) {
    throw new Error(
      "CookieWorks foundation memberships missing for placement seeding.",
    );
  }

  await ensurePrimaryPlacement(
    client,
    productionManagerMembershipId,
    productionManagerJobFunctionId,
    bodminOperationsId,
  );
  await ensurePrimaryPlacement(
    client,
    exeterProductionManagerMembershipId,
    productionManagerJobFunctionId,
    exeterOperationsId,
  );
  await ensurePrimaryPlacement(
    client,
    teamLeaderMembershipId,
    teamLeaderJobFunctionId,
    bodminOperationsId,
  );
  await ensurePrimaryPlacement(
    client,
    operatorMembershipId,
    operatorJobFunctionId,
    bodminPackingId,
  );
}

export async function signInQaPersona(
  apiUrl: string,
  publishableKey: string,
  userKey: QaUserKey,
) {
  const client = await signInUser(apiUrl, publishableKey, userKey);
  const organisationId = await resolveOrganisationId(client);
  await switchOrganisation(client, organisationId);
  return client;
}
