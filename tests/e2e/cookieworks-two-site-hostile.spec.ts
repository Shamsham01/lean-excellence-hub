import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  loginAsCookieWorksPersona,
  COOKIEWORKS_ORGANISATION,
} from "./helpers/cookieworks-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const BODMIN_FACTORY_LABEL = "Bodmin Cookie Factory";
const EXETER_FACTORY_LABEL = "Exeter Cookie Factory";

function unitTreeNode(page: import("@playwright/test").Page, name: string) {
  return page
    .getByTestId("organisation-unit-tree")
    .locator('[data-testid^="org-unit-node-"]')
    .filter({
      has: page.locator("p.font-medium", { hasText: name }),
    });
}

test.describe("CookieWorks two-site hostile E2E", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and CookieWorks foundation reset (npm run qa:cookie:reset)",
  );

  test.beforeAll(() => {
    execSync("npm run qa:cookie:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
    });
  });

  test("Bodmin production manager sees Bodmin structure only", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "productionManager");
    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(unitTreeNode(page, BODMIN_FACTORY_LABEL)).toBeVisible();
    await expect(unitTreeNode(page, "Operations")).toBeVisible();
    await expect(page.getByText(EXETER_FACTORY_LABEL)).toHaveCount(0);
    await expect(page.getByTestId("platform-sidebar-org-name")).toHaveText(
      COOKIEWORKS_ORGANISATION.name,
    );
  });

  test("Exeter production manager sees Exeter structure only", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "exeterProductionManager");
    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(unitTreeNode(page, EXETER_FACTORY_LABEL)).toBeVisible();
    await expect(page.getByText(BODMIN_FACTORY_LABEL)).toHaveCount(0);
  });

  test("Organisation-wide CI manager sees both sites", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto("/platform/settings/structure");
    await expect(page.getByTestId("structure-settings-page")).toBeVisible();
    await expect(unitTreeNode(page, BODMIN_FACTORY_LABEL)).toBeVisible();
    await expect(unitTreeNode(page, EXETER_FACTORY_LABEL)).toBeVisible();
  });
});
