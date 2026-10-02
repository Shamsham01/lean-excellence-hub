import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export type LeanAiContextE2eUser = {
  email: string;
  password: string;
  userId: string;
  organisationAName: string;
  organisationBName: string;
  organisationACode: string;
  organisationBCode: string;
};

export function resolveSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && serviceRoleKey && publishableKey) {
    return { url, serviceRoleKey, publishableKey };
  }

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
}

export async function provisionLeanAiContextE2eUser(): Promise<LeanAiContextE2eUser> {
  const { url, serviceRoleKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase URL and service role key are required");
  }

  const suffix = Date.now().toString(36);
  const user: LeanAiContextE2eUser = {
    email: `leanai-context-${suffix}@example.test`,
    password: "LeanAiContextE2ePassword123!",
    userId: randomUUID(),
    organisationAName: `LeanAI Context A ${suffix}`,
    organisationBName: `LeanAI Context B ${suffix}`,
    organisationACode: `leanai-a-${suffix}`.slice(0, 32),
    organisationBCode: `leanai-b-${suffix}`.slice(0, 32),
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

  const orgA = await admin.rpc("provision_organisation", {
    owner_user_id: user.userId,
    organisation_code: user.organisationACode,
    organisation_name: user.organisationAName,
  });
  if (orgA.error) {
    throw orgA.error;
  }

  const orgB = await admin.rpc("provision_organisation", {
    owner_user_id: user.userId,
    organisation_code: user.organisationBCode,
    organisation_name: user.organisationBName,
  });
  if (orgB.error) {
    throw orgB.error;
  }

  return user;
}

export async function loginAndSelectOrganisation(
  page: Page,
  user: LeanAiContextE2eUser,
  organisationName: string,
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(platform|select-organisation)(?:\?|$)/, {
    timeout: 30_000,
  });

  if (page.url().includes("/select-organisation")) {
    await page.getByRole("button", { name: organisationName }).click();
  }

  await expect(page).toHaveURL(/\/platform(?:\?|$)/, { timeout: 30_000 });
}

export async function ensureLeanAiAssistantOpen(page: Page) {
  const pane = page.getByTestId("leanai-assistant-pane");
  const openButton = page.getByTestId("leanai-assistant-open");
  await expect(pane.or(openButton).first()).toBeVisible({ timeout: 15_000 });
  if (await pane.isVisible().catch(() => false)) {
    return pane;
  }
  await openButton.click();
  await expect(pane).toBeVisible();
  return pane;
}
