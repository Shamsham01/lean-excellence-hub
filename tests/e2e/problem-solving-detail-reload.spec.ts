import { expect, test, type Page } from "@playwright/test";

import { DEMO_PROBLEM_SOLVING_CASE } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const RELOAD_COUNT = 10;

async function assertFunctionalWorkspace(page: Page) {
  const workspace = page.getByTestId("problem-solving-workspace");
  await expect(workspace).toBeVisible();
  await expect(page.getByTestId("problem-solving-header")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: DEMO_PROBLEM_SOLVING_CASE.title }),
  ).toBeVisible();
  await expect(page.getByTestId("tab-overview")).toBeVisible();
  await expect(page.getByTestId("tab-cause-analysis")).toBeVisible();
  await expect(page.getByTestId("tab-verification")).toBeVisible();
  await expect(page.getByTestId("problem-solving-back-link")).toBeVisible();
  await expect(page.getByTestId("workspace-load-error")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /couldn’t load/i }),
  ).toHaveCount(0);
}

test.describe("Problem solving case detail reload reliability", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("seeded case opens from portfolio and survives direct URL, hard reload, and repeated reloads", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await expect(
      page.getByTestId("problem-solving-portfolio-page"),
    ).toBeVisible();

    const caseRow = page
      .getByRole("link", { name: new RegExp(DEMO_PROBLEM_SOLVING_CASE.title) })
      .first();
    await expect(caseRow).toBeVisible();
    const caseHref = await caseRow.getAttribute("href");
    expect(caseHref).toMatch(/\/platform\/problem-solving\/[0-9a-f-]{36}$/);

    await caseRow.click();
    await expect(page).toHaveURL(new RegExp(`${caseHref}$`));
    await assertFunctionalWorkspace(page);

    await page.goto(caseHref ?? "/platform/problem-solving");
    await assertFunctionalWorkspace(page);

    await page.reload();
    await assertFunctionalWorkspace(page);

    for (let reload = 0; reload < RELOAD_COUNT; reload += 1) {
      await page.reload();
      await assertFunctionalWorkspace(page);
    }

    await page.goto("/platform/problem-solving");
    await expect(
      page.getByTestId("problem-solving-portfolio-page"),
    ).toBeVisible();

    await page.goto(caseHref ?? "/platform/problem-solving");
    await assertFunctionalWorkspace(page);

    await page.getByTestId("tab-cause-analysis").click();
    await expect(
      page.getByText(
        DEMO_PROBLEM_SOLVING_CASE.hypotheses.pressureVariation.statement,
      ),
    ).toBeVisible();
    await page.getByTestId("tab-overview").click();
    await expect(page.getByTestId("tab-overview")).toBeVisible();
  });

  test("unauthorised operator cannot open seeded case via direct URL", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    const caseRow = page
      .getByRole("link", { name: new RegExp(DEMO_PROBLEM_SOLVING_CASE.title) })
      .first();
    const caseHref = await caseRow.getAttribute("href");
    expect(caseHref).toBeTruthy();

    await signInAsDemoUser(page, "operator");
    await page.goto(caseHref ?? "/platform/problem-solving");
    await expect(
      page.getByTestId("problem-solving-detail-page"),
    ).not.toBeVisible();
    await expect(
      page.getByTestId("problem-solving-workspace"),
    ).not.toBeVisible();
  });
});
