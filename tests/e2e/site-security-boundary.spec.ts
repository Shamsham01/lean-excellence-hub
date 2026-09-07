import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  loginAsCookieWorksPersona,
  COOKIEWORKS_ORGANISATION,
} from "./helpers/cookieworks-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const EXETER_FACTORY_LABEL = "Exeter Cookie Factory";
const BODMIN_FACTORY_LABEL = "Bodmin Cookie Factory";

let exeterAssessmentId = "";

test.describe("Site security boundary focused E2E", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and site-boundary QA seed (npm run qa:site-boundary:reset)",
  );

  test.beforeAll(() => {
    const output = execSync("npm run qa:site-boundary:reset", {
      cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
      env: {
        ...process.env,
        LEANHUB_ALLOW_QA_TENANT: "1",
      },
      stdio: "pipe",
      encoding: "utf8",
    });

    const match = output.match(/"exeterAssessmentId":\s*"([^"]+)"/);
    exeterAssessmentId = match?.[1] ?? "";
    expect(exeterAssessmentId).not.toEqual("");
  });

  test("A. Bodmin baseline operator sees Bodmin maturity context only", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "operator");
    await page.goto("/platform/maturity/assessments");
    await expect(page.getByText(BODMIN_FACTORY_LABEL).first()).toBeVisible();
    await expect(page.getByText(EXETER_FACTORY_LABEL)).toHaveCount(0);
  });

  test("B. Direct Exeter assessment route is denied without leaking details", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "operator");
    await page.goto(
      `/platform/maturity/assessments/${exeterAssessmentId}`,
    );
    await expect(page.getByText(EXETER_FACTORY_LABEL)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /not found|access denied|unavailable/i }),
    ).toBeVisible();
  });

  test("C. Organisation-scoped CI manager can open Exeter assessment", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "ciManager");
    await page.goto(
      `/platform/maturity/assessments/${exeterAssessmentId}`,
    );
    await expect(page.getByText(EXETER_FACTORY_LABEL).first()).toBeVisible();
  });

  test("D. Bodmin production manager scope picker excludes Exeter targets", async ({
    page,
  }) => {
    await loginAsCookieWorksPersona(page, "productionManager");
    await page.goto("/platform/settings/people");
    await page.getByRole("link", { name: /invite colleague/i }).click();
    const scopeSelect = page.locator("select").filter({ hasText: /scope|organisation|subtree/i }).first();
    if (await scopeSelect.count()) {
      await expect(scopeSelect.locator("option")).not.toContainText([
        EXETER_FACTORY_LABEL,
      ]);
    } else {
      await expect(page.getByText(EXETER_FACTORY_LABEL)).toHaveCount(0);
    }
    await expect(page.getByText(COOKIEWORKS_ORGANISATION.name)).toBeVisible();
  });
});
