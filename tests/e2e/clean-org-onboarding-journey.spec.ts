import { expect, test, type Page } from "@playwright/test";

import {
  provisionFoundingE2eUser,
  type FoundingE2eUser,
} from "./helpers/founding-onboarding";
import {
  acceptInvitationAsNewColleague,
  bootstrapSuggestionProgramme,
  createFoundingOwnerClient,
  deployFiveSQuickStartDraft,
  expectNoHorizontalOverflow,
  issueInvitationForFoundingOwner,
  onboardFoundingOrganisationToPlatform,
  trackRuntimeErrors,
  visitModule,
} from "./helpers/clean-org-journey";
import { platformMain } from "./helpers/platform-main";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const desktopViewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };

test.describe("QA-NEW-ORG-001 clean organisation onboarding journey", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: FoundingE2eUser;
  const colleagueEmail = `clean-org-colleague-${Date.now()}@example.test`;
  const colleaguePassword = "CleanOrgColleague123!";

  test.beforeAll(async () => {
    user = await provisionFoundingE2eUser();
  });

  test("founding owner: sign-up, provisioning, webhook activation, and structure-first setup", async ({
    page,
  }) => {
    const assertClean = trackRuntimeErrors(page);
    await page.setViewportSize(desktopViewport);
    await onboardFoundingOrganisationToPlatform(page, user);

    await page.goto("/platform/settings/billing");
    await expect(page.getByTestId("billing-settings-page")).toContainText(
      "Professional",
    );

    await page.goto("/platform/settings/organisation");
    await expect(page.getByTestId("organisation-settings-page")).toBeVisible();
    await expect(page.getByTestId("rollout-governance-panel")).toBeVisible();

    assertClean();
  });

  test("founding owner: every in-scope module loads from empty state on desktop", async ({
    page,
  }) => {
    const assertClean = trackRuntimeErrors(page);
    await page.setViewportSize(desktopViewport);
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/platform/);

    const modules: Array<{ path: string; check: (p: Page) => Promise<void> }> =
      [
        {
          path: "/platform",
          check: async (p) => {
            await expect(p.getByTestId("platform-home-page")).toBeVisible();
          },
        },
        {
          path: "/platform/settings/structure",
          check: async (p) => {
            await expect(
              p.getByTestId("structure-settings-page"),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/settings/people",
          check: async (p) => {
            await expect(p.getByTestId("people-settings-page")).toBeVisible();
            await expect(p.getByTestId("invite-colleague-form")).toBeVisible();
          },
        },
        {
          path: "/platform/people",
          check: async (p) => {
            await expect(p.getByTestId("people-directory-page")).toBeVisible();
          },
        },
        {
          path: "/platform/maturity",
          check: async (p) => {
            await expect(p.getByTestId("maturity-overview-page")).toBeVisible();
          },
        },
        {
          path: "/platform/maturity/models",
          check: async (p) => {
            await expect(p.getByTestId("maturity-models-page")).toBeVisible();
            await expect(
              p.getByTestId("maturity-quick-start-section"),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/5s",
          check: async (p) => {
            await expect(p.getByTestId("five-s-empty-state")).toBeVisible();
            await expect(
              p.getByRole("link", { name: "Set up 5S" }),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/gemba",
          check: async (p) => {
            await expect(p.getByTestId("gemba-empty-state")).toBeVisible();
            await expect(
              p.getByRole("link", { name: "Set up Gemba" }),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/schedule",
          check: async (p) => {
            await expect(p.getByTestId("schedule-list-page")).toBeVisible();
            await expect(p.getByTestId("schedule-new-link")).toBeVisible();
          },
        },
        {
          path: "/platform/suggestions",
          check: async (p) => {
            await expect(p.getByTestId("suggestions-overview")).toBeVisible();
          },
        },
        {
          path: "/platform/actions",
          check: async (p) => {
            await expect(p.getByTestId("actions-page")).toBeVisible();
          },
        },
        {
          path: "/platform/projects",
          check: async (p) => {
            await expect(p.getByTestId("projects-portfolio")).toBeVisible();
            await expect(p.getByTestId("projects-new-link")).toBeVisible();
          },
        },
        {
          path: "/platform/benefits",
          check: async (p) => {
            await expect(
              p.getByTestId("benefits-portfolio-page"),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/problem-solving",
          check: async (p) => {
            await expect(
              p.getByTestId("problem-solving-portfolio-page"),
            ).toBeVisible();
            await expect(
              p.getByTestId("problem-solving-new-link"),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/training",
          check: async (p) => {
            await expect(
              p.getByTestId("training-hub-empty-courses"),
            ).toBeVisible();
          },
        },
        {
          path: "/platform/skills",
          check: async (p) => {
            await expect(p.getByTestId("skills-empty-state")).toBeVisible();
          },
        },
        {
          path: "/platform/recognition",
          check: async (p) => {
            await expect(p.getByTestId("recognition-feed")).toBeVisible();
            await expect(p.getByTestId("recognition-award-link")).toBeVisible();
          },
        },
        {
          path: "/platform/settings/ai",
          check: async (p) => {
            await expect(p.getByTestId("ai-settings-page")).toBeVisible();
          },
        },
        {
          path: "/platform/setup",
          check: async (p) => {
            await expect(p.getByTestId("setup-page")).toBeVisible();
          },
        },
      ];

    for (const moduleRoute of modules) {
      await visitModule(page, moduleRoute.path, () => moduleRoute.check(page));
    }

    assertClean();
  });

  test("founding owner: first records for action, suggestions, 5S draft, and problem-solving", async ({
    page,
  }) => {
    const assertClean = trackRuntimeErrors(page);
    await page.setViewportSize(desktopViewport);
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/platform/);

    const actionTitle = `Clean org action ${Date.now().toString(36)}`;
    await page.goto("/platform/actions");
    await page.getByLabel("Title").fill(actionTitle);
    await page.getByLabel("Description").fill("First value from empty state");
    await page.getByRole("button", { name: "Create action" }).click();
    await expect(page.getByTestId("action-detail-page")).toBeVisible();

    await bootstrapSuggestionProgramme(page);
    const suggestionTitle = `Clean org idea ${Date.now().toString(36)}`;
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await page
      .locator("textarea")
      .first()
      .fill("Spotted during clean-org journey");
    await page.locator("textarea").nth(1).fill("Automated first suggestion");
    await page.locator("form input").first().fill(suggestionTitle);
    await page.getByRole("button", { name: "Submit idea" }).click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();

    await deployFiveSQuickStartDraft(page);

    const caseTitle = `Clean org case ${Date.now().toString(36)}`;
    await page.goto("/platform/problem-solving/new");
    await expect(page.getByTestId("create-problem-solving-page")).toBeVisible();
    const wizard = page.getByTestId("create-problem-solving-wizard");
    await wizard.getByLabel("Title").fill(caseTitle);
    await wizard.getByRole("button", { name: "Next" }).click();
    await wizard
      .locator("textarea")
      .first()
      .fill("Problem statement for smoke");
    for (let step = 0; step < 4; step += 1) {
      await wizard.getByRole("button", { name: "Next" }).click();
    }
    await wizard.getByRole("button", { name: "Create draft case" }).click();
    await expect(page.getByTestId("problem-solving-detail-page")).toBeVisible();

    assertClean();
  });

  test("founding owner invites a colleague who accepts into the same organisation", async ({
    page,
    browser,
  }) => {
    const ownerClient = await createFoundingOwnerClient(user);
    const tokenSeed = `clean-org-invite-${Date.now()}`;
    const { invitationPath } = await issueInvitationForFoundingOwner(
      ownerClient,
      {
        email: colleagueEmail,
        tokenSeed,
        displayName: "Clean Org Colleague",
      },
    );

    await page.setViewportSize(desktopViewport);
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/platform/settings/people");
    await expect(page.getByText(colleagueEmail, { exact: false })).toBeVisible({
      timeout: 30_000,
    });

    await acceptInvitationAsNewColleague(browser, {
      invitationPath,
      email: colleagueEmail,
      password: colleaguePassword,
    });
  });

  test("mobile viewport: platform shell and execution modules avoid horizontal overflow", async ({
    page,
  }) => {
    const assertClean = trackRuntimeErrors(page);
    await page.setViewportSize(mobileViewport);
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/platform/);

    const mobileRoutes = [
      "/platform",
      "/platform/suggestions",
      "/platform/5s",
      "/platform/gemba",
      "/platform/settings/people",
      "/platform/training",
      "/platform/skills",
    ];

    for (const path of mobileRoutes) {
      await page.goto(path);
      await expect(platformMain(page)).toBeVisible({ timeout: 30_000 });
      await expectNoHorizontalOverflow(page);
    }

    assertClean();
  });
});
