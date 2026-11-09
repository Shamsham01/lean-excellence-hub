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

export async function loginAsExistingFoundingUser(
  page: Page,
  user: FoundingE2eUser,
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/platform(?:\?|$)|\/select-organisation/, {
    timeout: 30_000,
  });
}

export async function completeFoundingCheckout(
  page: Page,
  user: FoundingE2eUser,
  siteQuantity = 1,
  multiSiteIntent: "yes" | "no" | "not_sure" = "not_sure",
  plan: "Essentials" | "Professional" = "Professional",
) {
  await expect(page.getByTestId("create-organisation-page")).toBeVisible();
  await page.getByLabel("Organisation name").fill(user.organisationName);
  await page.getByLabel("First site").fill(user.firstSiteName);
  const intentLabel =
    multiSiteIntent === "yes"
      ? "Yes, part of a wider multi-site organisation"
      : multiSiteIntent === "no"
        ? "No, this is a single-site organisation"
        : "Not sure yet";
  await page.getByLabel(intentLabel).check();
  await page.getByLabel("Paid site quantity").fill(String(siteQuantity));
  await page.getByRole("button", { name: "Continue to plan" }).click();

  await expect(page).toHaveURL(/\/onboarding(?:\?|$)/);
  await expect(page.getByTestId("onboarding-plan")).toBeVisible();
  await page.getByRole("radio", { name: new RegExp(plan, "i") }).check();
  await page.getByRole("button", { name: "Continue to Checkout" }).click();

  await expect(page.getByTestId("onboarding-wait")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Complete sandbox payment" }).click();
  await expect(page.getByTestId("onboarding-setup")).toBeVisible({
    timeout: 30_000,
  });
}

export { completeStructureFirstSetupToPlatform } from "./structure-first-onboarding";

type E2eSubscriptionRow = {
  organisation_id: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan_code: string | null;
  billing_interval: string | null;
  site_quantity: number | null;
  provider_price_id: string | null;
};

function loadLatestSubscriptionForOrganisationName(
  organisationName: string,
): E2eSubscriptionRow | null {
  const escaped = organisationName.replace(/'/g, "''");
  const sql = `select subscription.organisation_id, subscription.provider, account.provider_customer_id, subscription.provider_subscription_id, subscription.plan_code, subscription.billing_interval, subscription.site_quantity, subscription.provider_price_id from public.organisation_subscriptions subscription join public.organisations organisation on organisation.id = subscription.organisation_id join public.organisation_billing_accounts account on account.id = subscription.billing_account_id where organisation.name = '${escaped}' order by subscription.updated_at desc nulls last limit 1`;

  try {
    const output = execSync(
      `docker exec supabase_db_lean-excellence-hub psql -U postgres -d postgres -At -F '|' -c ${JSON.stringify(sql)}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    ).trim();
    if (!output) {
      return null;
    }
    const [
      organisation_id,
      provider,
      provider_customer_id,
      provider_subscription_id,
      plan_code,
      billing_interval,
      site_quantity,
      provider_price_id,
    ] = output.split("|");
    if (!organisation_id || !provider) {
      return null;
    }
    return {
      organisation_id,
      provider,
      provider_customer_id: provider_customer_id || null,
      provider_subscription_id: provider_subscription_id || null,
      plan_code: plan_code || null,
      billing_interval: billing_interval || null,
      site_quantity: site_quantity ? Number(site_quantity) : null,
      provider_price_id: provider_price_id || null,
    };
  } catch (cause) {
    throw cause;
  }
}

export async function setOrganisationSubscriptionPlan(
  user: FoundingE2eUser,
  planCode: "essentials" | "professional",
  billingState: "active" | "trialing" = "active",
) {
  const { url, serviceRoleKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service role is required to adjust billing state",
    );
  }

  const subscription = loadLatestSubscriptionForOrganisationName(
    user.organisationName,
  );
  if (!subscription) {
    throw new Error("Subscription row was not found for the founding user");
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const periodEnd = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const applied = await admin.rpc("apply_organisation_subscription_snapshot", {
    target_organisation_id: subscription.organisation_id,
    target_provider: subscription.provider,
    target_customer_id: subscription.provider_customer_id ?? "",
    target_subscription_id: subscription.provider_subscription_id ?? "",
    target_plan_code: planCode,
    target_billing_interval: subscription.billing_interval ?? "monthly",
    target_site_quantity: subscription.site_quantity ?? 1,
    target_price_id:
      subscription.provider_price_id ?? `price_fake_${planCode}_monthly`,
    target_provider_status:
      billingState === "trialing" ? "trialing" : "active",
    target_billing_state: billingState,
    target_current_period_start: new Date().toISOString(),
    target_current_period_end: periodEnd,
    target_cancel_at_period_end: false,
    target_event_at: new Date().toISOString(),
  });

  if (applied.error) {
    throw applied.error;
  }
}

export async function setOrganisationSubscriptionTrialing(user: FoundingE2eUser) {
  await setOrganisationSubscriptionPlan(user, "essentials", "trialing");
}

export function loadFoundingOrganisationId(user: FoundingE2eUser): string {
  const subscription = loadLatestSubscriptionForOrganisationName(
    user.organisationName,
  );
  if (!subscription?.organisation_id) {
    throw new Error("Organisation id was not found for the founding user");
  }
  return subscription.organisation_id;
}
