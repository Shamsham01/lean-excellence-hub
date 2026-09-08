import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { QA_USER_IDS, QA_USERS } from "../constants";

export type QaUserKey = keyof typeof QA_USERS;

export type QaAuthIdentity = {
  id: string;
  email: string;
  password: string;
  displayName: string;
};

export async function expectRpc(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`RPC ${fn} failed: ${error.message}`);
  }
  return data;
}

export async function ensureAuthIdentity(
  admin: SupabaseClient,
  user: QaAuthIdentity,
) {
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

export async function ensureAuthUser(
  admin: SupabaseClient,
  userKey: QaUserKey,
) {
  await ensureAuthIdentity(admin, QA_USERS[userKey]);
}

export async function signInIdentity(
  apiUrl: string,
  publishableKey: string,
  user: Pick<QaAuthIdentity, "email" | "password">,
) {
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

export async function signInUser(
  apiUrl: string,
  publishableKey: string,
  userKey: QaUserKey,
) {
  return signInIdentity(apiUrl, publishableKey, QA_USERS[userKey]);
}

export async function deleteAuthIdentities(
  admin: SupabaseClient,
  userIds: readonly string[],
) {
  for (const userId of userIds) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error && deleted.error.status !== 404) {
      throw deleted.error;
    }
  }
}

export async function deleteQaAuthUsers(admin: SupabaseClient) {
  await deleteAuthIdentities(admin, QA_USER_IDS);
}
