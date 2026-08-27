import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

export const platformE2eCredentials = {
  email: "platform-e2e@example.test",
  password: "PlatformE2ePassword123!",
  organisationName: "Platform E2E Organisation",
  userId: "e2e00000-0000-0000-0000-000000000001",
} as const;

function resolveSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (url && serviceRoleKey) {
    return { url, serviceRoleKey };
  }

  if (process.env.E2E_WITH_SUPABASE !== "1") {
    return { url, serviceRoleKey };
  }

  try {
    const output = execSync("npx supabase status -o json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const status = JSON.parse(output) as {
      API_URL?: string;
      SERVICE_ROLE_KEY?: string;
    };

    return {
      url: url ?? status.API_URL,
      serviceRoleKey: serviceRoleKey ?? status.SERVICE_ROLE_KEY,
    };
  } catch {
    return { url, serviceRoleKey };
  }
}

export async function ensurePlatformE2eUser() {
  const { url, serviceRoleKey } = resolveSupabaseEnv();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase URL and service role key are required for E2E auth",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await admin.auth.admin.getUserById(
    platformE2eCredentials.userId,
  );

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: platformE2eCredentials.userId,
      email: platformE2eCredentials.email,
      password: platformE2eCredentials.password,
      email_confirm: true,
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  }

  const { error: provisionError } = await admin.rpc("provision_organisation", {
    owner_user_id: platformE2eCredentials.userId,
    organisation_code: "platform-e2e",
    organisation_name: platformE2eCredentials.organisationName,
  });

  if (
    provisionError &&
    !provisionError.message.includes("duplicate key value")
  ) {
    throw provisionError;
  }
}
