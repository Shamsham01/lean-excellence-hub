import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

import { invitationExpiresAt } from "@/modules/identity/invitation-constants";

import {
  completeStructureFirstSetupToPlatform,
  loginAsFoundingUser,
  type FoundingE2eUser,
} from "./founding-onboarding";

const e2eOrigin = "http://127.0.0.1:3000";

function invitationTokenDigest(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

export function resolveSupabaseEnv() {
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

export function trackRuntimeErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return () => {
    expect(
      pageErrors,
      pageErrors.length > 0
        ? `Unexpected page errors:\n${pageErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
    expect(
      consoleErrors,
      consoleErrors.length > 0
        ? `Unexpected console.error:\n${consoleErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
  };
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function visitModule(
  page: Page,
  path: string,
  assert: () => Promise<void>,
) {
  await page.goto(path);
  await assert();
  await expectNoHorizontalOverflow(page);
}

export async function createFoundingOwnerClient(
  user: FoundingE2eUser,
): Promise<SupabaseClient> {
  const { url, publishableKey } = resolveSupabaseEnv();
  if (!url || !publishableKey) {
    throw new Error("Supabase env required for founding owner client");
  }

  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (signedIn.error) {
    throw signedIn.error;
  }

  const organisations = await client.rpc("list_my_eligible_organisations");
  if (organisations.error) {
    throw organisations.error;
  }

  const match = (
    organisations.data as Array<{
      organisation_id: string;
      organisation_name: string;
    }>
  ).find((row) => row.organisation_name === user.organisationName);

  if (!match?.organisation_id) {
    throw new Error(`Organisation ${user.organisationName} was not listed`);
  }

  const switched = await client.rpc("switch_organisation", {
    target_organisation_id: match.organisation_id,
  });
  if (switched.error) {
    throw switched.error;
  }

  return client;
}

export async function issueInvitationForFoundingOwner(
  ownerClient: SupabaseClient,
  input: { email: string; tokenSeed: string; displayName?: string },
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
  const offer =
    offerList?.find((entry) => entry.role_key === "team_member") ??
    offerList?.[0];

  if (!offer?.role_version_id) {
    throw new Error("No delegatable offer for colleague invitation");
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
      invitation_expires_at: invitationExpiresAt(),
      offered_role_version_id: offer.role_version_id,
      offered_scope_type: scope?.scope_type ?? "organisation",
      ...((scope?.scope_unit_id
        ? { offered_scope_unit_id: scope.scope_unit_id }
        : {}) as Record<string, string>),
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

function toE2eOriginUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const parsed = new URL(pathOrUrl);
    return `${e2eOrigin}${parsed.pathname}${parsed.search}`;
  }
  return `${e2eOrigin}${pathOrUrl}`;
}

export async function acceptInvitationAsNewColleague(
  browser: import("@playwright/test").Browser,
  input: {
    invitationPath: string;
    email: string;
    password: string;
  },
) {
  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();

  await inviteePage.goto(toE2eOriginUrl(input.invitationPath));
  await expect(inviteePage.getByTestId("invitation-page")).toBeVisible();
  await inviteePage.getByRole("link", { name: "Create my account" }).click();
  await inviteePage.locator("#password").fill(input.password);
  await inviteePage.locator("#confirm-password").fill(input.password);
  await inviteePage
    .getByRole("button", { name: "Create account and continue" })
    .click();

  await expect(
    inviteePage.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible({ timeout: 30_000 });

  const { fetchLatestEmailHrefWithRetry } = await import("./mailpit");
  const confirmationUrl = toE2eOriginUrl(
    await fetchLatestEmailHrefWithRetry(input.email, "/auth/confirm"),
  );

  await inviteePage.goto(confirmationUrl);
  await expect(inviteePage).toHaveURL(/\/confirm\?continue=true$/);
  const confirmationResponse = inviteePage.waitForResponse(
    (response) =>
      response.url().includes("/auth/confirm") &&
      response.request().method() === "POST",
  );
  await inviteePage
    .getByRole("button", { name: "Confirm email and continue" })
    .click();
  await confirmationResponse;

  await expect(inviteePage).toHaveURL(
    /\/invitations\/continue\/[0-9a-f-]{36}$/i,
    { timeout: 30_000 },
  );
  await inviteePage.getByRole("button", { name: "Accept invitation" }).click();
  await expect(inviteePage).toHaveURL(/\/platform/, { timeout: 30_000 });
  await inviteeContext.close();
}

export async function fillFoundingOrganisationWithLocale(
  page: Page,
  user: FoundingE2eUser,
) {
  await expect(page.getByTestId("create-organisation-page")).toBeVisible();
  await page.getByLabel("Organisation name").fill(user.organisationName);
  await page.getByLabel("First site").fill(user.firstSiteName);
  await page.getByLabel("Not sure yet").check();
  await page.getByLabel("Paid site quantity").fill("1");
  await page.getByText("Country, locale and reporting details").click();
  await expect(page.locator("#countryCode")).toHaveValue("GB");
  await expect(page.locator("#locale")).toHaveValue("en-GB");
  await page.locator("#timeZone").fill("Europe/London");
  await expect(page.locator("#reportingCurrency")).toHaveValue("GBP");
  await page.getByRole("button", { name: "Continue to plan" }).click();
}

export async function completeFoundingPlanAndSandboxPayment(page: Page) {
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

export async function onboardFoundingOrganisationToPlatform(
  page: Page,
  user: FoundingE2eUser,
) {
  await loginAsFoundingUser(page, user);
  await fillFoundingOrganisationWithLocale(page, user);
  await completeFoundingPlanAndSandboxPayment(page);
  await completeStructureFirstSetupToPlatform(page);
  await expect(page.getByTestId("setup-page")).toBeVisible();
  await page.goto("/platform");
  await expect(page.getByTestId("platform-home-page")).toBeVisible();
}

export async function bootstrapSuggestionProgramme(page: Page) {
  const programmeName = `CI Ideas ${Date.now().toString(36)}`;
  await page.goto("/platform/suggestions/programmes");
  await expect(page.getByTestId("suggestion-programmes-page")).toBeVisible();
  await page.getByTestId("new-programme-button").click();
  await expect(page.getByTestId("programme-create-panel")).toBeVisible();
  await page.locator("#programme-name").fill(programmeName);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("Programme draft created.")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("new-category-button").click();
  await expect(page.getByTestId("category-create-panel")).toBeVisible();
  await page.locator("#category-name").fill("General improvement");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("Category created.")).toBeVisible({
    timeout: 30_000,
  });
}

export async function deployFiveSQuickStartDraft(page: Page) {
  await page.goto("/platform/5s");
  await page.getByRole("link", { name: "Set up 5S" }).click();
  await expect(page.getByTestId("module-setup-chooser")).toBeVisible();
  await page.getByTestId("module-setup-mode-quick-start").click();
  await page.getByTestId("applicable-unit-checkbox").first().check();
  await page.getByTestId("module-setup-deploy").click();
  await expect(page.getByTestId("five-s-draft-boundary")).toBeVisible({
    timeout: 30_000,
  });
}
