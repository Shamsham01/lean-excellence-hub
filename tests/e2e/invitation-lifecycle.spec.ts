import { expect, test } from "@playwright/test";

import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
  onboardingOrgAdminCredentials,
} from "./helpers/onboarding-auth";
import {
  createAuthenticatedClient,
  createOnboardingOrgAdminClient,
  ensureInvitationLifecycleUser,
  fetchLatestConfirmationPath,
  getInvitationLifecycleClients,
  invitationLifecycleCredentials,
  issueInvitationForEmail,
  attemptDirectSignupForEmail,
  fetchInvitationSignupBindingForEmail,
} from "./helpers/invitation-lifecycle";

const e2eOrigin = "http://127.0.0.1:3000";

function toE2eOriginUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const parsed = new URL(pathOrUrl);
    return `${e2eOrigin}${parsed.pathname}${parsed.search}`;
  }

  return `${e2eOrigin}${pathOrUrl}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function loginAsOrgAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(onboardingOrgAdminCredentials.email);
  await page
    .getByLabel("Password")
    .fill(onboardingOrgAdminCredentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform/);
}

test.describe("Invitation lifecycle", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(!hasSupabaseE2e, "Requires E2E_WITH_SUPABASE=1 and local Supabase");

  test.beforeAll(async () => {
    const { admin } = getInvitationLifecycleClients();
    await ensureOnboardingE2eOrganisation();
    await ensureInvitationLifecycleUser(admin, {
      email: invitationLifecycleCredentials.existingEmployeeEmail,
      password: invitationLifecycleCredentials.existingEmployeePassword,
    });
    await ensureInvitationLifecycleUser(admin, {
      email: invitationLifecycleCredentials.wrongAccountEmail,
      password: invitationLifecycleCredentials.wrongAccountPassword,
    });
    await ensureInvitationLifecycleUser(admin, {
      email: invitationLifecycleCredentials.multiOrgEmail,
      password: invitationLifecycleCredentials.multiOrgPassword,
    });
  });

  test("scenario 1: brand-new employee activates through invitation", async ({
    browser,
  }) => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );

    const uniqueEmail = `invitation-new-${Date.now()}@example.test`;
    const { invitationPath } = await issueInvitationForEmail(adminClient, {
      email: uniqueEmail,
      tokenSeed: `new-employee-${Date.now()}`,
      displayName: "Invitation New Employee",
    });

    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();

    await inviteePage.goto(toE2eOriginUrl(invitationPath));
    await expect(inviteePage.getByTestId("invitation-page")).toBeVisible();
    await expect(
      inviteePage.getByRole("heading", {
        name: /invited to Lean Excellence Hub/i,
      }),
    ).toBeVisible();
    await inviteePage.getByRole("link", { name: "Create my account" }).click();

    await inviteePage.locator("#password").fill("InvitationNewEmployee123!");
    await inviteePage
      .locator("#confirm-password")
      .fill("InvitationNewEmployee123!");
    await inviteePage
      .getByRole("button", { name: "Create account and continue" })
      .click();

    await expect(
      inviteePage.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();

    const confirmationUrl = toE2eOriginUrl(
      await fetchLatestConfirmationPath(uniqueEmail),
    );
    await inviteePage.goto(confirmationUrl);
    await expect(inviteePage).toHaveURL(
      /\/invitations\/continue\/[0-9a-f-]{36}$/i,
    );
    await expect(
      inviteePage.getByTestId("invitation-continue-page"),
    ).toBeVisible();
    await expect(
      inviteePage.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await inviteePage
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(inviteePage).toHaveURL(/\/platform/);

    await inviteeContext.close();
  });

  test("scenario 1B: confirmation in a fresh browser context completes activation", async ({
    browser,
  }) => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );

    const uniqueEmail = `invitation-fresh-${Date.now()}@example.test`;
    const { invitationPath } = await issueInvitationForEmail(adminClient, {
      email: uniqueEmail,
      tokenSeed: `fresh-browser-${Date.now()}`,
      displayName: "Invitation Fresh Browser",
    });

    const activationContext = await browser.newContext();
    const activationPage = await activationContext.newPage();

    await activationPage.goto(toE2eOriginUrl(invitationPath));
    await activationPage
      .getByRole("link", { name: "Create my account" })
      .click();
    await activationPage
      .locator("#password")
      .fill("InvitationFreshBrowser123!");
    await activationPage
      .locator("#confirm-password")
      .fill("InvitationFreshBrowser123!");
    await activationPage
      .getByRole("button", { name: "Create account and continue" })
      .click();
    await expect(
      activationPage.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();

    const confirmationUrl = toE2eOriginUrl(
      await fetchLatestConfirmationPath(uniqueEmail),
    );

    const confirmationContext = await browser.newContext();
    const confirmationPage = await confirmationContext.newPage();
    await confirmationPage.goto(confirmationUrl);

    await expect(confirmationPage).toHaveURL(
      /\/invitations\/continue\/[0-9a-f-]{36}$/i,
    );
    await expect(
      confirmationPage.getByTestId("invitation-continue-page"),
    ).toBeVisible();
    await expect(
      confirmationPage.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await confirmationPage
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(confirmationPage).toHaveURL(/\/platform/);

    await confirmationContext.close();
    await activationContext.close();
  });

  test("scenario 1C: email-only direct signup is rejected without invitation proof", async () => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );

    const targetEmail = `invitation-dos-${Date.now()}@example.test`;
    await issueInvitationForEmail(adminClient, {
      email: targetEmail,
      tokenSeed: `dos-target-${Date.now()}`,
    });

    const directSignup = await attemptDirectSignupForEmail({
      email: targetEmail,
      password: "InvitationDosAttack123!",
    });

    expect(directSignup.error?.message.toLowerCase()).toContain(
      "organisation invitation",
    );
  });

  test("scenario 1D: reissued invitation invalidates in-flight signup binding", async ({
    page,
    browser,
  }) => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );

    const targetEmail = `invitation-reissue-activation-${Date.now()}@example.test`;
    const { invitationPath } = await issueInvitationForEmail(adminClient, {
      email: targetEmail,
      tokenSeed: `reissue-activation-${Date.now()}`,
    });

    const activationContext = await browser.newContext();
    const activationPage = await activationContext.newPage();

    await activationPage.goto(toE2eOriginUrl(invitationPath));
    await activationPage
      .getByRole("link", { name: "Create my account" })
      .click();
    await activationPage.locator("#password").fill("InvitationReissueAct123!");
    await activationPage
      .locator("#confirm-password")
      .fill("InvitationReissueAct123!");
    await activationPage
      .getByRole("button", { name: "Create account and continue" })
      .click();
    await expect(
      activationPage.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();

    const bindingId = await fetchInvitationSignupBindingForEmail(targetEmail);

    await loginAsOrgAdmin(page);
    await page.goto("/platform/settings/people");
    const listItem = page
      .getByTestId("pending-invitations-list")
      .getByText(targetEmail)
      .locator("xpath=ancestor::li[1]");
    await listItem.getByRole("button", { name: "Reissue" }).click();
    await expect(
      page.getByTestId("copy-reissued-invitation-link-button"),
    ).toBeVisible();

    const confirmationUrl = toE2eOriginUrl(
      await fetchLatestConfirmationPath(targetEmail),
    );
    const confirmationContext = await browser.newContext();
    const confirmationPage = await confirmationContext.newPage();
    await confirmationPage.goto(confirmationUrl);

    await expect(confirmationPage).toHaveURL(
      new RegExp(`${escapeRegExp(`/invitations/continue/${bindingId}`)}$`, "i"),
    );
    await expect(
      confirmationPage.getByRole("heading", {
        name: /Invitation unavailable|Invitation no longer active/i,
      }),
    ).toBeVisible();
    await expect(
      confirmationPage.getByRole("button", { name: "Accept invitation" }),
    ).toHaveCount(0);

    await confirmationContext.close();
    await activationContext.close();
  });

  test("scenario 2: existing user signs in and accepts invitation", async ({
    page,
  }) => {
    const { url, publishableKey, admin } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );
    const email = `invitation-existing-${Date.now()}@example.test`;
    const password = invitationLifecycleCredentials.existingEmployeePassword;

    await ensureInvitationLifecycleUser(admin, { email, password });

    const { invitationPath } = await issueInvitationForEmail(adminClient, {
      email,
      tokenSeed: `existing-user-${Date.now()}`,
    });

    await page.goto(toE2eOriginUrl(invitationPath));
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(invitationPath)}$`),
    );
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/platform/);
  });

  test("scenario 3: wrong signed-in account is blocked", async ({ page }) => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );

    const targetEmail = `invitation-wrong-target-${Date.now()}@example.test`;
    const { invitationPath } = await issueInvitationForEmail(adminClient, {
      email: targetEmail,
      tokenSeed: `wrong-account-${Date.now()}`,
    });

    await page.goto("/login");
    await page
      .getByLabel("Email")
      .fill(invitationLifecycleCredentials.wrongAccountEmail);
    await page
      .getByLabel("Password")
      .fill(invitationLifecycleCredentials.wrongAccountPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/no-access|\/platform/);

    await page.goto(toE2eOriginUrl(invitationPath));
    await expect(
      page.getByRole("heading", { name: /Different account signed in/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept invitation" }),
    ).toHaveCount(0);
  });

  test("scenario 4: expired invitation cannot be accepted", async ({
    page,
  }) => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const adminClient = await createOnboardingOrgAdminClient(
      url,
      publishableKey,
    );

    const expiredEmail = `invitation-expired-${Date.now()}@example.test`;
    const { invitationPath } = await issueInvitationForEmail(adminClient, {
      email: expiredEmail,
      tokenSeed: `expired-${Date.now()}`,
      expiresAt: new Date(Date.now() + 1_000).toISOString(),
    });

    await page.waitForTimeout(1_500);
    await page.goto(toE2eOriginUrl(invitationPath));
    await expect(
      page.getByRole("heading", { name: /Invitation expired/i }),
    ).toBeVisible();
  });

  test("scenario 5: revoked invitation cannot be accepted", async ({
    page,
  }) => {
    await loginAsOrgAdmin(page);
    const targetEmail = `invitation-revoked-${Date.now()}@example.test`;
    await page.goto("/platform/settings/people");
    await page.getByLabel("Colleague email").fill(targetEmail);
    await page.locator("#invite-role").selectOption({ index: 1 });
    await page.locator("#invite-scope").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByTestId("copy-invitation-link-button")).toBeVisible();
    const invitationUrl = await page
      .getByText(/Invitation link:/)
      .textContent();
    const invitationPath = new URL(
      invitationUrl?.replace("Invitation link: ", "").trim() ?? "",
    ).pathname;

    await page
      .getByTestId("pending-invitations-list")
      .getByText(targetEmail)
      .locator("xpath=ancestor::li[1]")
      .getByRole("button", { name: "Revoke" })
      .click();

    await page.context().clearCookies();
    await page.goto(toE2eOriginUrl(invitationPath));
    await expect(
      page.getByRole("heading", { name: /Invitation no longer active/i }),
    ).toBeVisible();
  });

  test("scenario 6: reissued invitation invalidates old link", async ({
    page,
  }) => {
    await loginAsOrgAdmin(page);
    const targetEmail = `invitation-reissue-${Date.now()}@example.test`;
    await page.goto("/platform/settings/people");
    await page.getByLabel("Colleague email").fill(targetEmail);
    await page.locator("#invite-role").selectOption({ index: 1 });
    await page.locator("#invite-scope").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Send invitation" }).click();
    const oldInvitationUrl = await page
      .getByText(/Invitation link:/)
      .textContent();
    const oldPath = new URL(
      oldInvitationUrl?.replace("Invitation link: ", "").trim() ?? "",
    ).pathname;

    const listItem = page
      .getByTestId("pending-invitations-list")
      .getByText(targetEmail)
      .locator("xpath=ancestor::li[1]");
    await listItem.getByRole("button", { name: "Reissue" }).click();
    await expect(
      page.getByTestId("copy-reissued-invitation-link-button"),
    ).toBeVisible();
    const newInvitationUrl = await page
      .getByText(/New invitation link:/)
      .textContent();
    const newPath = new URL(
      newInvitationUrl?.replace("New invitation link: ", "").trim() ?? "",
    ).pathname;

    await page.context().clearCookies();
    await page.goto(toE2eOriginUrl(oldPath));
    await expect(
      page.getByRole("heading", { name: /Invitation no longer active/i }),
    ).toBeVisible();

    await page.goto(toE2eOriginUrl(newPath));
    await expect(
      page.getByRole("heading", { name: /invited to Lean Excellence Hub/i }),
    ).toBeVisible();
  });

  test("scenario 7: existing org A member accepts org B invitation", async ({
    page,
  }) => {
    const { url, publishableKey, admin } = getInvitationLifecycleClients();
    const ownerClient = await createAuthenticatedClient(
      url,
      publishableKey,
      onboardingE2eCredentials,
    );

    const { data: orgBId, error: orgBError } = await admin.rpc(
      "provision_organisation",
      {
        owner_user_id: onboardingE2eCredentials.userId,
        organisation_code: `invitation-org-b-${Date.now()}`,
        organisation_name: "Invitation Lifecycle Org B",
      },
    );
    if (orgBError && orgBError.code !== "23505") {
      throw orgBError;
    }

    const multiOrgClient = await createAuthenticatedClient(
      url,
      publishableKey,
      {
        email: invitationLifecycleCredentials.multiOrgEmail,
        password: invitationLifecycleCredentials.multiOrgPassword,
      },
    );

    await ownerClient.rpc("switch_organisation", {
      target_organisation_id: orgBId,
    });

    const { invitationPath } = await issueInvitationForEmail(ownerClient, {
      email: invitationLifecycleCredentials.multiOrgEmail,
      tokenSeed: `multi-org-${Date.now()}`,
    });

    await multiOrgClient.auth.signOut();
    await page.goto(toE2eOriginUrl(invitationPath));
    await page.getByRole("link", { name: "Sign in" }).click();
    await page
      .getByLabel("Password")
      .fill(invitationLifecycleCredentials.multiOrgPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/platform|\/select-organisation/);
  });
});
