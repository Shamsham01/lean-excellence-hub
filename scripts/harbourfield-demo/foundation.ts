import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  HARBOURFIELD_ORGANISATION,
  HARBOURFIELD_ROLES,
  HARBOURFIELD_UNITS,
  HARBOURFIELD_USERS,
  type HarbourfieldUserKey,
} from "./constants";
import {
  invitationTokenDigest,
  invitationTokenFromSeed,
} from "../demo-seed/crypto";
import { expectRpc } from "./rpc";

export type UnitMap = Record<string, string>;

async function ensureAuthUser(
  admin: SupabaseClient,
  userKey: HarbourfieldUserKey,
) {
  const user = HARBOURFIELD_USERS[userKey];
  const existing = await admin.auth.admin.getUserById(user.id);

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.displayName },
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.displayName },
    });

    if (updated.error) {
      throw updated.error;
    }
  }

  const { error: enrolmentError } = await admin.rpc(
    "finalise_identity_enrolment",
    {
      target_user_id: user.id,
    },
  );

  if (enrolmentError) {
    throw enrolmentError;
  }
}

async function signInUser(
  apiUrl: string,
  publishableKey: string,
  userKey: HarbourfieldUserKey,
) {
  const user = HARBOURFIELD_USERS[userKey];
  const client = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw error ?? new Error(`Unable to sign in ${user.email}`);
  }

  return client;
}

async function provisionOrganisation(admin: SupabaseClient) {
  const { error } = await admin.rpc("provision_organisation", {
    owner_user_id: HARBOURFIELD_USERS.admin.id,
    organisation_code: HARBOURFIELD_ORGANISATION.code,
    organisation_name: HARBOURFIELD_ORGANISATION.name,
  });

  if (error && !error.message.includes("duplicate key value")) {
    throw error;
  }
}

async function resolveOrganisationId(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_eligible_organisations");

  if (error) {
    throw error;
  }

  const organisations = (data ?? []) as Array<{
    organisation_id: string;
    organisation_code: string;
  }>;

  const organisation = organisations.find(
    (row) => row.organisation_code === HARBOURFIELD_ORGANISATION.code,
  );

  if (!organisation) {
    throw new Error(
      "Harbourfield organisation was not found after provisioning.",
    );
  }

  return organisation.organisation_id;
}

async function switchOrganisation(
  client: SupabaseClient,
  organisationId: string,
) {
  const { data, error } = await client.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw error ?? new Error("Unable to select Harbourfield organisation.");
  }
}

async function ensureUnits(
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

  for (const unit of HARBOURFIELD_UNITS) {
    if (unitIds[unit.code]) {
      continue;
    }

    const parentId = unit.parentKey ? unitIds[unit.parentKey] : null;
    const unitId = (await expectRpc(client, "create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: parentId,
      unit_code: unit.code,
      unit_name: unit.name,
      unit_type: unit.type,
    })) as string;

    unitIds[unit.code] = unitId;
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

async function ensurePublishedRole(
  client: SupabaseClient,
  organisationId: string,
  roleKey: keyof typeof HARBOURFIELD_ROLES,
) {
  const role = HARBOURFIELD_ROLES[roleKey];
  const existingVersionId = await findPublishedRoleVersionId(
    client,
    organisationId,
    role.canonicalName,
  );

  if (existingVersionId) {
    return existingVersionId;
  }

  const draftVersionId = (await expectRpc(client, "create_role_draft", {
    target_organisation_id: organisationId,
    role_canonical_name: role.canonicalName,
    role_display_name: role.displayName,
    role_description: role.description,
  })) as string;

  for (const permissionKey of role.permissions) {
    await expectRpc(client, "add_role_permission", {
      target_organisation_id: organisationId,
      target_role_version_id: draftVersionId,
      target_permission_key: permissionKey,
    });
  }

  await expectRpc(client, "publish_role_version", {
    target_organisation_id: organisationId,
    target_role_version_id: draftVersionId,
  });

  return draftVersionId;
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

async function ensureInvitationAccepted(
  ownerClient: SupabaseClient,
  apiUrl: string,
  publishableKey: string,
  organisationId: string,
  userKey: Exclude<HarbourfieldUserKey, "admin">,
  roleVersionId: string,
  unitIds: UnitMap,
) {
  const alreadyMember = await userHasOrganisationMembership(
    ownerClient,
    organisationId,
    HARBOURFIELD_USERS[userKey].id,
  );

  if (alreadyMember) {
    return;
  }

  const role = HARBOURFIELD_ROLES[userKey];
  const token = invitationTokenFromSeed(role.invitationTokenSeed);
  const digest = invitationTokenDigest(token);
  const scopeUnitId =
    role.scopeUnitKey && unitIds[role.scopeUnitKey]
      ? unitIds[role.scopeUnitKey]
      : null;

  const invitee = await signInUser(apiUrl, publishableKey, userKey);
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
      invitation_canonical_recipient: HARBOURFIELD_USERS[userKey].email,
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

export async function ensureLocalHarbourfieldFoundation(options: {
  admin: SupabaseClient;
  apiUrl: string;
  publishableKey: string;
}) {
  for (const userKey of Object.keys(
    HARBOURFIELD_USERS,
  ) as HarbourfieldUserKey[]) {
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

  const managerRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "manager",
  );
  const operatorRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "operator",
  );

  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "manager",
    managerRoleVersionId,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    options.apiUrl,
    options.publishableKey,
    organisationId,
    "operator",
    operatorRoleVersionId,
    unitIds,
  );

  const operatorJobFunctionId = (await expectRpc(
    adminClient,
    "create_job_function",
    {
      target_code: "packing-operator",
      target_name: "Packing Operator",
    },
  )) as string;

  const { data: operatorMembership } = await adminClient
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", HARBOURFIELD_USERS.operator.id)
    .eq("status", "active")
    .maybeSingle();

  const packingLineUnitId = unitIds["packing-line-1"];
  if (operatorMembership?.id && packingLineUnitId) {
    await expectRpc(adminClient, "assign_membership_job_function", {
      target_membership_id: operatorMembership.id,
      target_job_function_id: operatorJobFunctionId,
      target_primary: true,
      target_organisational_unit_id: packingLineUnitId,
    });
  }

  return { organisationId, unitIds };
}
