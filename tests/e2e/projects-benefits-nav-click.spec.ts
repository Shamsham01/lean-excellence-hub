import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_BENEFITS,
  DEMO_CI_METHODOLOGIES,
  DEMO_CI_PROJECTS,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const DEMO_PROJECT_TITLE = DEMO_CI_PROJECTS[0].title;
const DEMO_BENEFIT_TITLE = DEMO_BENEFITS[1].title;
const DEMO_METHODOLOGY_NAME = DEMO_CI_METHODOLOGIES[0].name;

async function openProjectsHub(page: Page) {
  await page.goto("/platform/projects");
  await expect(page.getByTestId("projects-portfolio")).toBeVisible();
}

async function openBenefitsHub(page: Page) {
  await page.goto("/platform/benefits");
  await expect(page.getByTestId("benefits-portfolio-page")).toBeVisible();
}

test.describe("NAV-CLICK-001 Projects and Benefits navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("projects hub New project, Methodologies, list/detail Back, and portfolio row navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openProjectsHub(page);

    const newProject = page.getByTestId("projects-new-link");
    await expect(newProject).toHaveAttribute("href", "/platform/projects/new");
    await newProject.click();
    await expect(page).toHaveURL(/\/platform\/projects\/new(?:\?|$)/);
    await expect(page.getByTestId("create-project-page")).toBeVisible();
    await expect(page.getByTestId("create-project-wizard")).toBeVisible();

    await openProjectsHub(page);
    const methodologies = page.getByTestId("projects-methodologies-link");
    await expect(methodologies).toHaveAttribute(
      "href",
      "/platform/projects/methodologies",
    );
    await methodologies.click();
    await expect(page).toHaveURL(/\/platform\/projects\/methodologies(?:\?|$)/);
    await expect(page.getByTestId("methodology-manager-page")).toBeVisible();

    const methodology = page.getByRole("link", {
      name: DEMO_METHODOLOGY_NAME,
      exact: true,
    });
    await expect(methodology).toBeVisible();
    const methodologyHref = await methodology.getAttribute("href");
    expect(methodologyHref).toMatch(
      /\/platform\/projects\/methodologies\/[0-9a-f-]{36}$/,
    );
    await methodology.click();
    await expect(page).toHaveURL(new RegExp(`${methodologyHref}$`));
    await expect(page.getByTestId("methodology-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_METHODOLOGY_NAME }),
    ).toBeVisible();

    const methodologyBack = page.getByTestId("methodology-back-link");
    await expect(methodologyBack).toHaveAttribute(
      "href",
      "/platform/projects/methodologies",
    );
    await methodologyBack.click();
    await expect(page).toHaveURL(/\/platform\/projects\/methodologies(?:\?|$)/);
    await expect(page.getByTestId("methodology-manager-page")).toBeVisible();

    await openProjectsHub(page);
    const projectRow = page
      .getByRole("link", { name: new RegExp(DEMO_PROJECT_TITLE) })
      .first();
    await expect(projectRow).toBeVisible();
    const projectHref = await projectRow.getAttribute("href");
    expect(projectHref).toMatch(/\/platform\/projects\/[0-9a-f-]{36}$/);
    await projectRow.click();
    await expect(page).toHaveURL(new RegExp(`${projectHref}$`));
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_PROJECT_TITLE }),
    ).toBeVisible();
  });

  test("keyboard Enter on New project navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await openProjectsHub(page);

    const newProject = page.getByTestId("projects-new-link");
    await newProject.focus();
    await expect(newProject).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/projects\/new(?:\?|$)/);
    await expect(page.getByTestId("create-project-page")).toBeVisible();
  });

  test("modified click on Methodologies keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openProjectsHub(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("projects-methodologies-link").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/projects\/methodologies/);
    await expect(page).toHaveURL(currentUrl);
    await expect(popup.getByTestId("methodology-manager-page")).toBeVisible();
    await popup.close();
  });

  test("benefits hub New, Validation, Categories, and portfolio row navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openBenefitsHub(page);

    const newBenefit = page.getByTestId("benefits-new-link");
    await expect(newBenefit).toHaveAttribute("href", "/platform/benefits/new");
    await newBenefit.click();
    await expect(page).toHaveURL(/\/platform\/benefits\/new(?:\?|$)/);
    await expect(page.getByTestId("create-benefit-page")).toBeVisible();
    await expect(page.getByTestId("create-benefit-wizard")).toBeVisible();

    await openBenefitsHub(page);
    const validation = page.getByTestId("benefits-validation-link");
    await expect(validation).toHaveAttribute(
      "href",
      "/platform/benefits/validation",
    );
    await validation.click();
    await expect(page).toHaveURL(/\/platform\/benefits\/validation(?:\?|$)/);
    await expect(
      page.getByTestId("benefit-validation-queue-page"),
    ).toBeVisible();

    await openBenefitsHub(page);
    const categories = page.getByTestId("benefits-categories-link");
    await expect(categories).toHaveAttribute(
      "href",
      "/platform/benefits/categories",
    );
    await categories.click();
    await expect(page).toHaveURL(/\/platform\/benefits\/categories(?:\?|$)/);
    await expect(page.getByTestId("benefit-categories-page")).toBeVisible();

    await openBenefitsHub(page);
    const benefitRow = page
      .getByRole("link", { name: new RegExp(DEMO_BENEFIT_TITLE) })
      .first();
    await expect(benefitRow).toBeVisible();
    const benefitHref = await benefitRow.getAttribute("href");
    expect(benefitHref).toMatch(/\/platform\/benefits\/[0-9a-f-]{36}$/);
    await benefitRow.click();
    await expect(page).toHaveURL(new RegExp(`${benefitHref}$`));
    await expect(page.getByTestId("benefit-detail-page")).toBeVisible();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_BENEFIT_TITLE }),
    ).toBeVisible();
  });

  test("benefit source Project and project linked Benefit navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openBenefitsHub(page);

    await page
      .getByRole("link", { name: new RegExp(DEMO_BENEFIT_TITLE) })
      .first()
      .click();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();

    const sourceLink = page.getByTestId(/^benefit-source-link-/).first();
    await expect(sourceLink).toBeVisible();
    const projectHref = await sourceLink.getAttribute("href");
    expect(projectHref).toMatch(/\/platform\/projects\/[0-9a-f-]{36}$/);
    await sourceLink.click();
    await expect(page).toHaveURL(new RegExp(`${projectHref}$`));
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_PROJECT_TITLE }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Benefits" }).click();
    const linkedBenefit = page
      .getByTestId(/^project-linked-benefit-/)
      .filter({ hasText: DEMO_BENEFIT_TITLE })
      .first();
    await expect(linkedBenefit).toBeVisible();
    const benefitHref = await linkedBenefit.getAttribute("href");
    expect(benefitHref).toMatch(/\/platform\/benefits\/[0-9a-f-]{36}$/);
    await linkedBenefit.click();
    await expect(page).toHaveURL(new RegExp(`${benefitHref}$`));
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_BENEFIT_TITLE }),
    ).toBeVisible();
  });

  test("create project wizard opens the new workspace without a router race", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/projects/new");
    await expect(page.getByTestId("create-project-wizard")).toBeVisible();

    const projectTitle = `NAV-CLICK project ${uniqueSuffix}`;
    await page.getByLabel("Project title").fill(projectTitle);
    await page.getByTestId("project-unit-select").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("project-owner-select").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/platform\/projects\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("project-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: projectTitle }),
    ).toBeVisible();
  });

  test("create benefit wizard opens the new workspace without a router race", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/benefits/new");
    await expect(page.getByTestId("create-benefit-wizard")).toBeVisible();

    const benefitTitle = `NAV-CLICK benefit ${uniqueSuffix}`;
    await page.getByLabel("Benefit title").fill(benefitTitle);
    await page.getByTestId("benefit-unit-select").selectOption({ index: 1 });
    await page.getByTestId("benefit-owner-select").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByTestId("benefit-standalone-checkbox").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Create benefit draft" }).click();
    await expect(page).toHaveURL(/\/platform\/benefits\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("benefit-detail-page")).toBeVisible();
    await expect(page.getByTestId("benefit-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: benefitTitle }),
    ).toBeVisible();
  });
});
