import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  ensureLeanAiAssistantOpen,
  loginAndSelectOrganisation,
  provisionLeanAiContextE2eUser,
  resolveSupabaseEnv,
  type LeanAiContextE2eUser,
} from "./helpers/leanai-context";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function screenshotIfPossible(page: Page, name: string) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: false,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function waitForAssistantContext(page: Page) {
  const pane = await ensureLeanAiAssistantOpen(page);
  await expect(
    page.getByTestId("leanai-assistant-context-label"),
  ).not.toHaveText(/Loading context/i, { timeout: 15_000 });
  return pane;
}

async function readLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) {
        return null;
      }
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    };
    const feed = document.querySelector(
      '[data-testid="leanai-assistant-feed"]',
    );
    const main = document.querySelector('[data-testid="platform-main"]');
    return {
      windowScrollY: window.scrollY,
      documentScrollHeight: document.documentElement.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      bodyScrollHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      shell: rect('[data-testid="platform-shell"]'),
      sidebar: rect('[data-testid="platform-desktop-sidebar"]'),
      main: main
        ? {
            ...rect('[data-testid="platform-main"]'),
            scrollTop: (main as HTMLElement).scrollTop,
            scrollHeight: (main as HTMLElement).scrollHeight,
            clientHeight: (main as HTMLElement).clientHeight,
          }
        : null,
      assistant: rect('[data-testid="leanai-assistant-desktop"]'),
      rail: rect('[data-testid="leanai-assistant-rail"]'),
      pane: rect('[data-testid="leanai-assistant-pane"]'),
      feed: feed
        ? {
            ...rect('[data-testid="leanai-assistant-feed"]'),
            scrollTop: (feed as HTMLElement).scrollTop,
            scrollHeight: (feed as HTMLElement).scrollHeight,
            clientHeight: (feed as HTMLElement).clientHeight,
          }
        : null,
    };
  });
}

async function makeElementOverflow(
  page: Page,
  selector: string,
  extraPx = 800,
) {
  await page.locator(selector).evaluate((node, extra) => {
    const target = node as HTMLElement;
    const spacer = document.createElement("div");
    spacer.dataset.testid = "scroll-overflow-spacer";
    spacer.style.minHeight = `${target.clientHeight + extra}px`;
    spacer.style.flexShrink = "0";
    spacer.textContent = "Scroll overflow spacer";
    target.appendChild(spacer);
  }, extraPx);
}

async function wheelOver(page: Page, selector: string, ticks: number) {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`Cannot wheel over missing ${selector}`);
  }
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + Math.min(80, box.height / 2),
  );
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel(0, 240);
  }
}

function expectViewportLocked(
  metrics: Awaited<ReturnType<typeof readLayoutMetrics>>,
) {
  expect(metrics.windowScrollY).toBe(0);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(
    metrics.documentClientWidth + 1,
  );
  expect(metrics.shell?.height ?? 0).toBeLessThanOrEqual(
    metrics.viewportHeight + 2,
  );
}

async function asOrganisationClient(
  user: LeanAiContextE2eUser,
  organisationName: string,
) {
  const { url, publishableKey } = resolveSupabaseEnv();
  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required");
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
  ).find((row) => row.organisation_name === organisationName);
  if (!match) {
    throw new Error(`Organisation ${organisationName} was not listed`);
  }
  const switched = await client.rpc("switch_organisation", {
    target_organisation_id: match.organisation_id,
  });
  if (switched.error) {
    throw switched.error;
  }
  return client;
}

test.describe("LeanAI persistent workspace assistant", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  let user: LeanAiContextE2eUser;

  test.beforeAll(async () => {
    user = await provisionLeanAiContextE2eUser();
  });

  test("desktop pane can collapse and reopen", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    const pane = await waitForAssistantContext(page);
    await expect(pane).toBeVisible();
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toBeVisible();
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-organisation-name",
      user.organisationAName,
    );
    await expect(
      page.getByTestId("leanai-assistant-new-conversation"),
    ).toBeEnabled();
    await screenshotIfPossible(page, "leanai-assistant-desktop-open.png");

    await page.getByTestId("leanai-assistant-close").click();
    await expect(page.getByTestId("leanai-assistant-rail")).toBeVisible();
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveCount(0);
    await screenshotIfPossible(page, "leanai-assistant-desktop-collapsed.png");

    await page.getByTestId("leanai-assistant-open").click();
    await expect(page.getByTestId("leanai-assistant-pane")).toBeVisible();
  });

  test("Suggestions configuration and Maturity questions update context", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);

    await page.goto("/platform/suggestions/programmes");
    await expect(page.getByTestId("suggestion-programmes-page")).toBeVisible();
    await waitForAssistantContext(page);
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toContainText(/Suggestions/i);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-workflow",
      "programme_configuration",
    );
    await expect(page.getByTestId("leanai-assistant-summary")).toContainText(
      /Programme/i,
    );
    await screenshotIfPossible(page, "leanai-assistant-suggestions-config.png");

    await page.goto("/platform/maturity/models");
    await expect(page.getByTestId("maturity-models-page")).toBeVisible();
    await page.getByLabel("Name").fill("Assistant Framework");
    await page.getByRole("button", { name: "Create draft framework" }).click();
    await expect(page).toHaveURL(/\/platform\/maturity\/models\/[0-9a-f-]+/i, {
      timeout: 30_000,
    });
    await waitForAssistantContext(page);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-workflow",
      "maturity_authoring",
    );

    await page.getByTestId("framework-step-questions").click();
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-authoring-step",
      "questions",
      { timeout: 15_000 },
    );
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toContainText(/Questions/i);
    await screenshotIfPossible(page, "leanai-assistant-maturity-questions.png");
  });

  test("mobile assistant is an accessible drawer", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await expect(page.getByTestId("platform-home-page")).toBeVisible();
    await expect(page.getByTestId("leanai-assistant-open")).toBeVisible();
    await page.getByTestId("leanai-assistant-open").focus();
    await expect(page.getByTestId("leanai-assistant-open")).toBeFocused();
    await page.keyboard.press("Enter");
    const pane = page.getByTestId("leanai-assistant-pane");
    await expect(pane).toBeVisible();
    await expect(page.getByLabel("Ask LeanAI")).toBeVisible();
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).not.toHaveText(/Loading context/i, { timeout: 15_000 });
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    await screenshotIfPossible(page, "leanai-assistant-mobile.png");
  });

  test("desktop LeanAI feed scrolling does not move the workspace document", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/suggestions/programmes");
    await expect(page.getByTestId("suggestion-programmes-page")).toBeVisible();
    await waitForAssistantContext(page);

    await makeElementOverflow(page, '[data-testid="leanai-assistant-feed"]');
    await makeElementOverflow(page, '[data-testid="platform-main"]', 1200);

    const initial = await readLayoutMetrics(page);
    expectViewportLocked(initial);
    expect(initial.feed?.scrollHeight ?? 0).toBeGreaterThan(
      (initial.feed?.clientHeight ?? 0) + 100,
    );
    expect(initial.main?.scrollTop).toBe(0);
    expect(initial.sidebar?.top).toBeLessThanOrEqual(2);
    expect(initial.sidebar?.bottom ?? 0).toBeGreaterThanOrEqual(
      initial.viewportHeight - 2,
    );
    expect(initial.assistant?.top).toBeLessThanOrEqual(2);
    expect(initial.assistant?.bottom ?? 0).toBeGreaterThanOrEqual(
      initial.viewportHeight - 2,
    );

    await wheelOver(page, '[data-testid="leanai-assistant-feed"]', 24);
    const afterFeed = await readLayoutMetrics(page);
    expectViewportLocked(afterFeed);
    expect(afterFeed.main?.scrollTop).toBe(initial.main?.scrollTop);
    expect(afterFeed.feed?.scrollTop ?? 0).toBeGreaterThan(0);
    expect(afterFeed.feed?.scrollTop ?? 0).toBeGreaterThanOrEqual(
      (afterFeed.feed?.scrollHeight ?? 0) -
        (afterFeed.feed?.clientHeight ?? 0) -
        2,
    );
    expect(afterFeed.sidebar?.top).toBeLessThanOrEqual(2);
    expect(afterFeed.sidebar?.bottom ?? 0).toBeGreaterThanOrEqual(
      afterFeed.viewportHeight - 2,
    );
    expect(afterFeed.assistant?.top).toBeLessThanOrEqual(2);
    expect(afterFeed.assistant?.bottom ?? 0).toBeGreaterThanOrEqual(
      afterFeed.viewportHeight - 2,
    );
    await expect(
      page.getByTestId("leanai-assistant-context-label"),
    ).toBeVisible();
    await expect(page.getByTestId("leanai-assistant-input")).toBeVisible();
    await screenshotIfPossible(page, "leanai-assistant-feed-scrolled.png");

    await wheelOver(page, '[data-testid="leanai-assistant-feed"]', 8);
    const afterExtra = await readLayoutMetrics(page);
    expectViewportLocked(afterExtra);
    expect(afterExtra.main?.scrollTop).toBe(initial.main?.scrollTop);
    expect(afterExtra.sidebar?.top).toBeLessThanOrEqual(2);
    expect(afterExtra.assistant?.top).toBeLessThanOrEqual(2);

    await wheelOver(page, '[data-testid="platform-main"]', 10);
    const afterMain = await readLayoutMetrics(page);
    expectViewportLocked(afterMain);
    expect(afterMain.main?.scrollTop ?? 0).toBeGreaterThan(0);
    expect(afterMain.sidebar?.top).toBeLessThanOrEqual(2);
    expect(afterMain.assistant?.top).toBeLessThanOrEqual(2);
    expect(afterMain.assistant?.bottom ?? 0).toBeGreaterThanOrEqual(
      afterMain.viewportHeight - 2,
    );

    await page.getByTestId("leanai-assistant-close").click();
    await expect(page.getByTestId("leanai-assistant-rail")).toBeVisible();
    const collapsed = await readLayoutMetrics(page);
    expectViewportLocked(collapsed);
    expect(collapsed.rail?.top).toBeLessThanOrEqual(2);
    expect(collapsed.rail?.bottom ?? 0).toBeGreaterThanOrEqual(
      collapsed.viewportHeight - 2,
    );

    await page.getByTestId("leanai-assistant-open").click();
    await expect(page.getByTestId("leanai-assistant-pane")).toBeVisible();
    await makeElementOverflow(page, '[data-testid="leanai-assistant-feed"]');
    await wheelOver(page, '[data-testid="leanai-assistant-feed"]', 12);
    const reopened = await readLayoutMetrics(page);
    expectViewportLocked(reopened);
    expect(reopened.feed?.scrollTop ?? 0).toBeGreaterThan(0);
    expect(reopened.main?.scrollTop).toBe(afterMain.main?.scrollTop);
  });

  test("organisation name is server-resolved and independent from the active site", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await waitForAssistantContext(page);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-organisation-name",
      user.organisationAName,
    );

    await loginAndSelectOrganisation(page, user, user.organisationBName);
    await waitForAssistantContext(page);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-organisation-name",
      user.organisationBName,
    );
    await expect(page.getByTestId("leanai-assistant-pane")).not.toHaveAttribute(
      "data-organisation-name",
      user.organisationAName,
    );
  });

  test("web research stays off by default and can render mocked sources when enabled", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const client = await asOrganisationClient(user, user.organisationAName);
    const enabled = await client.rpc("update_organisation_ai_settings", {
      target_ai_enabled: true,
      target_monthly_token_ceiling: 100000,
      target_web_search_enabled: false,
    });
    if (enabled.error) {
      throw enabled.error;
    }

    await loginAndSelectOrganisation(page, user, user.organisationAName);
    await page.goto("/platform/settings/ai");
    await expect(page.getByTestId("ai-settings-page")).toBeVisible();
    await expect(page.getByTestId("ai-settings-web-search")).not.toBeChecked();
    await screenshotIfPossible(page, "leanai-settings-web-search-off.png");

    await waitForAssistantContext(page);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-web-search-enabled",
      "false",
    );
    await expect(page.getByLabel("Ask LeanAI")).toBeEnabled();
    await page.getByLabel("Ask LeanAI").fill("What is our organisation name?");
    await page.getByTestId("leanai-assistant-send").click();
    await expect(
      page.getByTestId("leanai-assistant-assistant-message"),
    ).toContainText(user.organisationAName, { timeout: 30_000 });

    await page
      .getByLabel("Ask LeanAI")
      .fill("Research HODL Token Club on the web.");
    await page.getByTestId("leanai-assistant-send").click();
    await expect(
      page.getByTestId("leanai-assistant-assistant-message").last(),
    ).toContainText(/disabled for this organisation/i, { timeout: 30_000 });
    await expect(page.getByTestId("leanai-assistant-sources")).toHaveCount(0);

    const turnedOn = await client.rpc("update_organisation_ai_settings", {
      target_ai_enabled: true,
      target_monthly_token_ceiling: 100000,
      target_web_search_enabled: true,
    });
    if (turnedOn.error) {
      throw turnedOn.error;
    }

    await page.reload();
    await waitForAssistantContext(page);
    await expect(page.getByTestId("leanai-assistant-pane")).toHaveAttribute(
      "data-web-search-enabled",
      "true",
    );
    await page.getByTestId("ai-settings-web-search").check();
    await page.getByTestId("ai-settings-save").click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    await page
      .getByLabel("Ask LeanAI")
      .fill("Research HODL Token Club on the web.");
    await page.getByTestId("leanai-assistant-send").click();
    await expect(page.getByTestId("leanai-assistant-sources")).toBeVisible({
      timeout: 30_000,
    });
    const sourceLink = page.getByTestId("leanai-assistant-source-link").first();
    await expect(sourceLink).toHaveAttribute("href", /https:\/\//);
    await expect(sourceLink).toHaveAttribute("target", "_blank");
    await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    await screenshotIfPossible(page, "leanai-assistant-web-sources.png");
  });
});
