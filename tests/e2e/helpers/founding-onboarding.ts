import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export type FoundingE2eUser = {
  email: string;
  password: string;
  organisationName: string;
  firstSiteName: string;
  userId: string;
};

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

export async function provisionFoundingE2eUser(): Promise<FoundingE2eUser> {
  const { url, serviceRoleKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase URL and service role key are required for founding E2E auth",
    );
  }

  const suffix = Date.now().toString(36);
  const user: FoundingE2eUser = {
    email: `founding-e2e-${suffix}@example.test`,
    password: "FoundingE2ePassword123!",
    organisationName: `Founding E2E ${suffix}`,
    firstSiteName: `Founding Site ${suffix}`,
    userId: randomUUID(),
  };

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created = await admin.auth.admin.createUser({
    id: user.userId,
    email: user.email,
    password: user.password,
    email_confirm: true,
  });

  if (created.error) {
    throw created.error;
  }

  const enrolment = await admin.rpc("finalise_identity_enrolment", {
    target_user_id: user.userId,
  });
  if (enrolment.error) {
    throw enrolment.error;
  }

  const binding = await admin.rpc("prepare_founding_signup_binding", {
    target_email: user.email,
  });
  if (binding.error || !binding.data) {
    throw binding.error ?? new Error("Founding signup binding was not created");
  }

  const founding = await admin.rpc("finalise_founding_signup", {
    target_binding_id: binding.data,
    target_user_id: user.userId,
  });
  if (founding.error || founding.data !== true) {
    throw founding.error ?? new Error("Founding signup was not finalised");
  }

  return user;
}

export async function loginAsFoundingUser(page: Page, user: FoundingE2eUser) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/create-organisation(?:\?|$)/, {
    timeout: 30_000,
  });
}
