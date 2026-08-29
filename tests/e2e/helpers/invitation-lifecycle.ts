import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { invitationExpiresAt } from "@/modules/identity/invitation-constants";

import {
  onboardingE2eCredentials,
  onboardingOrgAdminCredentials,
} from "./onboarding-auth";

export const invitationLifecycleCredentials = {
  newEmployeeEmail: "invitation-new-employee@example.test",
  newEmployeePassword: "InvitationNewEmployee123!",
  existingEmployeeEmail: "invitation-existing@example.test",
  existingEmployeePassword: "InvitationExistingEmployee123!",
  wrongAccountEmail: "invitation-wrong-account@example.test",
  wrongAccountPassword: "InvitationWrongAccount123!",
  multiOrgEmail: "invitation-multi-org@example.test",
  multiOrgPassword: "InvitationMultiOrgEmployee123!",
} as const;

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

export function getInvitationLifecycleClients() {
  const { url, serviceRoleKey, publishableKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey || !publishableKey) {
    throw new Error(
      "Supabase environment is required for invitation lifecycle E2E",
    );
  }

  return {
    url,
    publishableKey,
    admin: createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    anon: createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function ensureInvitationLifecycleUser(
  admin: SupabaseClient,
  user: { email: string; password: string },
) {
  const existing = await admin.auth.admin.listUsers();
  const found = existing.data.users.find((entry) => entry.email === user.email);

  if (!found) {
    const created = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });
    if (created.error) {
      throw created.error;
    }
    const userId = created.data.user?.id;
    if (userId) {
      await admin.rpc("finalise_identity_enrolment", {
        target_user_id: userId,
      });
    }
    return;
  }

  await admin.auth.admin.updateUserById(found.id, {
    password: user.password,
    email_confirm: true,
  });
  await admin.rpc("finalise_identity_enrolment", { target_user_id: found.id });
}

export async function fetchLatestConfirmationPath(email: string) {
  const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) {
    throw new Error(`Unable to read Mailpit messages: ${response.status}`);
  }

  const payload = (await response.json()) as {
    messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>;
  };

  const message = [...(payload.messages ?? [])]
    .reverse()
    .find((entry) =>
      entry.To?.some((recipient) => recipient.Address === email),
    );

  if (!message?.ID) {
    throw new Error(`No confirmation email found for ${email}`);
  }

  const detailResponse = await fetch(
    `${mailpitUrl}/api/v1/message/${message.ID}`,
  );
  if (!detailResponse.ok) {
    throw new Error(`Unable to read Mailpit message ${message.ID}`);
  }

  const detail = (await detailResponse.json()) as {
    HTML?: string;
    Text?: string;
  };
  const body = detail.HTML ?? detail.Text ?? "";
  const match = body.match(/href="([^"]*\/auth\/confirm[^"]*)"/i);
  if (!match?.[1]) {
    throw new Error("Confirmation link was not found in the email body");
  }

  return match[1].replace(/&amp;/g, "&");
}

export async function issueInvitationForEmail(
  ownerClient: SupabaseClient,
  input: {
    email: string;
    tokenSeed: string;
    expiresAt?: string;
    displayName?: string;
  },
) {
  const token = createHash("sha256")
    .update(input.tokenSeed)
    .digest("base64url");
  const { data: offers, error: offersError } = await ownerClient.rpc(
    "get_delegatable_access_offers",
  );
  if (offersError) {
    throw offersError;
  }

  const offerList = (offers as { offers?: Array<Record<string, string>> })
    ?.offers;
  const offer = offerList?.[0];
  if (!offer?.role_version_id || !offer.scope_options) {
    throw new Error(
      "No delegatable offer available for invitation lifecycle E2E",
    );
  }

  const scope = (
    offer.scope_options as unknown as Array<{
      scope_type: string;
      scope_unit_id: string | null;
    }>
  )[0];

  const { error } = await ownerClient.rpc(
    "issue_organisation_member_invitation",
    {
      invitation_recipient_type: "email",
      invitation_canonical_recipient: input.email,
      invitation_token_digest: invitationTokenDigest(token),
      invitation_expires_at: input.expiresAt ?? invitationExpiresAt(),
      offered_role_version_id: offer.role_version_id,
      offered_scope_type: scope?.scope_type ?? "organisation",
      ...(scope?.scope_unit_id
        ? { offered_scope_unit_id: scope.scope_unit_id }
        : {}),
      ...(input.displayName
        ? { intended_display_name: input.displayName }
        : {}),
    },
  );

  if (error) {
    throw error;
  }

  return { token, invitationPath: `/invitations/${token}` };
}

export async function createAuthenticatedClient(
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

export async function createOnboardingOrgAdminClient(
  url: string,
  publishableKey: string,
) {
  const client = await createAuthenticatedClient(
    url,
    publishableKey,
    onboardingOrgAdminCredentials,
  );
  const { data: organisations, error } = await client.rpc(
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
    throw new Error("Onboarding organisation was not available to org admin");
  }

  const { error: switchError } = await client.rpc("switch_organisation", {
    target_organisation_id: organisation.organisation_id,
  });
  if (switchError) {
    throw switchError;
  }

  return client;
}
