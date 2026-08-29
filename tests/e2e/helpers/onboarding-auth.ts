import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const onboardingE2eCredentials = {
  email: "onboarding-e2e@example.test",
  password: "OnboardingE2ePassword123!",
  organisationName: "Onboarding E2E Organisation",
  organisationCode: "onboarding-e2e",
  userId: "e2e00000-0000-0000-0000-000000000002",
} as const;

export const onboardingOrgAdminCredentials = {
  email: "onboarding-org-admin@example.test",
  password: "OnboardingOrgAdminPassword123!",
  userId: "e2e00000-0000-0000-0000-000000000003",
} as const;

export const onboardingE2eRootUnit = {
  code: "e2e-root",
  name: "E2E Root Site",
  type: "site",
} as const;

const ORG_ADMIN_INVITATION_TOKEN_SEED =
  "onboarding-e2e-organisation-administrator-invitation";

function invitationTokenFromSeed(seed: string) {
  return createHash("sha256").update(seed).digest("base64url");
}

function invitationTokenDigest(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

function resolveSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && serviceRoleKey && publishableKey) {
    return { url, serviceRoleKey, publishableKey };
  }

  if (process.env.E2E_WITH_SUPABASE !== "1") {
    return { url, serviceRoleKey, publishableKey };
  }

  try {
    const output = execSync("npx supabase status -o json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const status = JSON.parse(output) as {
      API_URL?: string;
      ANON_KEY?: string;
      SERVICE_ROLE_KEY?: string;
    };

    return {
      url: url ?? status.API_URL,
      serviceRoleKey: serviceRoleKey ?? status.SERVICE_ROLE_KEY,
      publishableKey: publishableKey ?? status.ANON_KEY,
    };
  } catch {
    return { url, serviceRoleKey, publishableKey };
  }
}

async function ensureAuthUser(
  admin: SupabaseClient,
  user: { id: string; email: string; password: string },
) {
  const existing = await admin.auth.admin.getUserById(user.id);

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  }
}

async function createAuthenticatedClient(
  url: string,
  publishableKey: string,
  credentials: { email: string; password: string },
): Promise<SupabaseClient> {
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (signInError) {
    throw signInError;
  }

  return client;
}

async function resolveOrganisationId(ownerClient: SupabaseClient) {
  const { data: organisations, error } = await ownerClient.rpc(
    "list_my_eligible_organisations",
  );

  if (error) {
    throw error;
  }

  const organisation = organisations?.find(
    (entry: { organisation_code: string; organisation_id: string }) =>
      entry.organisation_code === onboardingE2eCredentials.organisationCode,
  );

  if (!organisation?.organisation_id) {
    throw new Error("Onboarding E2E organisation was not provisioned");
  }

  return organisation.organisation_id;
}

async function ensureOrganisationAdministratorAccess(
  ownerClient: SupabaseClient,
  organisationId: string,
  url: string,
  publishableKey: string,
) {
  const adminClient = await createAuthenticatedClient(
    url,
    publishableKey,
    onboardingOrgAdminCredentials,
  );

  const { data: eligibleOrganisations, error: eligibleError } =
    await adminClient.rpc("list_my_eligible_organisations");
  if (eligibleError) {
    throw eligibleError;
  }

  if (
    eligibleOrganisations?.some(
      (entry: { organisation_code: string }) =>
        entry.organisation_code === onboardingE2eCredentials.organisationCode,
    )
  ) {
    return;
  }

  const invitationDigest = invitationTokenDigest(
    invitationTokenFromSeed(ORG_ADMIN_INVITATION_TOKEN_SEED),
  );

  const existingAccept = await adminClient.rpc(
    "accept_organisation_invitation",
    {
      invitation_token_digest: invitationDigest,
    },
  );

  if (!existingAccept.error && existingAccept.data) {
    return;
  }

  const { data: offers, error: offersError } = await ownerClient.rpc(
    "get_delegatable_access_offers",
  );

  if (offersError) {
    throw offersError;
  }

  const offerList = (offers as { offers?: Array<Record<string, string>> })
    ?.offers;
  const adminOffer = offerList?.find(
    (offer) => offer.role_canonical_name === "organisation-administrator",
  );

  if (!adminOffer?.role_version_id) {
    throw new Error("Organisation administrator role offer was not found");
  }

  const { error: inviteError } = await ownerClient.rpc(
    "issue_organisation_invitation",
    {
      target_organisation_id: organisationId,
      invitation_recipient_type: "email",
      invitation_canonical_recipient: onboardingOrgAdminCredentials.email,
      invitation_token_digest: invitationDigest,
      invitation_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      offered_role_version_id: adminOffer.role_version_id,
      offered_scope_type: "organisation",
      offered_scope_unit_id: undefined,
    },
  );

  if (inviteError && inviteError.code !== "23505") {
    throw inviteError;
  }

  const { error: acceptError } = await adminClient.rpc(
    "accept_organisation_invitation",
    {
      invitation_token_digest: invitationDigest,
    },
  );

  if (acceptError) {
    throw acceptError;
  }
}

export async function ensureOnboardingE2eOrganisation() {
  const { url, serviceRoleKey, publishableKey } = resolveSupabaseEnv();

  if (!url || !serviceRoleKey || !publishableKey) {
    throw new Error(
      "Supabase URL, publishable key, and service role key are required for E2E auth",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureAuthUser(admin, {
    id: onboardingE2eCredentials.userId,
    email: onboardingE2eCredentials.email,
    password: onboardingE2eCredentials.password,
  });
  await ensureAuthUser(admin, {
    id: onboardingOrgAdminCredentials.userId,
    email: onboardingOrgAdminCredentials.email,
    password: onboardingOrgAdminCredentials.password,
  });

  await admin.rpc("finalise_identity_enrolment", {
    target_user_id: onboardingOrgAdminCredentials.userId,
  });

  const { data: provisionedOrganisationId, error: provisionError } =
    await admin.rpc("provision_organisation", {
      owner_user_id: onboardingE2eCredentials.userId,
      organisation_code: onboardingE2eCredentials.organisationCode,
      organisation_name: onboardingE2eCredentials.organisationName,
    });

  if (
    provisionError &&
    provisionError.code !== "23505" &&
    !provisionError.message.includes("duplicate")
  ) {
    throw provisionError;
  }

  const ownerClient = await createAuthenticatedClient(
    url,
    publishableKey,
    onboardingE2eCredentials,
  );

  const organisationId =
    provisionedOrganisationId ?? (await resolveOrganisationId(ownerClient));

  const { error: switchError } = await ownerClient.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (switchError) {
    throw switchError;
  }

  const { error: unitError } = await ownerClient.rpc(
    "create_organisation_unit",
    {
      target_organisation_id: organisationId,
      target_parent_unit_id: null,
      unit_code: onboardingE2eRootUnit.code,
      unit_name: onboardingE2eRootUnit.name,
      unit_type: onboardingE2eRootUnit.type,
    },
  );

  if (
    unitError &&
    unitError.code !== "23505" &&
    !unitError.message.includes("duplicate")
  ) {
    throw unitError;
  }

  await ensureOrganisationAdministratorAccess(
    ownerClient,
    organisationId,
    url,
    publishableKey,
  );
}
