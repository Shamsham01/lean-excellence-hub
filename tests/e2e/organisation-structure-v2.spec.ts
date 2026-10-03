import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_USERS } from "../../scripts/demo-seed/constants";
import {
  loginAsCookieWorksPersona,
  loginAsSiteBoundaryHierarchyDelegate,
  loginAsSiteBoundaryPeopleDelegate,
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

async function screenshotIfPossible(
  page: import("@playwright/test").Page,
  name: string,
) {
  try {
    await page.screenshot({
      path: `/opt/cursor/artifacts/${name}`,
      fullPage: false,
    });
  } catch {
    // Artifact directory is optional outside Cloud Agent runs.
  }
}

async function enableDarkMode(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  });
}

async function openAddUnitDrawer(
  page: import("@playwright/test").Page,
  parentName?: string,
) {
  if (parentName) {
    await unitTreeNode(page, parentName)
      .getByRole("button", {
        name: new RegExp(`Add child under ${parentName}`),
      })
      .click();
  } else {
    await page.getByTestId("add-unit-button").click();
  }
  await expect(page.getByTestId("add-unit-drawer")).toBeVisible();
  await expect(page.getByTestId("unit-create-form")).toBeVisible();
}

test.describe("Organisation Structure V2", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.describe("Admin structure journey", () => {
    test.skip(
      !hasSupabaseE2e,
      "Requires E2E_WITH_SUPABASE=1 and site-boundary QA seed (npm run qa:site-boundary:reset)",
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

    test("create, rename, move, archive, and reactivate a Bodmin child unit", async ({
      page,
    }) => {
      await loginAsCookieWorksPersona(page, "admin");
      await enableDarkMode(page);
      await page.goto("/platform/settings/structure");
      await expect(page.getByTestId("structure-settings-page")).toBeVisible();
      await expect(page.getByTestId("structure-summary")).toBeVisible();
      await expect(unitTreeNode(page, BODMIN_FACTORY_LABEL)).toBeVisible();

      const bodminToggle = page.getByRole("button", {
        name: `Collapse ${BODMIN_FACTORY_LABEL}`,
      });
      await expect(bodminToggle).toBeVisible();
      await bodminToggle.click();
      await expect(unitTreeNode(page, "Decorating")).toHaveCount(0);
      await page
        .getByRole("button", { name: `Expand ${BODMIN_FACTORY_LABEL}` })
        .click();
      await expect(unitTreeNode(page, "Decorating")).toBeVisible();

      const unitCode = `pr3-child-${Date.now()}`;
      const unitName = `PR3 Lifecycle Child ${unitCode}`;
      const renamedUnitName = `${unitName} Renamed`;
      await openAddUnitDrawer(page, BODMIN_FACTORY_LABEL);
      await expect(page.getByTestId("unit-parent-select")).toHaveValue(/.+/);
      const parentLabels = await page
        .getByTestId("unit-parent-select")
        .locator("option:checked")
        .textContent();
      expect(parentLabels).toContain(BODMIN_FACTORY_LABEL);
      await page.locator("#unit-name").fill(unitName);
      await page.getByTestId("unit-type-choice").selectOption("department");
      await page.getByTestId("unit-code-edit").click();
      await page.locator("#unit-code").fill(unitCode);
      await page.getByRole("button", { name: "Create unit" }).click();
      await expect(unitTreeNode(page, unitName)).toBeVisible();
      await expect(page.getByTestId("add-unit-drawer")).toHaveCount(0);

      let unitNode = unitTreeNode(page, unitName);
      await unitNode.getByRole("button", { name: "Edit" }).click();
      await expect(page.getByTestId("unit-edit-dialog")).toBeVisible();
      await page
        .getByTestId("unit-edit-dialog")
        .getByRole("textbox")
        .first()
        .fill(renamedUnitName);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(unitTreeNode(page, renamedUnitName)).toBeVisible();

      unitNode = unitTreeNode(page, renamedUnitName);
      await unitNode.getByLabel(`More actions for ${renamedUnitName}`).click();
      await page.getByRole("menuitem", { name: "Move" }).click();
      await expect(page.getByTestId("unit-move-dialog")).toBeVisible();
      const moveSelect = page.getByTestId("unit-move-parent-select");
      await moveSelect.selectOption({
        label: `${BODMIN_FACTORY_LABEL} › Operations › Packing`,
      });
      await page.getByRole("button", { name: "Move unit" }).click();
      await expect(unitTreeNode(page, renamedUnitName)).toBeVisible();

      await unitNode.getByLabel(`More actions for ${renamedUnitName}`).click();
      await page.getByRole("menuitem", { name: "Archive" }).click();
      await expect(page.getByTestId("unit-archive-dialog")).toBeVisible();
      await page.getByLabel("Reason").fill("PR3 acceptance archive");
      await page.getByRole("button", { name: "Archive unit" }).click();
      await expect(unitTreeNode(page, renamedUnitName)).toHaveCount(0);
      await expect(page.getByTestId("archived-units-section")).toBeVisible();
      await page.getByTestId("archived-units-toggle").click();
      await expect(
        page.getByTestId("archived-units-section").getByText(renamedUnitName),
      ).toBeVisible();

      const archivedUnit = page
        .getByTestId("archived-units-section")
        .locator('[data-testid^="archived-unit-"]')
        .filter({ hasText: renamedUnitName });
      await archivedUnit.getByRole("button", { name: "Reactivate" }).click();
      await page.getByRole("button", { name: "Reactivate unit" }).click();
      await expect(unitTreeNode(page, renamedUnitName)).toBeVisible();
    });

    test("structure workspace remains usable with LeanAI rail polish", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await loginAsCookieWorksPersona(page, "admin");
      await enableDarkMode(page);
      await page.goto("/platform/settings/structure");
      await expect(page.getByTestId("structure-settings-page")).toBeVisible();
      await expect(page.getByTestId("structure-summary")).toBeVisible();
      await expect(page.getByTestId("organisation-unit-tree")).toBeVisible();
      await expect(page.getByTestId("platform-main")).toHaveClass(
        /platform-scroll/,
      );

      const pane = page.getByTestId("leanai-assistant-pane");
      if (await pane.count()) {
        await expect(
          page.getByTestId("leanai-assistant-context-label"),
        ).toContainText(/Organisation · Structure/i, { timeout: 15_000 });
        await screenshotIfPossible(
          page,
          "structure-desktop-leanai-expanded.png",
        );
        await page.getByTestId("leanai-assistant-close").click();
      }

      await expect(page.getByTestId("leanai-assistant-rail")).toBeVisible();
      const railBox = await page
        .getByTestId("leanai-assistant-rail")
        .boundingBox();
      expect(railBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(railBox?.width ?? 0).toBeLessThanOrEqual(48);
      expect(railBox?.x ?? 0).toBeGreaterThan(page.viewportSize()!.width - 60);
      await expect(page.getByTestId("leanai-assistant-open")).toHaveAttribute(
        "title",
        "Open LeanAI",
      );
      await screenshotIfPossible(
        page,
        "structure-desktop-leanai-collapsed.png",
      );

      const beforeScroll = await page.evaluate(() => ({
        windowY: window.scrollY,
        main: (
          document.querySelector(
            '[data-testid="platform-main"]',
          ) as HTMLElement | null
        )?.scrollTop,
      }));
      await page.locator('[data-testid="platform-main"]').evaluate((node) => {
        const spacer = document.createElement("div");
        spacer.style.minHeight = `${(node as HTMLElement).clientHeight + 800}px`;
        node.appendChild(spacer);
      });
      await page.mouse.move(400, 200);
      await page.mouse.wheel(0, 600);
      const afterScroll = await page.evaluate(() => ({
        windowY: window.scrollY,
        main: (
          document.querySelector(
            '[data-testid="platform-main"]',
          ) as HTMLElement | null
        )?.scrollTop,
      }));
      expect(afterScroll.windowY).toBe(0);
      expect(afterScroll.main ?? 0).toBeGreaterThan(beforeScroll.main ?? 0);

      await page.getByTestId("add-unit-button").click();
      await expect(page.getByTestId("add-unit-drawer")).toBeVisible();
      await expect(page.getByTestId("unit-parent-select")).toHaveValue("");
      await screenshotIfPossible(page, "structure-add-unit-drawer.png");
      await page.getByRole("button", { name: "Cancel" }).click();

      await screenshotIfPossible(page, "structure-desktop-hierarchy.png");
      await page.getByTestId("leanai-assistant-open").click();
      await expect(page.getByTestId("leanai-assistant-pane")).toBeVisible();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/platform/settings/structure");
      await expect(page.getByTestId("structure-settings-page")).toBeVisible();
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(
        overflow.clientWidth + 1,
      );
      await expect(page.getByTestId("leanai-assistant-rail")).toHaveCount(0);
      await expect(page.getByTestId("leanai-assistant-open")).toBeVisible();
      await page.getByTestId("add-unit-button").click();
      await expect(page.getByTestId("add-unit-drawer")).toBeVisible();
      await screenshotIfPossible(page, "structure-mobile.png");
    });
  });

  test.describe("Access and responsibilities journey", () => {
    test.skip(
      !hasSupabaseE2e,
      "Requires E2E_WITH_SUPABASE=1 and demo seed applied (npm run db:reset && npm run db:seed-demo)",
    );

    test("assign two module responsibilities with independent scopes", async ({
      page,
    }) => {
      await signInAsDemoUser(page, "admin");
      await page.goto("/platform/people");
      await expect(page.getByTestId("people-directory-page")).toBeVisible();

      await page
        .getByRole("link", {
          name: `${DEMO_USERS.operator.displayName} Operator`,
        })
        .locator("xpath=..")
        .getByRole("link", { name: "Manage" })
        .click();
      await expect(page.getByTestId("member-access-management")).toBeVisible();

      const grantForm = page.getByTestId("member-access-management");
      const responsibilitySelect = grantForm.locator("#grant-role");
      const scopeSelect = grantForm.locator("#grant-scope");

      await responsibilitySelect.selectOption({ label: "Suggestions" });
      await scopeSelect.selectOption({ label: "Cornwall Plant subtree" });
      await grantForm
        .getByRole("button", { name: "Add responsibility" })
        .click();
      await expect(
        grantForm.getByText("Responsibility granted."),
      ).toBeVisible();
      await expect(
        grantForm.getByTestId("responsibility-grant-row").filter({
          hasText: "Suggestions",
        }),
      ).toBeVisible();

      await responsibilitySelect.selectOption({ label: "5S" });
      await scopeSelect.selectOption({ label: "Operations subtree" });
      await grantForm
        .getByRole("button", { name: "Add responsibility" })
        .click();
      await expect(
        grantForm.getByTestId("responsibility-grant-row").filter({
          hasText: "5S",
        }),
      ).toBeVisible();

      const suggestionsRow = grantForm
        .getByTestId("responsibility-grant-row")
        .filter({ hasText: "Suggestions" });
      await suggestionsRow.getByRole("button", { name: "Remove" }).click();
      await expect(suggestionsRow).toHaveCount(0);
      await expect(
        grantForm.getByTestId("responsibility-grant-row").filter({
          hasText: "5S",
        }),
      ).toBeVisible();
    });
  });

  test.describe("Hostile site journey", () => {
    test.skip(
      !hasSupabaseE2e,
      "Requires E2E_WITH_SUPABASE=1 and site-boundary QA seed (npm run qa:site-boundary:reset)",
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

    test("Bodmin hierarchy delegate move picker excludes Exeter targets", async ({
      page,
    }) => {
      await loginAsSiteBoundaryHierarchyDelegate(page);
      await page.goto("/platform/settings/structure");
      await expect(page.getByTestId("structure-settings-page")).toBeVisible();

      const packingNode = unitTreeNode(page, "Packing");
      await packingNode.getByLabel("More actions for Packing").click();
      await page.getByRole("menuitem", { name: "Move" }).click();
      const moveLabels = await page
        .getByTestId("unit-move-parent-select")
        .locator("option")
        .evaluateAll((options) =>
          options
            .map((option) => option.textContent?.trim() ?? "")
            .filter((label) => label.length > 0),
        );
      expect(
        moveLabels.some((label) => label.includes(EXETER_FACTORY_LABEL)),
      ).toBe(false);
      await page.getByRole("button", { name: "Cancel" }).click();
    });

    test("Bodmin people delegate responsibility scope picker excludes Exeter", async ({
      page,
    }) => {
      await loginAsSiteBoundaryPeopleDelegate(page);
      await page.goto("/platform/settings/people");
      await expect(page.getByTestId("invite-colleague-form")).toBeVisible();

      const scopeSelect = page.locator("#invite-scope");
      await page.locator("#invite-role").selectOption({ index: 0 });
      const scopeLabels = await scopeSelect
        .locator("option")
        .evaluateAll((options) =>
          options
            .map((option) => option.textContent?.trim() ?? "")
            .filter((label) => label.length > 0 && label !== "Select scope"),
        );
      expect(
        scopeLabels.some((label) => label.includes(EXETER_FACTORY_LABEL)),
      ).toBe(false);
      expect(scopeLabels.some((label) => label.includes("Packing"))).toBe(true);
    });
  });
});
