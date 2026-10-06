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

export async function completeFoundingCheckout(
  page: Page,
  user: FoundingE2eUser,
  siteQuantity = 1,
) {
  await expect(page.getByTestId("create-organisation-page")).toBeVisible();
  await page.getByLabel("Organisation name").fill(user.organisationName);
  await page.getByLabel("First site").fill(user.firstSiteName);
  await page.getByLabel("Paid site quantity").fill(String(siteQuantity));
  await page.getByRole("button", { name: "Continue to plan" }).click();

  await expect(page).toHaveURL(/\/onboarding(?:\?|$)/);
  await expect(page.getByTestId("onboarding-plan")).toBeVisible();
  await page.getByRole("radio", { name: /Professional/ }).check();
  await page.getByRole("button", { name: "Continue to Checkout" }).click();

  await expect(page.getByTestId("onboarding-wait")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Complete sandbox payment" }).click();
  await expect(page.getByTestId("onboarding-setup")).toBeVisible({
    timeout: 30_000,
  });
}

export async function completeStructureFirstSetupToPlatform(page: Page) {
  await page.getByTestId("structure-first-continue-context").click();
  await expect(
    page.getByTestId("structure-first-structure-step"),
  ).toBeVisible();
  await page.getByTestId("structure-first-start-simple").click();
  await expect(
    page.getByTestId("structure-first-job-functions-step"),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("structure-first-skip-job-functions").click();
  await expect(page.getByTestId("structure-first-people-step")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("structure-first-skip-people").click();
  await expect(
    page.getByTestId("structure-first-readiness-step"),
  ).toBeVisible();
  await page.getByTestId("structure-first-continue-setup").click();
  await expect(page).toHaveURL(/\/platform\/setup(?:\?|$)/, {
    timeout: 30_000,
  });
}
