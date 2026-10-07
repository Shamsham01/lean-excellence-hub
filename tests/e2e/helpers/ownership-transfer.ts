import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

import { invitationExpiresAt } from "@/modules/identity/invitation-constants";

import type { FoundingE2eUser } from "./founding-onboarding";

export type OwnershipTransferMember = {
  email: string;
  password: string;
  displayName: string;
  userId: string;
};

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

async function createAuthenticatedClient(
  url: string,
  publishableKey: string,
  credentials: { email: string; password: string },
) {
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword(credentials);
  if (error) {
    throw error;
  }
  return client;
}

type DelegatableOffer = {
  role_canonical_name?: string;
  role_version_id?: string;
  scope_options?: Array<{
    scope_type: string;
    scope_unit_id: string | null;
  }>;
};

async function loadOffers(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_delegatable_access_offers");
  if (error) {
    throw error;
  }
  return ((data as { offers?: DelegatableOffer[] } | null)?.offers ??
    []) as DelegatableOffer[];
}

export function createOwnershipTransferMember(
  displayName: string,
): OwnershipTransferMember {
  const suffix = Date.now().toString(36);
  return {
    email: `opex-director-${suffix}@example.test`,
    password: "GroupOpexDirector123!",
    displayName,
    userId: randomUUID(),
  };
}

export async function addActiveMemberToOwnerOrganisation(input: {
  owner: FoundingE2eUser;
  member: OwnershipTransferMember;
  roleCanonicalName?: string;
}) {
  const { url, serviceRoleKey, publishableKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey || !publishableKey) {
    throw new Error(
      "Supabase URL, publishable key, and service role key are required",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await admin.auth.admin.createUser({
    id: input.member.userId,
    email: input.member.email,
    password: input.member.password,
    email_confirm: true,
  });
  if (created.error) {
    throw created.error;
  }

  const enrolment = await admin.rpc("finalise_identity_enrolment", {
    target_user_id: input.member.userId,
  });
  if (enrolment.error) {
    throw enrolment.error;
  }

  const ownerClient = await createAuthenticatedClient(url, publishableKey, {
    email: input.owner.email,
    password: input.owner.password,
  });
  const organisations = await ownerClient.rpc("list_my_eligible_organisations");
  if (organisations.error) {
    throw organisations.error;
  }
  const organisationId = organisations.data?.[0]?.organisation_id as
    string | undefined;
  if (!organisationId) {
    throw new Error("Owner organisation was not found");
  }
  const switched = await ownerClient.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });
  if (switched.error) {
    throw switched.error;
  }

  const offers = await loadOffers(ownerClient);
  const roleCanonicalName =
    input.roleCanonicalName ?? "organisation-administrator";
  const offer = offers.find(
    (candidate) => candidate.role_canonical_name === roleCanonicalName,
  );
  const scope =
    offer?.scope_options?.find(
      (option) => option.scope_type === "organisation",
    ) ?? offer?.scope_options?.[0];
  if (!offer?.role_version_id || !scope) {
    throw new Error(`${roleCanonicalName} offer was not available`);
  }

  const token = createHash("sha256")
    .update(`ownership-transfer-${input.member.email}`)
    .digest("base64url");
  const invite = await ownerClient.rpc("issue_organisation_member_invitation", {
    invitation_recipient_type: "email",
    invitation_canonical_recipient: input.member.email,
    invitation_token_digest: invitationTokenDigest(token),
    invitation_expires_at: invitationExpiresAt(),
    offered_role_version_id: offer.role_version_id,
    offered_scope_type: scope.scope_type,
    ...(scope.scope_unit_id
      ? { offered_scope_unit_id: scope.scope_unit_id }
      : {}),
    intended_display_name: input.member.displayName,
  });
  if (invite.error) {
    throw invite.error;
  }

  const memberClient = await createAuthenticatedClient(url, publishableKey, {
    email: input.member.email,
    password: input.member.password,
  });
  const accepted = await memberClient.rpc("accept_organisation_invitation", {
    invitation_token_digest: invitationTokenDigest(token),
  });
  if (accepted.error) {
    throw accepted.error;
  }

  const { data: memberships, error: membershipError } = await ownerClient
    .from("organisation_memberships")
    .select("id, user_id, display_name")
    .eq("status", "active");
  if (membershipError) {
    throw membershipError;
  }

  const ownerMembership = memberships?.find(
    (row) => row.user_id === input.owner.userId,
  );
  const memberMembership = memberships?.find(
    (row) => row.user_id === input.member.userId,
  );
  if (ownerMembership?.id) {
    await ownerClient.rpc("update_organisation_membership_display_name", {
      target_membership_id: ownerMembership.id,
      target_display_name: "Plymouth CI Manager",
    });
  }
  if (memberMembership?.id) {
    await ownerClient.rpc("update_organisation_membership_display_name", {
      target_membership_id: memberMembership.id,
      target_display_name: input.member.displayName,
    });
  }

  const adminOffer = offers.find(
    (candidate) =>
      candidate.role_canonical_name === "organisation-administrator",
  );
  const adminScope = adminOffer?.scope_options?.find(
    (option) => option.scope_type === "organisation",
  );
  if (ownerMembership?.id && adminOffer?.role_version_id && adminScope) {
    const adminGrant = await ownerClient.rpc("grant_role_version", {
      target_organisation_id: organisationId,
      target_grantee_membership_id: ownerMembership.id,
      target_role_version_id: adminOffer.role_version_id,
      target_scope_type: adminScope.scope_type,
    });
    if (adminGrant.error) {
      throw adminGrant.error;
    }
  }

  const managerOffer = offers.find(
    (candidate) => candidate.role_canonical_name === "manager",
  );
  const siteScope = managerOffer?.scope_options?.find(
    (option) => option.scope_type === "unit_subtree" && option.scope_unit_id,
  );
  if (ownerMembership?.id && managerOffer?.role_version_id && siteScope) {
    const grant = await ownerClient.rpc("grant_role_version", {
      target_organisation_id: organisationId,
      target_grantee_membership_id: ownerMembership.id,
      target_role_version_id: managerOffer.role_version_id,
      target_scope_type: siteScope.scope_type,
      target_scope_unit_id: siteScope.scope_unit_id,
    });
    if (grant.error) {
      throw grant.error;
    }
  }

  return {
    organisationId,
    ownerMembershipId: ownerMembership?.id ?? null,
    memberMembershipId: memberMembership?.id ?? null,
  };
}

export async function loginAsOrganisationMember(
  page: Page,
  credentials: { email: string; password: string },
  organisationName: string,
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    /\/(platform|select-organisation|update-password)(?:\?|$)/,
    { timeout: 30_000 },
  );

  if (page.url().includes("/select-organisation")) {
    await page.getByRole("button", { name: organisationName }).click();
    await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
    return;
  }

  await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
}
