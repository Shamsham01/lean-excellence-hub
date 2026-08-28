import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

export const onboardingE2eCredentials = {
  email: "onboarding-e2e@example.test",
  password: "OnboardingE2ePassword123!",
  organisationName: "Onboarding E2E Organisation",
  organisationCode: "onboarding-e2e",
  userId: "e2e00000-0000-0000-0000-000000000002",
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

export async function ensureOnboardingE2eOrganisation() {
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
    onboardingE2eCredentials.userId,
  );

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: onboardingE2eCredentials.userId,
      email: onboardingE2eCredentials.email,
      password: onboardingE2eCredentials.password,
      email_confirm: true,
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  }

  const { error: provisionError } = await admin.rpc("provision_organisation", {
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

  const { data: organisation } = await admin
    .from("organisations")
    .select("id")
    .eq("code", onboardingE2eCredentials.organisationCode)
    .maybeSingle();

  if (organisation?.id) {
    await admin
      .from("organisation_units")
      .delete()
      .eq("organisation_id", organisation.id);
  }
}
