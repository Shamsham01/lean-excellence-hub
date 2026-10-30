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
  clearSyntheticEmailConfirmation,
  expireInvitationSignupBinding,
  expireOrganisationInvitationForBinding,
  fetchLatestConfirmationPath,
  getInvitationLifecycleClients,
  invitationLifecycleCredentials,
  issueInvitationForEmail,
  attemptDirectSignupForEmail,
  fetchInvitationSignupBindingForEmail,
  listActiveMembershipGrantCounts,
  readMembershipProvisioning,
  readSuggestionsInvitationFixture,
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

async function confirmEmailFromLink(
  page: import("@playwright/test").Page,
  confirmationUrl: string,
) {
  await page.goto(confirmationUrl);
  await expect(page).toHaveURL(/\/confirm\?continue=true$/);
  expect(page.url()).not.toContain("token_hash=");
  await expect(page.getByTestId("confirm-staged")).toBeVisible();
  const confirmationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/confirm") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Confirm email and continue" })
    .click();
  const response = await confirmationResponse;
  const headers = await response.headersArray();
  const setCookie = headers
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value)
    .join("\n");
  expect(setCookie).toMatch(/auth-token/i);
  expect(response.headers().location ?? page.url()).not.toContain(
    "token_hash=",
  );
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("auth-token"))).toBe(
    true,
  );
}

async function prefetchConfirmationWithoutCookies(confirmationUrl: string) {
  let current = confirmationUrl;
  for (let hop = 0; hop < 6; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    if (response.status < 300 || response.status >= 400) {
      return;
    }
    const location = response.headers.get("location");
    if (!location) {
      return;
    }
    current = new URL(location, current).toString();
  }
}

async function syntheticUser(email: string) {
  const { admin } = getInvitationLifecycleClients();
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return listed.data.users.find((user) => user.email === email) ?? null;
}

async function signUpForInvitation(
  browser: import("@playwright/test").Browser,
  input: { email: string; password: string; tokenSeed: string },
) {
  const { url, publishableKey } = getInvitationLifecycleClients();
  const adminClient = await createOnboardingOrgAdminClient(url, publishableKey);
  const issued = await issueInvitationForEmail(adminClient, {
    email: input.email,
    tokenSeed: input.tokenSeed,
    displayName: "Continuation Employee",
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(toE2eOriginUrl(issued.invitationPath));
  await page.getByRole("link", { name: "Create my account" }).click();
  await page.locator("#password").fill(input.password);
  await page.locator("#confirm-password").fill(input.password);
  await page
    .getByRole("button", { name: "Create account and continue" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible();
  return {
    context,
    page,
    confirmationUrl: toE2eOriginUrl(
      await fetchLatestConfirmationPath(input.email),
    ),
  };
}

async function loginWithPassword(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Email sign in" }).click();
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
    await confirmEmailFromLink(inviteePage, confirmationUrl);
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
    await confirmEmailFromLink(confirmationPage, confirmationUrl);

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
    await confirmEmailFromLink(confirmationPage, confirmationUrl);

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
    await Promise.all([
      page.waitForURL(new RegExp(`${escapeRegExp(invitationPath)}$`), {
        timeout: 30_000,
      }),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await Promise.all([
      page.waitForURL(/\/platform/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Accept invitation" }).click(),
    ]);
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
    await page.getByRole("button", { name: "Create invitation" }).click();
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
    await expect(page.getByText("Invitation revoked.")).toBeVisible();

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
    await page.getByRole("button", { name: "Create invitation" }).click();
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

  test("scenario 8: a cookie-less prefetch does not consume the confirmation link", async ({
    browser,
  }) => {
    const email = `invitation-prefetch-${Date.now()}@example.test`;
    const password = "InvitationPrefetch123!";
    const signup = await signUpForInvitation(browser, {
      email,
      password,
      tokenSeed: `prefetch-${Date.now()}`,
    });

    await prefetchConfirmationWithoutCookies(signup.confirmationUrl);
    const beforeHuman = await syntheticUser(email);
    expect(beforeHuman?.email_confirmed_at ?? null).toBeNull();

    const humanContext = await browser.newContext();
    const humanPage = await humanContext.newPage();
    await confirmEmailFromLink(humanPage, signup.confirmationUrl);
    await expect(humanPage).toHaveURL(
      /\/invitations\/continue\/[0-9a-f-]{36}$/i,
    );
    await humanPage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(humanPage).toHaveURL(/\/platform/);

    await humanContext.close();
    await signup.context.close();
  });

  test("scenario 9: sign-in recovers a valid invitation after the session is lost", async ({
    browser,
  }) => {
    const email = `invitation-lost-session-${Date.now()}@example.test`;
    const password = "InvitationLostSession123!";
    const signup = await signUpForInvitation(browser, {
      email,
      password,
      tokenSeed: `lost-session-${Date.now()}`,
    });
    await confirmEmailFromLink(signup.page, signup.confirmationUrl);
    const continueUrl = signup.page.url();
    await signup.page.request.post("/auth/signout", {
      form: { next: "/login" },
    });

    const returningContext = await browser.newContext();
    const returningPage = await returningContext.newPage();
    await returningPage.goto(continueUrl);
    await expect(
      returningPage.getByRole("heading", { name: "Sign in to continue" }),
    ).toBeVisible();
    await returningPage.getByTestId("invitation-sign-in").click();
    await expect(returningPage).toHaveURL(/next=%2Finvitations%2Fcontinue%2F/i);
    await returningPage.getByLabel("Email").fill(email);
    await returningPage.getByLabel("Password").fill(password);
    await returningPage.getByRole("button", { name: "Email sign in" }).click();
    await expect(
      returningPage.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await returningPage
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(returningPage).toHaveURL(/\/platform/);

    await returningContext.close();
    await signup.context.close();
  });

  test("scenario 10: a failed password attempt keeps invitation continuation", async ({
    browser,
  }) => {
    const email = `invitation-failed-login-${Date.now()}@example.test`;
    const password = "InvitationFailedLogin123!";
    const signup = await signUpForInvitation(browser, {
      email,
      password,
      tokenSeed: `failed-login-${Date.now()}`,
    });
    await confirmEmailFromLink(signup.page, signup.confirmationUrl);
    const bindingId = await fetchInvitationSignupBindingForEmail(email);
    await signup.page.request.post("/auth/signout", {
      form: { next: "/login" },
    });

    await signup.page.goto(
      `/login?next=${encodeURIComponent(`/invitations/continue/${bindingId}`)}`,
    );
    await signup.page.getByLabel("Email").fill(email);
    await signup.page.getByLabel("Password").fill("WrongPassword123!");
    await signup.page.getByRole("button", { name: "Email sign in" }).click();
    await expect(signup.page).toHaveURL(
      new RegExp(
        `error=invalid&next=${escapeRegExp(encodeURIComponent(`/invitations/continue/${bindingId}`))}`,
      ),
    );

    await signup.page.getByLabel("Email").fill(email);
    await signup.page.getByLabel("Password").fill(password);
    await signup.page.getByRole("button", { name: "Email sign in" }).click();
    await expect(
      signup.page.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await signup.context.close();
  });

  test("scenario 11: an expired signup binding can be continued without extending it", async ({
    browser,
  }) => {
    const email = `invitation-rebind-${Date.now()}@example.test`;
    const password = "InvitationRebind123!";
    const signup = await signUpForInvitation(browser, {
      email,
      password,
      tokenSeed: `rebind-${Date.now()}`,
    });
    await confirmEmailFromLink(signup.page, signup.confirmationUrl);
    const bindingId = await fetchInvitationSignupBindingForEmail(email);
    expireInvitationSignupBinding(bindingId);
    await signup.page.request.post("/auth/signout", {
      form: { next: "/login" },
    });

    await loginWithPassword(signup.page, email, password);
    await expect(
      signup.page.getByRole("heading", { name: "Confirmation window ended" }),
    ).toBeVisible();
    await signup.page
      .getByRole("button", { name: "Continue with this invitation" })
      .click();
    await expect(
      signup.page.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    await signup.page
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(signup.page).toHaveURL(/\/platform/);
    await signup.context.close();
  });

  test("scenario 12: wrong, tampered, expired, and unconfirmed invitations stay blocked", async ({
    browser,
  }) => {
    const email = `invitation-blocked-${Date.now()}@example.test`;
    const password = "InvitationBlocked123!";
    const signup = await signUpForInvitation(browser, {
      email,
      password,
      tokenSeed: `blocked-${Date.now()}`,
    });
    const bindingId = await fetchInvitationSignupBindingForEmail(email);
    await confirmEmailFromLink(signup.page, signup.confirmationUrl);

    await signup.page.goto(
      "/invitations/continue/00000000-0000-4000-8000-000000000099",
    );
    await expect(
      signup.page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(
      signup.page.getByRole("button", { name: "Accept invitation" }),
    ).toHaveCount(0);

    const user = await syntheticUser(email);
    if (!user?.id) {
      throw new Error("Synthetic invitee was not created.");
    }
    clearSyntheticEmailConfirmation(user.id);
    await signup.page.goto(`/invitations/continue/${bindingId}`);
    await expect(
      signup.page.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();
    await expect(
      signup.page.getByRole("button", { name: "Accept invitation" }),
    ).toHaveCount(0);

    expireOrganisationInvitationForBinding(bindingId);
    await signup.page.goto(`/invitations/continue/${bindingId}`);
    await expect(
      signup.page.getByRole("heading", { name: "Invitation expired" }),
    ).toBeVisible();
    await expect(
      signup.page.getByRole("button", {
        name: "Continue with this invitation",
      }),
    ).toHaveCount(0);
    await expect(
      signup.page.getByRole("button", { name: "Accept invitation" }),
    ).toHaveCount(0);

    await signup.page.request.post("/auth/signout", {
      form: { next: "/login" },
    });
    await loginWithPassword(
      signup.page,
      invitationLifecycleCredentials.wrongAccountEmail,
      invitationLifecycleCredentials.wrongAccountPassword,
    );
    await signup.page.goto(`/invitations/continue/${bindingId}`);
    await expect(
      signup.page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(
      signup.page.getByRole("button", { name: "Accept invitation" }),
    ).toHaveCount(0);
    await signup.context.close();
  });

  test("scenario 13: repeated confirmation and acceptance do not duplicate grants", async ({
    browser,
  }) => {
    const email = `invitation-replay-${Date.now()}@example.test`;
    const password = "InvitationReplay123!";
    const signup = await signUpForInvitation(browser, {
      email,
      password,
      tokenSeed: `replay-${Date.now()}`,
    });
    const bindingId = await fetchInvitationSignupBindingForEmail(email);
    await confirmEmailFromLink(signup.page, signup.confirmationUrl);
    await signup.page
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(signup.page).toHaveURL(/\/platform/);

    const { url, publishableKey } = getInvitationLifecycleClients();
    const user = await syntheticUser(email);
    if (!user?.id) {
      throw new Error("Synthetic invitee was not created.");
    }
    const membershipsBefore = listActiveMembershipGrantCounts(user.id);
    expect(membershipsBefore).toHaveLength(1);
    const membershipBefore = membershipsBefore[0];
    if (!membershipBefore) {
      throw new Error("Accepted membership was not created.");
    }

    const invitee = await createAuthenticatedClient(url, publishableKey, {
      email,
      password,
    });
    const replayed = await invitee.rpc(
      "accept_organisation_invitation_signup_binding",
      { target_binding_id: bindingId },
    );
    expect(replayed.error).toBeNull();
    expect(replayed.data).toBe(membershipBefore.membershipId);
    const membershipsAfterAccept = listActiveMembershipGrantCounts(user.id);
    expect(membershipsAfterAccept).toEqual(membershipsBefore);

    const replayContext = await browser.newContext();
    const replayPage = await replayContext.newPage();
    await replayPage.goto(signup.confirmationUrl);
    await replayPage
      .getByRole("button", { name: "Confirm email and continue" })
      .click();
    await expect(replayPage).toHaveURL(/\/login\?error=confirm/);
    expect(listActiveMembershipGrantCounts(user.id)).toEqual(membershipsBefore);

    await replayContext.close();
    await signup.context.close();
  });

  test("scenario 14: suggestions access is limited to the invited site", async ({
    browser,
  }) => {
    const { url, publishableKey } = getInvitationLifecycleClients();
    const owner = await createAuthenticatedClient(
      url,
      publishableKey,
      onboardingE2eCredentials,
    );
    const organisations = await owner.rpc("list_my_eligible_organisations");
    const organisation = organisations.data?.find(
      (entry: { organisation_code: string; organisation_id: string }) =>
        entry.organisation_code === onboardingE2eCredentials.organisationCode,
    );
    if (!organisation?.organisation_id) {
      throw new Error("Onboarding organisation was not available.");
    }
    const organisationId = organisation.organisation_id;
    await owner.rpc("switch_organisation", {
      target_organisation_id: organisationId,
    });

    const { roleVersionId, invitedUnitId } =
      readSuggestionsInvitationFixture(organisationId);
    const otherCode = `e2e-other-${Date.now()}`;
    const createdUnit = await owner.rpc("create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: null,
      unit_code: otherCode,
      unit_name: "E2E Other Site",
      unit_type: "site",
    });
    if (createdUnit.error || !createdUnit.data) {
      throw createdUnit.error ?? new Error("Unable to create the other site.");
    }
    const jobFunction = await owner.rpc("create_job_function", {
      target_name: "Suggestions Operator",
      target_code: `sugg-${Date.now().toString().slice(-6)}`,
    });
    if (jobFunction.error || !jobFunction.data) {
      throw (
        jobFunction.error ?? new Error("Unable to create the job function.")
      );
    }

    const email = `invitation-suggestions-${Date.now()}@example.test`;
    const password = "InvitationSuggestions123!";
    const displayName = "Suggestions Operator";
    const issued = await issueInvitationForEmail(owner, {
      email,
      tokenSeed: `suggestions-${Date.now()}`,
      displayName,
      jobFunctionId: jobFunction.data,
      organisationalUnitId: invitedUnitId,
      roleVersionId,
      scopeType: "unit_subtree",
      scopeUnitId: invitedUnitId,
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(toE2eOriginUrl(issued.invitationPath));
    await page.getByRole("link", { name: "Create my account" }).click();
    await page.locator("#password").fill(password);
    await page.locator("#confirm-password").fill(password);
    await page
      .getByRole("button", { name: "Create account and continue" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();
    await confirmEmailFromLink(
      page,
      toE2eOriginUrl(await fetchLatestConfirmationPath(email)),
    );
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).toHaveURL(/\/platform/);

    const user = await syntheticUser(email);
    if (!user?.id) {
      throw new Error("Synthetic invitee was not created.");
    }
    expect(
      readMembershipProvisioning({
        userId: user.id,
        organisationId,
        jobFunctionId: jobFunction.data,
        unitId: invitedUnitId,
      }),
    ).toEqual({
      displayName,
      assignmentCount: 1,
    });

    const invitee = await createAuthenticatedClient(url, publishableKey, {
      email,
      password,
    });
    await invitee.rpc("switch_organisation", {
      target_organisation_id: organisationId,
    });
    const allowed = [
      "suggestions.read",
      "suggestions.manage",
      "suggestions.review",
    ];
    for (const permission of allowed) {
      const result = await invitee.rpc("has_scoped_permission", {
        target_organisation_id: organisationId,
        target_permission_key: permission,
        target_unit_id: invitedUnitId,
      });
      expect(result.data, permission).toBe(true);
      const otherUnit = await invitee.rpc("has_scoped_permission", {
        target_organisation_id: organisationId,
        target_permission_key: permission,
        target_unit_id: createdUnit.data,
      });
      expect(otherUnit.data, `${permission} other site`).toBe(false);
    }
    const unrelated = await invitee.rpc("has_scoped_permission", {
      target_organisation_id: organisationId,
      target_permission_key: "projects.manage",
      target_unit_id: invitedUnitId,
    });
    expect(unrelated.data).toBe(false);
    const otherOrganisation = await invitee.rpc("has_scoped_permission", {
      target_organisation_id: "00000000-0000-4000-8000-000000000088",
      target_permission_key: "suggestions.read",
      target_unit_id: invitedUnitId,
    });
    expect(otherOrganisation.data).toBe(false);
    await context.close();
  });

  test("scenario 15: founding signup confirmation survives prefetch", async ({
    browser,
  }) => {
    const email = `founding-confirm-${Date.now()}@example.test`;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill("FoundingConfirm123!");
    await page.locator("#confirmPassword").fill("FoundingConfirm123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByTestId("founding-signup-check-email")).toBeVisible();

    const confirmationUrl = toE2eOriginUrl(
      await fetchLatestConfirmationPath(email),
    );
    await prefetchConfirmationWithoutCookies(confirmationUrl);
    const beforeHuman = await syntheticUser(email);
    expect(beforeHuman?.email_confirmed_at ?? null).toBeNull();

    const humanContext = await browser.newContext();
    const humanPage = await humanContext.newPage();
    await confirmEmailFromLink(humanPage, confirmationUrl);
    await expect(humanPage).toHaveURL(/\/create-organisation/);

    await humanContext.close();
    await context.close();
  });
});
