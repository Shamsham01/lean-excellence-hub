import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  DEMO_ORGANISATION,
  DEMO_PLATFORM_SAMPLES,
  DEMO_ROLES,
  DEMO_UNITS,
  DEMO_USERS,
} from "./constants.ts";
import { invitationTokenDigest, invitationTokenFromSeed } from "./crypto.ts";
import { loadLocalSupabaseEnv } from "./local-env.ts";

type DemoUserKey = keyof typeof DEMO_USERS;

type UnitMap = Record<string, string>;

async function ensureAuthUser(admin: SupabaseClient, userKey: DemoUserKey) {
  const user = DEMO_USERS[userKey];
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
}

async function signInUser(
  apiUrl: string,
  publishableKey: string,
  userKey: DemoUserKey,
) {
  const user = DEMO_USERS[userKey];
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
  const { data, error } = await admin.rpc("provision_organisation", {
    owner_user_id: DEMO_USERS.admin.id,
    organisation_code: DEMO_ORGANISATION.code,
    organisation_name: DEMO_ORGANISATION.name,
  });

  if (error && !error.message.includes("duplicate key value")) {
    throw error;
  }

  return data as string | null;
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
    (row) => row.organisation_code === DEMO_ORGANISATION.code,
  );

  if (!organisation) {
    throw new Error("Demo organisation was not found after provisioning.");
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
    throw error ?? new Error("Unable to select demo organisation.");
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

  for (const unit of DEMO_UNITS) {
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

async function ensurePublishedRole(
  client: SupabaseClient,
  organisationId: string,
  roleKey: keyof typeof DEMO_ROLES,
) {
  const role = DEMO_ROLES[roleKey];
  const existingVersionId = await findPublishedRoleVersionId(
    client,
    organisationId,
    role.canonicalName,
  );

  if (existingVersionId) {
    return existingVersionId;
  }

  const { data: draftVersionId, error: draftError } = await client.rpc(
    "create_role_draft",
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
  userKey: Exclude<DemoUserKey, "admin">,
  roleVersionId: string,
  unitIds: UnitMap,
) {
  const alreadyMember = await userHasOrganisationMembership(
    ownerClient,
    organisationId,
    DEMO_USERS[userKey].id,
  );

  if (alreadyMember) {
    return;
  }

  const role = DEMO_ROLES[userKey];
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
      invitation_canonical_recipient: DEMO_USERS[userKey].email,
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

async function ensurePlatformSamples(client: SupabaseClient) {
  const { count: actionCount, error: actionCountError } = await client
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("title", DEMO_PLATFORM_SAMPLES.actionTitle);

  if (actionCountError) {
    throw actionCountError;
  }

  if ((actionCount ?? 0) === 0) {
    const { error } = await client.rpc("create_action", {
      target_title: DEMO_PLATFORM_SAMPLES.actionTitle,
      target_description:
        "Demonstration action seeded for local Milestone 4 development.",
      target_priority: "normal",
    });

    if (error) {
      throw error;
    }
  }

  const { data: templates, error: templateError } = await client
    .from("templates")
    .select("id")
    .eq("display_name", DEMO_PLATFORM_SAMPLES.templateName)
    .limit(1);

  if (templateError) {
    throw templateError;
  }

  if ((templates ?? []).length > 0) {
    return;
  }

  const { data: templateId, error: createTemplateError } = await client.rpc(
    "create_template_draft",
    {
      target_display_name: DEMO_PLATFORM_SAMPLES.templateName,
      target_description: DEMO_PLATFORM_SAMPLES.templateDescription,
    },
  );

  if (createTemplateError) {
    throw createTemplateError;
  }

  const { data: templateVersion, error: versionError } = await client
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("version_number", 1)
    .maybeSingle();

  if (versionError || !templateVersion) {
    throw versionError ?? new Error("Demo template version was not created.");
  }

  const { error: publishError } = await client.rpc("publish_template_version", {
    target_template_version_id: templateVersion.id,
  });

  if (publishError) {
    throw publishError;
  }
}

async function main() {
  const env = loadLocalSupabaseEnv();
  const admin = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(
    "Seeding Apex Manufacturing demo tenant (local development only)...",
  );

  for (const userKey of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    await ensureAuthUser(admin, userKey);
  }

  await provisionOrganisation(admin);

  const adminClient = await signInUser(env.apiUrl, env.publishableKey, "admin");
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
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "manager",
    managerRoleVersionId,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "operator",
    operatorRoleVersionId,
    unitIds,
  );

  await ensurePlatformSamples(adminClient);

  console.log("Demo seed complete.");
  console.log(
    `Organisation: ${DEMO_ORGANISATION.name} (${DEMO_ORGANISATION.code})`,
  );
  console.log("Admin login: admin@apex.local");
  console.log("Routes: /platform, /platform/actions, /platform/templates");
  console.log("Reset: npm run db:reset && npm run db:seed-demo");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
