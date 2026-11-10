import { expect, test, type Browser, type Page } from "@playwright/test";

import { createActionViaPlannerDialog } from "./helpers/actions-create";
import {
  acceptInvitationAsNewColleague,
  bootstrapSuggestionProgramme,
  createFoundingOwnerClient,
} from "./helpers/clean-org-journey";
import {
  assertModuleWriteDenied,
  BASELINE_ROLE_LABELS_ON_ANY_PLAN,
  colleaguePath,
  enableLeanAiCreditEnforcement,
  exhaustLeanAiCreditAllowance,
  waitForSuggestionApprovalRouting,
  waitForUnreadSuggestionNotification,
  queryMembershipIdForEmail,
  querySuggestionPrimaryApproverMembershipId,
  tightenSuggestionApproverToProductionManager,
  queryJobFunctionIdByCode,
  queryOrganisationUnitIdByName,
  queryPublishedRoleVersionId,
  type GoLiveColleague,
} from "./helpers/customer-go-live-journey";
import {
  completeFoundingCheckout,
  loadFoundingOrganisationId,
  loginAsExistingFoundingUser,
  loginAsFoundingUser,
  provisionFoundingE2eUser,
  setOrganisationSubscriptionPlan,
  type FoundingE2eUser,
} from "./helpers/founding-onboarding";
import {
  attemptDirectSignupForEmail,
  createAccountThroughInvitationEmail,
  expireOrganisationInvitationForBinding,
  fetchInvitationSignupBindingForEmail,
  findAuthUserByEmail,
  getInvitationLifecycleClients,
  issueInvitationWithDeliveredInboxProof,
  prefetchInvitationActivateUrl,
  revokeOrganisationInvitationForE2e,
} from "./helpers/invitation-lifecycle";
import { ensureLeanAiAssistantOpen } from "./helpers/leanai-context";
import { fetchLatestEmailBodies } from "./helpers/mailpit";
import { platformMain } from "./helpers/platform-main";
import {
  approveCurrentReview,
  beginCurrentReview,
  openUnreadSuggestionNotificationReview,
  reviewWorkspace,
} from "./helpers/suggestion-review";
import { completeStructureFirstFoundationSetup } from "./helpers/structure-first-onboarding";
import { scrollPlatformMainViewportForProject } from "./helpers/touch-scroll";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const e2eOrigin = "http://127.0.0.1:3000";

const HEADER =
  "record_type,display_name,email,department,site,role,access_scope_site,parent_site_path,area_name,area_code,unit_type";

function toE2eOriginUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const parsed = new URL(pathOrUrl);
    return `${e2eOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return `${e2eOrigin}${pathOrUrl}`;
}

function notificationBell(page: Page) {
  return page.locator('[data-testid="platform-notification-bell"]:visible');
}

async function loginColleague(page: Page, colleague: GoLiveColleague) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(colleague.email);
  await page.getByLabel("Password").fill(colleague.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/platform/, { timeout: 30_000 });
}

async function acceptColleagueInvitation(
  browser: Browser,
  input: {
    activateEmailPath: string;
    email: string;
    password: string;
    displayName: string;
  },
): Promise<GoLiveColleague> {
  const colleague: GoLiveColleague = {
    email: input.email,
    password: input.password,
    displayName: input.displayName,
  };
  await acceptInvitationAsNewColleague(browser, {
    invitationPath: "",
    activateEmailPath: input.activateEmailPath,
    email: input.email,
    password: input.password,
  });
  return colleague;
}

test.describe("Customer go-live journey (clean organisation)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack with Mailpit",
  );

  let user: FoundingE2eUser;
  let organisationId = "";
  let operationsUnitId = "";
  const operator: GoLiveColleague = {
    email: "",
    password: "GoLiveOperator123!",
    displayName: "Go-live Operator",
  };
  const productionManager: GoLiveColleague = {
    email: "",
    password: "GoLiveProdMgr123!",
    displayName: "Go-live Production Manager",
  };
  const delegateManager: GoLiveColleague = {
    email: "",
    password: "GoLiveDelegate123!",
    displayName: "Go-live Delegate Manager",
  };
  let suggestionTitle = "";
  let suggestionId: string | null = null;
  let projectTitle = "";

  test.beforeAll(async () => {
    user = await provisionFoundingE2eUser();
    const stamp = Date.now();
    operator.email = `go-live-operator-${stamp}@example.test`;
    productionManager.email = `go-live-prod-mgr-${stamp}@example.test`;
    delegateManager.email = `go-live-delegate-${stamp}@example.test`;
    suggestionTitle = `Go-live suggestion ${stamp}`;
    projectTitle = `Go-live project ${stamp}`;
  });

  test("step 1 — founding owner: Essentials foundation (structure, roles, job functions)", async ({
    page,
  }) => {
    await loginAsFoundingUser(page, user);
    await completeFoundingCheckout(page, user, 1, "not_sure", "Essentials");
    await completeStructureFirstFoundationSetup(page, user.firstSiteName);
    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("people-settings-page")).toBeVisible();
    const roleSelect = page.locator("#invite-role");
    const optionLabels = await roleSelect
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => option.textContent?.trim() ?? "")
          .filter((label) => label.length > 0),
      );
    for (const label of BASELINE_ROLE_LABELS_ON_ANY_PLAN) {
      expect(optionLabels.filter((option) => option === label)).toHaveLength(1);
    }

    organisationId = loadFoundingOrganisationId(user);
    operationsUnitId = queryOrganisationUnitIdByName(
      organisationId,
      "Operations",
    );

    await setOrganisationSubscriptionPlan(user, "professional", "active");
    await page.goto("/platform");
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
  });

  test("step 2 — colleague CSV import, single invite, Mailpit branding, invitation guards", async ({
    page,
    browser,
  }) => {
    await loginAsExistingFoundingUser(page, user);
    const csvEmail = `go-live-csv-${Date.now()}@example.test`;
    const path = colleaguePath(user.firstSiteName);
    const csv = [
      HEADER,
      `person,Csv Colleague,${csvEmail},Operator,${path},Team Member,${path},,,,`,
    ].join("\n");

    await page.goto("/platform/settings/people/colleague-import");
    await expect(
      page.getByTestId("people-invitation-import-wizard"),
    ).toBeVisible();
    await page.setInputFiles("input[type='file']", {
      name: "go-live-colleagues.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByTestId("validate-colleague-import").click();
    await page.getByTestId("confirm-colleague-import").click();
    await expect(page.getByText(/Invitations created: 1/)).toBeVisible({
      timeout: 60_000,
    });

    const ownerClient = await createFoundingOwnerClient(user);
    const singleInviteEmail = `go-live-single-${Date.now()}@example.test`;
    const issued = await issueInvitationWithDeliveredInboxProof(ownerClient, {
      email: singleInviteEmail,
      tokenSeed: `go-live-single-${Date.now()}`,
      displayName: "Single Invite Colleague",
    });

    const bodies = await fetchLatestEmailBodies(singleInviteEmail);
    expect(bodies.html).toMatch(/email\/leh-logo\.png|leh-logo/i);
    expect(bodies.text.length).toBeGreaterThan(20);
    expect(bodies.text.toLowerCase()).toContain("lean excellence hub");

    await acceptColleagueInvitation(browser, {
      activateEmailPath: issued.activateEmailPath,
      email: singleInviteEmail,
      password: "GoLiveSingleInvite123!",
      displayName: "Single Invite Colleague",
    });

    const { admin } = getInvitationLifecycleClients();
    const confirmedColleague = await findAuthUserByEmail(
      admin,
      singleInviteEmail,
    );
    expect(confirmedColleague?.email_confirmed_at).toBeTruthy();

    const prefetchEmail = `go-live-prefetch-${Date.now()}@example.test`;
    const prefetchIssued = await issueInvitationWithDeliveredInboxProof(
      ownerClient,
      {
        email: prefetchEmail,
        tokenSeed: `prefetch-${Date.now()}`,
      },
    );
    await prefetchInvitationActivateUrl(
      toE2eOriginUrl(prefetchIssued.activateEmailPath),
    );
    const prefetchUser = await findAuthUserByEmail(admin, prefetchEmail);
    expect(prefetchUser ?? null).toBeNull();

    const directSignup = await attemptDirectSignupForEmail({
      email: `go-live-direct-${Date.now()}@example.test`,
      password: "GoLiveDirect123!",
    });
    expect(directSignup.error?.message.toLowerCase()).toContain(
      "organisation invitation",
    );

    const revokedEmail = `go-live-revoked-${Date.now()}@example.test`;
    const revoked = await issueInvitationWithDeliveredInboxProof(ownerClient, {
      email: revokedEmail,
      tokenSeed: `revoked-${Date.now()}`,
    });
    await revokeOrganisationInvitationForE2e(ownerClient, {
      organisationId,
      invitationId: revoked.invitationId,
    });
    const revokedPage = await browser.newPage();
    await revokedPage.goto(toE2eOriginUrl(revoked.activateEmailPath));
    await expect(revokedPage.getByText(/revoked/i)).toBeVisible();
    await revokedPage.close();

    const expiredEmail = `go-live-expired-${Date.now()}@example.test`;
    const expired = await issueInvitationWithDeliveredInboxProof(ownerClient, {
      email: expiredEmail,
      tokenSeed: `expired-${Date.now()}`,
    });
    const expiredContext = await browser.newContext();
    const expiredPage = await expiredContext.newPage();
    await createAccountThroughInvitationEmail(expiredPage, {
      activateEmailPath: toE2eOriginUrl(expired.activateEmailPath),
      password: "GoLiveExpired123!",
    });
    const bindingId = await fetchInvitationSignupBindingForEmail(expiredEmail);
    expireOrganisationInvitationForBinding(bindingId);
    await expiredPage.reload();
    await expect(
      expiredPage.getByRole("heading", { name: /Invitation expired/i }),
    ).toBeVisible();
    await expiredContext.close();
  });

  test("step 2b — provision operator, production manager, and delegate manager", async ({
    browser,
  }) => {
    const ownerClient = await createFoundingOwnerClient(user);
    const operatorJobId = queryJobFunctionIdByCode(organisationId, "operator");
    const teamMemberRole = queryPublishedRoleVersionId(
      organisationId,
      "team-member",
    );
    const managerRole = queryPublishedRoleVersionId(organisationId, "manager");

    const operatorIssued = await issueInvitationWithDeliveredInboxProof(
      ownerClient,
      {
        email: operator.email,
        tokenSeed: `operator-${Date.now()}`,
        displayName: operator.displayName,
        jobFunctionId: operatorJobId,
        organisationalUnitId: operationsUnitId,
        roleVersionId: teamMemberRole,
        scopeType: "unit_subtree",
        scopeUnitId: operationsUnitId,
      },
    );
    await acceptInvitationAsNewColleague(browser, {
      invitationPath: "",
      activateEmailPath: operatorIssued.activateEmailPath,
      email: operator.email,
      password: operator.password,
    });

    const managerIssued = await issueInvitationWithDeliveredInboxProof(
      ownerClient,
      {
        email: productionManager.email,
        tokenSeed: `prod-mgr-${Date.now()}`,
        displayName: productionManager.displayName,
        jobFunctionId: operatorJobId,
        organisationalUnitId: operationsUnitId,
        roleVersionId: managerRole,
        scopeType: "unit_subtree",
        scopeUnitId: operationsUnitId,
      },
    );
    await acceptInvitationAsNewColleague(browser, {
      invitationPath: "",
      activateEmailPath: managerIssued.activateEmailPath,
      email: productionManager.email,
      password: productionManager.password,
    });

    const delegateIssued = await issueInvitationWithDeliveredInboxProof(
      ownerClient,
      {
        email: delegateManager.email,
        tokenSeed: `delegate-${Date.now()}`,
        displayName: delegateManager.displayName,
        organisationalUnitId: operationsUnitId,
        roleVersionId: managerRole,
        scopeType: "unit_subtree",
        scopeUnitId: operationsUnitId,
      },
    );
    await acceptInvitationAsNewColleague(browser, {
      invitationPath: "",
      activateEmailPath: delegateIssued.activateEmailPath,
      email: delegateManager.email,
      password: delegateManager.password,
    });

    await tightenSuggestionApproverToProductionManager(
      ownerClient,
      organisationId,
      operationsUnitId,
      operator.email,
    );
  });

  test("step 3 — suggestion submission, manager notification, delegation, approval", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginAsExistingFoundingUser(page, user);
    await bootstrapSuggestionProgramme(page);

    await loginColleague(page, operator);
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await page.getByLabel("What have you noticed?").fill(suggestionTitle);
    await page
      .getByLabel("What would you change?")
      .fill("Go-live approval delegation");
    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    suggestionId =
      page.url().match(/\/platform\/suggestions\/([0-9a-f-]{36})/i)?.[1] ??
      null;
    expect(suggestionId).toMatch(/^[0-9a-f-]{36}$/i);
    const routedSuggestionId = suggestionId as string;
    await waitForSuggestionApprovalRouting(organisationId, routedSuggestionId);
    const productionManagerMembershipId = queryMembershipIdForEmail(
      organisationId,
      productionManager.email,
    );
    expect(
      querySuggestionPrimaryApproverMembershipId(
        organisationId,
        routedSuggestionId,
      ),
    ).toBe(productionManagerMembershipId);
    await waitForUnreadSuggestionNotification(
      organisationId,
      routedSuggestionId,
      "Idea submitted",
      productionManagerMembershipId,
    );

    // Operational suggestion email is drained by notification-delivery (Resend), not Mailpit;
    // ledger + fake-provider coverage lives in test:db:integration:suggestion-approval-delegation.

    await loginColleague(page, productionManager);
    await page.goto("/platform");
    await openUnreadSuggestionNotificationReview(
      page,
      () => notificationBell(page),
      /Idea submitted for review/i,
      routedSuggestionId,
      120_000,
    );
    await expect(reviewWorkspace(page)).toContainText(suggestionTitle);
    if (
      await page
        .getByTestId("review-claim-button")
        .isVisible({ timeout: 5_000 })
        .catch(() => false)
    ) {
      await page.getByTestId("review-claim-button").click();
      await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);
    }
    await expect(page.getByTestId("review-delegate-controls")).toBeVisible({
      timeout: 30_000,
    });
    const delegateSelect = page.getByTestId("review-delegate-select");
    await delegateSelect.selectOption({
      label: delegateManager.displayName,
    });
    await page
      .getByTestId("review-delegate-reason")
      .fill("Coverage while I am on the floor");
    await page.getByTestId("review-delegate-button").click();
    await expect(page.getByTestId("review-workspace-error")).toHaveCount(0);

    const delegateManagerMembershipId = queryMembershipIdForEmail(
      organisationId,
      delegateManager.email,
    );
    await waitForUnreadSuggestionNotification(
      organisationId,
      routedSuggestionId,
      "delegated",
      delegateManagerMembershipId,
    );

    await loginColleague(page, delegateManager);
    await page.goto("/platform");
    await openUnreadSuggestionNotificationReview(
      page,
      () => notificationBell(page),
      /delegated to you/i,
      routedSuggestionId,
      120_000,
    );
    await beginCurrentReview(page);
    await approveCurrentReview(
      page,
      "Approved on go-live journey",
      "Thanks for the idea",
    );

    await loginColleague(page, productionManager);
    await page.goto("/platform");
    await expect(notificationBell(page)).toBeVisible();
    await notificationBell(page).click();
    await expect(page.getByTestId("platform-notification-list")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page
        .locator(
          `[data-notification-unread="true"][data-notification-href*="suggestionId=${suggestionId}"]`,
        )
        .filter({ hasText: /Idea submitted for review|delegated/i }),
    ).toHaveCount(0, { timeout: 30_000 });
  });

  test("step 4 — actions planner views and Android viewport scroll", async ({
    page,
  }, testInfo) => {
    await loginAsExistingFoundingUser(page, user);
    const actionTitle = `Go-live action ${Date.now().toString(36)}`;
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-page")).toBeVisible();
    await createActionViaPlannerDialog(
      page,
      actionTitle,
      "Captured during customer go-live journey",
    );
    const detailSheet = page.getByTestId("action-detail-sheet");
    await expect(detailSheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailSheet).not.toBeVisible({ timeout: 15_000 });

    await page.getByTestId("actions-view-board").click();
    await expect(page.getByTestId("actions-board")).toBeVisible();
    await page.getByTestId("actions-view-tiles").click();
    await expect(page.getByTestId("actions-tiles")).toBeVisible();
    await page.getByTestId("actions-view-list").click();
    await expect(page.getByTestId("actions-planner-list")).toBeVisible();

    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/platform/actions");
    await expect(page.getByTestId("actions-page")).toBeVisible();
    await page.evaluate(() => {
      const inner = document.querySelector(
        ".platform-main-inner",
      ) as HTMLElement | null;
      if (inner) {
        inner.style.minHeight = "220vh";
      }
    });
    await scrollPlatformMainViewportForProject(page, 320, testInfo);
    await expect(platformMain(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("step 5 — LeanAI chat with credit enforcement", async ({ page }) => {
    test.setTimeout(120_000);
    enableLeanAiCreditEnforcement(organisationId);
    await loginAsExistingFoundingUser(page, user);
    await page.goto("/platform/settings/ai");
    await expect(page.getByTestId("ai-settings-page")).toBeVisible();
    await expect(page.getByTestId("ai-credit-period-panel")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ai-credit-period-panel")).toContainText(
      /120[,.]?000/,
    );

    await page.goto("/platform");
    await ensureLeanAiAssistantOpen(page);
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).not.toHaveText(/Loading context/i, { timeout: 15_000 });
    await page
      .getByLabel("Ask LeanAI")
      .fill("Summarise one lean habit for go-live.");
    await page.getByTestId("leanai-assistant-send").click();
    await expect(page.getByTestId("leanai-assistant-sending")).toBeHidden({
      timeout: 60_000,
    });
    await expect(
      page.getByTestId("leanai-assistant-assistant-message").first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByTestId("leanai-assistant-assistant-message").first(),
    ).not.toBeEmpty();

    exhaustLeanAiCreditAllowance(organisationId);
    await page.goto("/platform/settings/ai");
    const creditPanel = page.getByTestId("ai-credit-period-panel");
    await expect(creditPanel).toContainText(/Remaining0|Remaining[\s\n]*0/);

    await page.goto("/platform");
    await ensureLeanAiAssistantOpen(page);
    await page
      .getByLabel("Ask LeanAI")
      .fill("This should be blocked by credits.");
    await page.getByTestId("leanai-assistant-send").click();
    await expect(page.locator("p[role=alert].text-destructive")).toContainText(
      /could not complete|credit allowance|allowance exceeded/i,
      {
        timeout: 30_000,
      },
    );
  });

  test("step 6 — downgrade to Essentials keeps history, blocks module writes", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await loginAsExistingFoundingUser(page, user);
    await page.goto("/platform/suggestions");
    await expect(
      page.getByRole("link", { name: "Go-live approval delegation" }).first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/platform/projects/new");
    await expect(page.getByTestId("create-project-wizard")).toBeVisible();
    await page.getByLabel("Project title").fill(projectTitle);
    await page.getByTestId("project-unit-select").selectOption({ index: 1 });
    await page.locator("textarea").first().fill("Go-live charter background");
    await page.locator("textarea").nth(1).fill("Go-live charter objective");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(/Methodology/i).selectOption({ index: 0 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("project-owner-select").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("Display name").fill("Go-live KPI");
    await page.getByPlaceholder("Unit").fill("count");
    await page.getByPlaceholder("Baseline").fill("10");
    await page.getByPlaceholder("Target").fill("5");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByTestId("project-detail-page")).toBeVisible({
      timeout: 60_000,
    });

    await setOrganisationSubscriptionPlan(user, "essentials", "active");
    await page.reload();

    await page.goto("/platform/projects");
    await expect(page.getByTestId("projects-portfolio")).toBeVisible();
    await expect(page.getByText(projectTitle)).toBeVisible();
    await expect(
      page.getByTestId("plan-module-upgrade-projects"),
    ).toBeVisible();
    await expect(page.getByTestId("projects-new-link")).toBeDisabled();

    const ownerClient = await createFoundingOwnerClient(user);
    expect(await assertModuleWriteDenied(ownerClient, "projects")).toBe(true);
    expect(await assertModuleWriteDenied(ownerClient, "maturity")).toBe(false);

    await page.goto("/platform/settings/people");
    await expect(page.getByTestId("invite-colleague-form")).toBeVisible();
    const unlimitedProbe = `go-live-unlimited-${Date.now()}@example.test`;
    await page.locator("#invite-email").fill(unlimitedProbe);
    await page.locator("#invite-role").selectOption({ label: "Team Member" });
    await page.locator("#invite-scope").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page.getByText(unlimitedProbe)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("step 7 — stale session on /platform redirects to login", async ({
    context,
    page,
  }) => {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0] || "127";
    const cookieName = `sb-${projectRef}-auth-token`;
    const staleSession = Buffer.from(
      JSON.stringify([
        {
          access_token: "stale-access-token",
          refresh_token: "stale-refresh-token-not-found",
          expires_at: 1,
          token_type: "bearer",
        },
      ]),
    ).toString("base64url");

    await context.addCookies([
      {
        name: cookieName,
        value: staleSession,
        url: "http://127.0.0.1:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/platform/settings/billing");
    await expect(page).toHaveURL(/\/login\?next=%2Fplatform/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText(/couldn.t load/i)).toHaveCount(0);
  });
});
