import { execFileSync, execSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { invitationExpiresAt } from "@/modules/identity/invitation-constants";

import { fetchLatestEmailHref, fetchLatestEmailHrefWithRetry } from "./mailpit";
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

export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
) {
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage });
    if (listed.error) {
      throw listed.error;
    }
    const found = listed.data.users.find((entry) => entry.email === email);
    if (found || listed.data.users.length < perPage) {
      return found ?? null;
    }
  }
  return null;
}

export async function ensureInvitationLifecycleUser(
  admin: SupabaseClient,
  user: { email: string; password: string },
) {
  const found = await findAuthUserByEmail(admin, user.email);

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
  return fetchLatestEmailHref(email, "/auth/confirm");
}

export async function issueInvitationForEmail(
  ownerClient: SupabaseClient,
  input: {
    email: string;
    tokenSeed: string;
    expiresAt?: string;
    displayName?: string;
    jobFunctionId?: string;
    organisationalUnitId?: string;
    roleVersionId?: string;
    scopeType?: string;
    scopeUnitId?: string;
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
      offered_role_version_id: input.roleVersionId ?? offer.role_version_id,
      offered_scope_type:
        input.scopeType ?? scope?.scope_type ?? "organisation",
      ...((input.scopeUnitId ?? scope?.scope_unit_id)
        ? { offered_scope_unit_id: input.scopeUnitId ?? scope?.scope_unit_id }
        : {}),
      ...(input.displayName
        ? { intended_display_name: input.displayName }
        : {}),
      ...(input.jobFunctionId
        ? { intended_job_function_id: input.jobFunctionId }
        : {}),
      ...(input.organisationalUnitId
        ? { intended_organisational_unit_id: input.organisationalUnitId }
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

export async function prepareInvitationSignupBinding(token: string) {
  const { url, publishableKey } = getInvitationLifecycleClients();
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const digest = invitationTokenDigest(token);
  const { data, error } = await client.rpc(
    "prepare_organisation_invitation_signup_binding",
    {
      invitation_token_digest: digest,
    },
  );
  if (error || !data) {
    throw error ?? new Error("Unable to prepare invitation signup binding");
  }
  return data as string;
}

export async function attemptDirectSignupForEmail(input: {
  email: string;
  password: string;
}) {
  const { url, publishableKey } = getInvitationLifecycleClients();
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client.auth.signUp({
    email: input.email,
    password: input.password,
  });
}

function localDatabaseContainerName() {
  const names = execSync("docker ps --format '{{.Names}}'", {
    encoding: "utf8",
  })
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.startsWith("supabase_db_"));

  if (names.length !== 1 || !names[0]) {
    throw new Error("Local Supabase database container was not found.");
  }

  return names[0];
}

function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("Refusing to run a local fixture update for this value.");
  }
}

function runPsql(
  sql: string,
  variables: Record<string, string>,
  query: boolean,
  uuidVariableKeys?: ReadonlySet<string>,
) {
  const uuidKeys = uuidVariableKeys ?? new Set(Object.keys(variables));
  for (const [key, value] of Object.entries(variables)) {
    if (uuidKeys.has(key)) {
      assertUuid(value);
    } else if (/['\\]/.test(value)) {
      throw new Error(`Refusing unsafe psql variable ${key}.`);
    }
  }

  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      localDatabaseContainerName(),
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      ...(query ? ["-t", "-A"] : []),
      ...Object.entries(variables).flatMap(([key, value]) => [
        "-v",
        `${key}=${value}`,
      ]),
    ],
    {
      encoding: "utf8",
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function runLocalSql(
  sql: string,
  variables: Record<string, string>,
  uuidVariableKeys?: ReadonlySet<string>,
) {
  runPsql(sql, variables, false, uuidVariableKeys);
}

function queryLocalSql(
  sql: string,
  variables: Record<string, string>,
  uuidVariableKeys?: ReadonlySet<string>,
) {
  return runPsql(sql, variables, true, uuidVariableKeys)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function invitationInboxProofDigest(inboxProof: string) {
  return `\\x${createHash("sha256").update(inboxProof).digest("hex")}`;
}

export async function dispatchOrganisationInvitationDeliveryForE2e(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
  invitationToken: string;
  inboxProof: string;
}) {
  const response = await fetch(
    `${input.supabaseUrl.replace(/\/$/, "")}/functions/v1/organisation-invitation-delivery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: input.serviceRoleKey,
        Authorization: `Bearer ${input.serviceRoleKey}`,
      },
      body: JSON.stringify({
        delivery_id: input.deliveryId,
        invitation_token: input.invitationToken,
        inbox_proof: input.inboxProof,
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `organisation-invitation-delivery failed (${response.status}): ${detail}`,
    );
  }
}

export async function issueInvitationWithDeliveredInboxProof(
  ownerClient: SupabaseClient,
  input: Parameters<typeof issueInvitationForEmail>[1],
) {
  const issued = await issueInvitationForEmail(ownerClient, input);
  const invitationId = queryLocalSql(
    `select invitation.id::text
     from public.organisation_invitations invitation
     where invitation.canonical_recipient = lower(:'email')
       and invitation.status = 'pending'
     order by invitation.created_at desc
     limit 1;`,
    { email: input.email },
    new Set(),
  )[0];

  if (!invitationId) {
    throw new Error("Issued invitation row was not found for delivered proof.");
  }

  assertUuid(invitationId);
  const inboxProof = randomBytes(32).toString("base64url");
  const { data: deliveryId, error: registerError } = await ownerClient.rpc(
    "register_organisation_invitation_delivery",
    {
      target_invitation_id: invitationId,
      target_inbox_proof_digest: invitationInboxProofDigest(inboxProof),
    },
  );
  if (registerError || !deliveryId) {
    throw (
      registerError ??
      new Error("register_organisation_invitation_delivery failed")
    );
  }

  const { url, serviceRoleKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase URL and service role key are required for delivery dispatch.",
    );
  }

  await dispatchOrganisationInvitationDeliveryForE2e({
    supabaseUrl: url,
    serviceRoleKey,
    deliveryId,
    invitationToken: issued.token,
    inboxProof,
  });

  const activateEmailPath = await fetchLatestEmailHrefWithRetry(
    input.email,
    `/invitations/${issued.token}/activate`,
  );

  return {
    ...issued,
    invitationId,
    inboxProof,
    activateEmailPath,
  };
}

export async function createAccountThroughInvitationEmail(
  page: import("@playwright/test").Page,
  input: {
    activateEmailPath: string;
    password: string;
  },
) {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await page.goto(
    input.activateEmailPath.startsWith("http")
      ? input.activateEmailPath
      : `${origin}${input.activateEmailPath}`,
  );
  await page.waitForURL(/\/invitations\/[A-Za-z0-9_-]+\/activate/, {
    timeout: 30_000,
  });
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).some(
          (cookie) => cookie.name === "leh_invitation_inbox_proof",
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
  await page.locator("#password").fill(input.password);
  await page.locator("#confirm-password").fill(input.password);
  await page
    .getByRole("button", { name: "Create account and continue" })
    .click();
  await expect(page).toHaveURL(/\/invitations\/continue\/[0-9a-f-]{36}$/i, {
    timeout: 30_000,
  });
}

export async function prefetchInvitationActivateUrl(activateEmailPath: string) {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  const url = activateEmailPath.startsWith("http")
    ? activateEmailPath
    : `${origin}${activateEmailPath}`;
  let current = url;
  for (let hop = 0; hop < 6; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    if (response.status < 300 || response.status >= 400) {
      return;
    }
    const location = response.headers.get("location");
    if (!location) {
      return;
    }
    current = new URL(location, current).toString();
  }
}

export async function revokeOrganisationInvitationForE2e(
  ownerClient: SupabaseClient,
  input: { organisationId: string; invitationId: string },
) {
  const { error } = await ownerClient.rpc("revoke_organisation_invitation", {
    target_organisation_id: input.organisationId,
    target_invitation_id: input.invitationId,
    change_reason: "E2E activation race revocation",
  });
  if (error) {
    throw error;
  }
}

export function invitationInboxProofRedeemedForDelivery(invitationId: string) {
  const rows = queryLocalSql(
    `select delivery.inbox_proof_redeemed_at is not null as redeemed
     from private.organisation_invitation_deliveries delivery
     where delivery.invitation_id = (:'invitation_id')::uuid
       and delivery.cancelled_at is null
     order by delivery.created_at desc
     limit 1;`,
    { invitation_id: invitationId },
    new Set(["invitation_id"]),
  );
  return rows[0] === "t";
}

export async function countEmailsToRecipient(email: string) {
  const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  if (!response.ok) {
    return 0;
  }
  const payload = (await response.json()) as {
    messages?: Array<{ To?: Array<{ Address: string }> }>;
  };
  return (payload.messages ?? []).filter((entry) =>
    entry.To?.some((recipient) => recipient.Address === email),
  ).length;
}

export function expireInvitationSignupBinding(bindingId: string) {
  runLocalSql(
    `update public.organisation_invitation_signup_bindings
       set created_at = statement_timestamp() - interval '3 hours',
           expires_at = statement_timestamp() - interval '1 minute'
     where id = (:'binding_id')::uuid;`,
    { binding_id: bindingId },
  );
}

export function clearSyntheticEmailConfirmation(userId: string) {
  runLocalSql(
    `update auth.users
       set email_confirmed_at = null
     where id = (:'user_id')::uuid;`,
    { user_id: userId },
  );
}

export function expireOrganisationInvitationForBinding(bindingId: string) {
  runLocalSql(
    `update public.organisation_invitations invitation
       set status = 'expired',
           expired_at = statement_timestamp()
     where invitation.id = (
       select binding.invitation_id
       from public.organisation_invitation_signup_bindings binding
       where binding.id = (:'binding_id')::uuid
     )
       and invitation.status = 'pending';`,
    { binding_id: bindingId },
  );
}

export function listActiveMembershipGrantCounts(userId: string) {
  return queryLocalSql(
    `select membership.id::text || '|' || count(grant_row.id)::text
     from public.organisation_memberships membership
     left join public.access_grants grant_row
       on grant_row.grantee_membership_id = membership.id
     where membership.user_id = (:'user_id')::uuid
       and membership.status = 'active'
     group by membership.id;`,
    { user_id: userId },
  ).map((line) => {
    const [membershipId, grantCount] = line.split("|");
    return {
      membershipId: membershipId ?? "",
      grantCount: Number(grantCount),
    };
  });
}

export function readSuggestionsInvitationFixture(organisationId: string) {
  const roleVersionId = queryLocalSql(
    `select role_version.id::text
     from public.roles role_row
     join public.role_versions role_version
       on role_version.organisation_id = role_row.organisation_id
      and role_version.role_id = role_row.id
     where role_row.organisation_id = (:'organisation_id')::uuid
       and role_row.canonical_name = 'responsibility-suggestions'
       and role_row.status = 'active'
       and role_version.status = 'published'
     limit 1;`,
    { organisation_id: organisationId },
  )[0];
  const invitedUnitId = queryLocalSql(
    `select unit.id::text
     from public.organisation_units unit
     where unit.organisation_id = (:'organisation_id')::uuid
       and unit.code = 'e2e-root'
       and unit.status = 'active'
     limit 1;`,
    { organisation_id: organisationId },
  )[0];

  if (!roleVersionId || !invitedUnitId) {
    throw new Error("Suggestions invitation fixture was not available.");
  }

  return { roleVersionId, invitedUnitId };
}

export function readMembershipProvisioning(input: {
  userId: string;
  organisationId: string;
  jobFunctionId: string;
  unitId: string;
}) {
  const row = queryLocalSql(
    `select membership.display_name || '|' || count(assignment.id)::text
     from public.organisation_memberships membership
     left join public.membership_job_function_assignments assignment
       on assignment.membership_id = membership.id
      and assignment.job_function_id = (:'job_function_id')::uuid
      and assignment.organisational_unit_id = (:'unit_id')::uuid
     where membership.user_id = (:'user_id')::uuid
       and membership.organisation_id = (:'organisation_id')::uuid
       and membership.status = 'active'
     group by membership.display_name;`,
    {
      user_id: input.userId,
      organisation_id: input.organisationId,
      job_function_id: input.jobFunctionId,
      unit_id: input.unitId,
    },
  )[0];
  if (!row) {
    return null;
  }
  const separator = row.lastIndexOf("|");
  return {
    displayName: row.slice(0, separator),
    assignmentCount: Number(row.slice(separator + 1)),
  };
}

export async function fetchInvitationSignupBindingForEmail(email: string) {
  const { admin } = getInvitationLifecycleClients();
  const user = await findAuthUserByEmail(admin, email);
  const bindingId = user?.user_metadata?.invitation_signup_binding;
  if (typeof bindingId !== "string") {
    throw new Error(`No invitation signup binding found for ${email}`);
  }
  return bindingId;
}
