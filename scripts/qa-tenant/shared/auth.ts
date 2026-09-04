import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { QA_USER_IDS, QA_USERS } from "../constants";

export type QaUserKey = keyof typeof QA_USERS;

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

export async function ensureAuthUser(
  admin: SupabaseClient,
  userKey: QaUserKey,
) {
  const user = QA_USERS[userKey];
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

export async function signInUser(
  apiUrl: string,
  publishableKey: string,
  userKey: QaUserKey,
) {
  const user = QA_USERS[userKey];
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

export async function deleteQaAuthUsers(admin: SupabaseClient) {
  for (const userId of QA_USER_IDS) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error && deleted.error.status !== 404) {
      throw deleted.error;
    }
  }
}
