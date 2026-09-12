import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { ALL_SITES_COOKIE_VALUE } from "@/modules/organisation/site-context";

import { loginAsCookieWorksPersona } from "./helpers/cookieworks-auth";
import {
  expectExecutionHeaderLayout,
  optionLabels,
} from "./helpers/execution-unit-select";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const BODMIN_FACTORY_LABEL = "Bodmin Cookie Factory";
const EXETER_FACTORY_LABEL = "Exeter Cookie Factory";
const FIVE_S_STANDARD = "QA CookieWorks 5S Standard";
const GEMBA_DEFINITION = "QA CookieWorks Gemba";
const DUPLICATE_UNIT_LABELS = [
  "Baking",
  "Mixing & Preparation",
  "Operations",
  "Packing",
  "Quality",
];

test.describe("CookieWorks 5S/Gemba execution site context", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and CookieWorks site-boundary seed (npm run qa:site-boundary:reset)",
  );

  test.beforeAll(() => {
    execSync("npm run qa:site-boundary:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
    });
  });

  async function selectActiveSite(page: Page, label: string) {
    const switcher = page.getByTestId("site-context-switcher");
    await expect(switcher).toBeVisible();
    const value = await switcher
      .locator("option", { hasText: new RegExp(`^${label}$`) })
      .getAttribute("value");
    expect(value).toBeTruthy();
    await switcher.selectOption(value!);
    await expect(switcher).toHaveValue(value!, { timeout: 15_000 });
  }

  async function openFiveSStandard(page: Page) {
    await page.goto("/platform/5s/standards");
    await page.getByRole("link", { name: FIVE_S_STANDARD }).click();
    await expect(
      page.getByRole("heading", { name: FIVE_S_STANDARD }),
    ).toBeVisible();
  }

  async function openGembaDefinition(page: Page) {
    await page.goto("/platform/gemba/definitions");
    await page.getByRole("link", { name: GEMBA_DEFINITION }).click();
    await expect(
      page.getByRole("heading", { name: GEMBA_DEFINITION }),
    ).toBeVisible();
  }

  function expectSiteLocalOptions(
    labels: string[],
    expectedSite: string,
    absentSite: string,
  ) {
    expect(labels).toContain(expectedSite);
    expect(labels).not.toContain(absentSite);
    for (const name of DUPLICATE_UNIT_LABELS) {
      expect(labels.filter((label) => label === name)).toHaveLength(1);
    }
  }

  test("admin Exeter active site keeps 5S execution units in Exeter", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "admin");
    await selectActiveSite(page, EXETER_FACTORY_LABEL);
    await openFiveSStandard(page);

    const labels = await optionLabels(page.getByTestId("five-s-unit-select"));
    expectSiteLocalOptions(labels, EXETER_FACTORY_LABEL, BODMIN_FACTORY_LABEL);
    await expectExecutionHeaderLayout(page, {
      managementTestId: "five-s-management-actions",
      executionTestId: "five-s-execution-actions",
      unitSelectTestId: "five-s-unit-select",
      submitTestId: "five-s-start-audit",
    });
  });

  test("admin Bodmin active site keeps 5S execution units in Bodmin", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "admin");
    await selectActiveSite(page, BODMIN_FACTORY_LABEL);
    await openFiveSStandard(page);

    const labels = await optionLabels(page.getByTestId("five-s-unit-select"));
    expectSiteLocalOptions(labels, BODMIN_FACTORY_LABEL, EXETER_FACTORY_LABEL);
  });

  test("admin All sites requires a concrete site before 5S execution", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "admin");
    await selectActiveSite(page, "All sites");
    await expect(page.getByTestId("site-context-switcher")).toHaveValue(
      ALL_SITES_COOKIE_VALUE,
    );
    await openFiveSStandard(page);

    await expect(page.getByTestId("site-context-required")).toHaveText(
      "Select an active site in the sidebar before starting an audit.",
    );
    await expect(page.getByTestId("five-s-unit-select")).toHaveCount(0);
    await expect(page.getByTestId("five-s-start-audit")).toBeDisabled();
  });

  test("admin Gemba Start Walk follows the same Exeter/Bodmin site context", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "admin");
    await selectActiveSite(page, EXETER_FACTORY_LABEL);
    await openGembaDefinition(page);

    const exeterLabels = await optionLabels(
      page.getByTestId("gemba-unit-select"),
    );
    expectSiteLocalOptions(
      exeterLabels,
      EXETER_FACTORY_LABEL,
      BODMIN_FACTORY_LABEL,
    );
    await expectExecutionHeaderLayout(page, {
      managementTestId: "gemba-management-actions",
      executionTestId: "gemba-execution-actions",
      unitSelectTestId: "gemba-unit-select",
      submitTestId: "gemba-start-walk",
    });

    await selectActiveSite(page, BODMIN_FACTORY_LABEL);
    await openGembaDefinition(page);
    const bodminLabels = await optionLabels(
      page.getByTestId("gemba-unit-select"),
    );
    expectSiteLocalOptions(
      bodminLabels,
      BODMIN_FACTORY_LABEL,
      EXETER_FACTORY_LABEL,
    );
  });

  test("scoped production manager cannot obtain Exeter units from a forged site cookie", async ({
    page,
    context,
  }) => {
    await loginAsCookieWorksPersona(page, "admin");
    const exeterSiteId = await page
      .getByTestId("site-context-switcher")
      .locator("option", { hasText: new RegExp(`^${EXETER_FACTORY_LABEL}$`) })
      .getAttribute("value");
    expect(exeterSiteId).toBeTruthy();

    await loginAsCookieWorksPersona(page, "productionManager");
    await context.addCookies([
      {
        name: "leanhub-active-site",
        value: exeterSiteId!,
        url: "http://127.0.0.1:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await openFiveSStandard(page);

    await expect(page.getByTestId("site-context-label")).toHaveText(
      BODMIN_FACTORY_LABEL,
    );
    const labels = await optionLabels(page.getByTestId("five-s-unit-select"));
    expect(labels).toContain(BODMIN_FACTORY_LABEL);
    expect(labels).not.toContain(EXETER_FACTORY_LABEL);
    expect(labels.filter((label) => label === "Packing")).toHaveLength(1);
  });
});
