import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_FIVE_S_STANDARD,
  DEMO_GEMBA_DEFINITION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

async function openPlatformHome(page: Page) {
  await page.goto("/platform");
  await expect(page.getByTestId("platform-home-page")).toBeVisible();
}

test.describe("NAV-CLICK-001 core platform navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("dashboard Open cards reach 5S, People, and Gemba", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await openPlatformHome(page);

    const openFiveS = page.getByTestId("dashboard-open-5s");
    await expect(openFiveS).toHaveAttribute("href", "/platform/5s");
    await openFiveS.click();
    await expect(page).toHaveURL(/\/platform\/5s(?:\?|$)/);
    await expect(
      page.getByRole("heading", { name: "5S Audits" }),
    ).toBeVisible();

    await openPlatformHome(page);
    const openPeople = page.getByTestId("dashboard-open-people");
    await expect(openPeople).toHaveAttribute("href", "/platform/people");
    await openPeople.click();
    await expect(page).toHaveURL(/\/platform\/people(?:\?|$)/);
    await expect(page.getByTestId("people-directory-page")).toBeVisible();

    await openPlatformHome(page);
    const openGemba = page.getByTestId("dashboard-open-gemba");
    await expect(openGemba).toHaveAttribute("href", "/platform/gemba");
    await openGemba.click();
    await expect(page).toHaveURL(/\/platform\/gemba(?:\?|$)/);
    await expect(
      page.getByRole("heading", { name: "Gemba walks" }),
    ).toBeVisible();
  });

  test("keyboard Enter on dashboard Open People navigates", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openPlatformHome(page);

    const openPeople = page.getByTestId("dashboard-open-people");
    await openPeople.focus();
    await expect(openPeople).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/people(?:\?|$)/);
    await expect(page.getByTestId("people-directory-page")).toBeVisible();
  });

  test("modified click on dashboard Open 5S keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openPlatformHome(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("dashboard-open-5s").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/5s/);
    await expect(page).toHaveURL(currentUrl);
    await expect(
      popup.getByRole("heading", { name: "5S Audits" }),
    ).toBeVisible();
    await popup.close();
  });

  test("people directory row, Manage, and directory Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/people");
    await expect(page.getByTestId("people-directory-page")).toBeVisible();

    const operatorRow = page.getByRole("link", {
      name: `${DEMO_USERS.operator.displayName} Operator`,
    });
    await expect(operatorRow).toBeVisible();
    const profileHref = await operatorRow.getAttribute("href");
    expect(profileHref).toMatch(/\/platform\/people\/[0-9a-f-]{36}$/);

    const manage = operatorRow
      .locator("xpath=..")
      .getByRole("link", { name: "Manage" });
    await expect(manage).toHaveAttribute("href", `${profileHref}/admin`);
    await manage.click();
    await expect(page).toHaveURL(new RegExp(`${profileHref}/admin$`));
    await expect(page.getByTestId("member-admin-page")).toBeVisible();

    const back = page.getByTestId("people-directory-back-link");
    await expect(back).toHaveAttribute("href", "/platform/people");
    await back.click();
    await expect(page).toHaveURL(/\/platform\/people(?:\?|$)/);
    await expect(page.getByTestId("people-directory-page")).toBeVisible();

    await operatorRow.click();
    await expect(page).toHaveURL(new RegExp(`${profileHref}$`));
    await expect(
      page.getByRole("heading", { name: DEMO_USERS.operator.displayName }),
    ).toBeVisible();
  });

  test("settings hub Open and Back to settings navigate", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/settings");
    await expect(page.getByTestId("settings-hub")).toBeVisible();

    const openPeople = page.getByTestId(
      "settings-hub-open-platform-settings-people",
    );
    await expect(openPeople).toHaveAttribute(
      "href",
      "/platform/settings/people",
    );
    await openPeople.click();
    await expect(page).toHaveURL(/\/platform\/settings\/people(?:\?|$)/);
    await expect(page.getByTestId("people-settings-page")).toBeVisible();

    const back = page.getByTestId("settings-back-link");
    await expect(back).toHaveAttribute("href", "/platform/settings");
    await back.click();
    await expect(page).toHaveURL(/\/platform\/settings(?:\?|$)/);
    await expect(page.getByTestId("settings-hub")).toBeVisible();

    const openProfile = page.getByTestId(
      "settings-hub-open-platform-settings-profile",
    );
    await openProfile.click();
    await expect(page).toHaveURL(/\/platform\/settings\/profile(?:\?|$)/);
    await expect(page.getByTestId("profile-settings-page")).toBeVisible();
    await page.getByTestId("settings-back-link").click();
    await expect(page).toHaveURL(/\/platform\/settings(?:\?|$)/);
    await expect(page.getByTestId("settings-hub")).toBeVisible();
  });

  test("5S standards row, history row, and Back to history navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/5s/standards");
    await expect(page.getByTestId("five-s-standards-page")).toBeVisible();

    const standard = page.getByRole("link", {
      name: DEMO_FIVE_S_STANDARD.name,
    });
    await expect(standard).toBeVisible();
    const standardHref = await standard.getAttribute("href");
    expect(standardHref).toMatch(/\/platform\/5s\/standards\/[0-9a-f-]{36}$/);
    await standard.click();
    await expect(page).toHaveURL(new RegExp(`${standardHref}$`));
    await expect(
      page.getByRole("heading", { name: DEMO_FIVE_S_STANDARD.name }),
    ).toBeVisible();

    await page.goto("/platform/5s/history");
    await expect(page.getByTestId("five-s-history-page")).toBeVisible();
    const historyRow = page
      .getByTestId(/^five-s-history-link-/)
      .filter({ hasText: DEMO_FIVE_S_STANDARD.name })
      .first();
    await expect(historyRow).toBeVisible();
    const auditHref = await historyRow.getAttribute("href");
    expect(auditHref).toMatch(/\/platform\/5s\/audits\/[0-9a-f-]{36}$/);
    await historyRow.click();
    await expect(page).toHaveURL(new RegExp(`${auditHref}$`));
    await expect(page.getByTestId("five-s-audit-result-page")).toBeVisible();

    const back = page.getByTestId("five-s-audit-back-link");
    await expect(back).toHaveAttribute("href", "/platform/5s/history");
    await back.click();
    await expect(page).toHaveURL(/\/platform\/5s\/history(?:\?|$)/);
    await expect(page.getByTestId("five-s-history-page")).toBeVisible();
  });

  test("Gemba definitions row, history row, and History back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/gemba/definitions");
    await expect(page.getByTestId("gemba-definitions-page")).toBeVisible();

    const definition = page.getByRole("link", {
      name: DEMO_GEMBA_DEFINITION.name,
    });
    await expect(definition).toBeVisible();
    const definitionHref = await definition.getAttribute("href");
    expect(definitionHref).toMatch(
      /\/platform\/gemba\/definitions\/[0-9a-f-]{36}$/,
    );
    await definition.click();
    await expect(page).toHaveURL(new RegExp(`${definitionHref}$`));
    await expect(
      page.getByRole("heading", { name: DEMO_GEMBA_DEFINITION.name }),
    ).toBeVisible();

    await page.goto("/platform/gemba/history");
    await expect(page.getByTestId("gemba-history-page")).toBeVisible();
    const historyRow = page
      .getByTestId(/^gemba-history-link-/)
      .filter({ hasText: DEMO_GEMBA_DEFINITION.name })
      .first();
    await expect(historyRow).toBeVisible();
    const walkHref = await historyRow.getAttribute("href");
    expect(walkHref).toMatch(/\/platform\/gemba\/walks\/[0-9a-f-]{36}$/);
    await historyRow.click();
    await expect(page).toHaveURL(new RegExp(`${walkHref}$`));
    await expect(page.getByTestId("gemba-walk-summary-page")).toBeVisible();

    const back = page.getByTestId("gemba-walk-back-link");
    await expect(back).toHaveAttribute("href", "/platform/gemba/history");
    await back.click();
    await expect(page).toHaveURL(/\/platform\/gemba\/history(?:\?|$)/);
    await expect(page.getByTestId("gemba-history-page")).toBeVisible();
  });
});
