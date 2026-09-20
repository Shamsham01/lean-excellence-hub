import { expect, test, type Page } from "@playwright/test";

import {
  DEMO_SKILLS,
  DEMO_TRAINING_COURSES,
  DEMO_TRAINING_SESSION,
  DEMO_USERS,
} from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const uniqueSuffix = Date.now().toString(36);
const DEMO_COURSE_NAME = DEMO_TRAINING_COURSES[0].name;
const DEMO_SKILL_NAME = DEMO_SKILLS[0].name;
const DEMO_SESSION_TITLE = DEMO_TRAINING_SESSION.title;
const DEMO_RECOGNITION_TITLE = "Great Idea";
const DEMO_SOURCE_SUGGESTION_TITLE = "Pre-stage changeover tooling";
const awardTitle = `NAV-CLICK recognition ${uniqueSuffix}`;

async function openTrainingHub(page: Page) {
  await page.goto("/platform/training");
  await expect(page.getByTestId("training-overview")).toBeVisible();
}

async function openSkillsHub(page: Page) {
  await page.goto("/platform/skills");
  await expect(page.getByTestId("skills-overview")).toBeVisible();
}

async function openRecognitionHub(page: Page) {
  await page.goto("/platform/recognition");
  await expect(page.getByTestId("recognition-feed")).toBeVisible();
}

test.describe("NAV-CLICK-001 Training, Skills, and Recognition navigation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("training hub, curriculum, courses, sessions, detail, and Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openTrainingHub(page);

    const curriculum = page.getByTestId("training-curriculum-link");
    await expect(curriculum).toHaveAttribute(
      "href",
      "/platform/training/curriculum",
    );
    await curriculum.click();
    await expect(page).toHaveURL(/\/platform\/training\/curriculum(?:\?|$)/);
    await expect(page.getByTestId("training-curriculum-page")).toBeVisible();
    const curriculumCourse = page
      .getByRole("link", { name: DEMO_COURSE_NAME })
      .first();
    await expect(curriculumCourse).toBeVisible();
    await curriculumCourse.click();
    await expect(page).toHaveURL(
      /\/platform\/training\/courses\/[0-9a-f-]{36}/,
    );
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_COURSE_NAME }),
    ).toBeVisible();

    await openTrainingHub(page);
    const viewCourses = page.getByTestId("training-courses-link");
    await expect(viewCourses).toHaveAttribute(
      "href",
      "/platform/training/courses",
    );
    await viewCourses.click();
    await expect(page).toHaveURL(/\/platform\/training\/courses(?:\?|$)/);
    await expect(page.getByTestId("training-courses-page")).toBeVisible();

    const courseRow = page
      .getByRole("link", { name: DEMO_COURSE_NAME })
      .first();
    const courseHref = await courseRow.getAttribute("href");
    expect(courseHref).toMatch(/\/platform\/training\/courses\/[0-9a-f-]{36}$/);
    await courseRow.click();
    await expect(page).toHaveURL(new RegExp(`${courseHref}$`));
    await expect(page.getByTestId("training-course-detail-page")).toBeVisible();

    const courseBack = page.getByTestId("training-course-back-link");
    await expect(courseBack).toHaveAttribute(
      "href",
      "/platform/training/courses",
    );
    await courseBack.click();
    await expect(page).toHaveURL(/\/platform\/training\/courses(?:\?|$)/);
    await expect(page.getByTestId("training-courses-page")).toBeVisible();

    await openTrainingHub(page);
    const sessions = page.getByTestId("training-sessions-link");
    await expect(sessions).toHaveAttribute(
      "href",
      "/platform/training/sessions",
    );
    await sessions.click();
    await expect(page).toHaveURL(/\/platform\/training\/sessions(?:\?|$)/);
    await expect(page.getByTestId("training-sessions-page")).toBeVisible();

    const sessionRow = page
      .getByRole("link", { name: DEMO_SESSION_TITLE })
      .first();
    const sessionHref = await sessionRow.getAttribute("href");
    expect(sessionHref).toMatch(
      /\/platform\/training\/sessions\/[0-9a-f-]{36}$/,
    );
    await sessionRow.click();
    await expect(page).toHaveURL(new RegExp(`${sessionHref}$`));
    await expect(
      page.getByTestId("training-session-detail-page"),
    ).toBeVisible();
    await expect(page.getByTestId("session-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_SESSION_TITLE }),
    ).toBeVisible();

    const openCourse = page.getByTestId("training-session-course-link");
    await expect(openCourse).toHaveAttribute(
      "href",
      /\/platform\/training\/courses\/[0-9a-f-]{36}$/,
    );
    expect(await openCourse.innerText()).toMatch(/Open /);
    expect(await openCourse.innerText()).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );

    const sessionBack = page.getByTestId("training-session-back-link");
    await expect(sessionBack).toHaveAttribute(
      "href",
      "/platform/training/sessions",
    );
    await sessionBack.click();
    await expect(page).toHaveURL(/\/platform\/training\/sessions(?:\?|$)/);
    await expect(page.getByTestId("training-sessions-page")).toBeVisible();
  });

  test("keyboard Enter on Training matrix navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await openTrainingHub(page);

    const matrix = page.getByTestId("training-matrix-link");
    await expect(matrix).toHaveAttribute("href", "/platform/training/matrix");
    await matrix.focus();
    await expect(matrix).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/training\/matrix(?:\?|$)/);
    await expect(page.getByTestId("training-matrix-page")).toBeVisible();
    await expect(page.getByTestId("training-matrix")).toBeVisible();
  });

  test("modified click on View all courses keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openTrainingHub(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("training-courses-link").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/training\/courses/);
    await expect(page).toHaveURL(currentUrl);
    await expect(popup.getByTestId("training-courses-page")).toBeVisible();
    await popup.close();
  });

  test("skills hub, catalogue row, matrix person/skill, and Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openSkillsHub(page);

    const catalog = page.getByTestId("skills-catalog-link");
    await expect(catalog).toHaveAttribute("href", "/platform/skills/catalog");
    await catalog.click();
    await expect(page).toHaveURL(/\/platform\/skills\/catalog(?:\?|$)/);
    await expect(page.getByTestId("skills-catalog-page")).toBeVisible();

    const skillRow = page.getByRole("link", { name: DEMO_SKILL_NAME }).first();
    const skillHref = await skillRow.getAttribute("href");
    expect(skillHref).toMatch(/\/platform\/skills\/[0-9a-f-]{36}$/);
    await skillRow.click();
    await expect(page).toHaveURL(new RegExp(`${skillHref}$`));
    await expect(page.getByTestId("skills-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_SKILL_NAME }),
    ).toBeVisible();

    const skillBack = page.getByTestId("skills-detail-back-link");
    await expect(skillBack).toHaveAttribute("href", "/platform/skills/catalog");
    await skillBack.click();
    await expect(page).toHaveURL(/\/platform\/skills\/catalog(?:\?|$)/);
    await expect(page.getByTestId("skills-catalog-page")).toBeVisible();

    await openSkillsHub(page);
    const matrix = page.getByTestId("skills-matrix-link");
    await expect(matrix).toHaveAttribute("href", "/platform/skills/matrix");
    await matrix.click();
    await expect(page).toHaveURL(/\/platform\/skills\/matrix(?:\?|$)/);
    await expect(page.getByTestId("skills-matrix-page")).toBeVisible();
    await expect(page.getByTestId("skills-matrix")).toBeVisible();

    const personLink = page
      .getByRole("link", { name: DEMO_USERS.operator.displayName })
      .first();
    const personHref = await personLink.getAttribute("href");
    expect(personHref).toMatch(/\/platform\/people\/[0-9a-f-]{36}$/);
    expect(await personLink.innerText()).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
    await personLink.click();
    await expect(page).toHaveURL(new RegExp(`${personHref}$`));
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_USERS.operator.displayName }),
    ).toBeVisible();

    await page.goto("/platform/skills/matrix");
    await expect(page.getByTestId("skills-matrix")).toBeVisible();
    const matrixSkill = page
      .getByRole("link", { name: DEMO_SKILL_NAME })
      .first();
    const matrixSkillHref = await matrixSkill.getAttribute("href");
    expect(matrixSkillHref).toMatch(/\/platform\/skills\/[0-9a-f-]{36}$/);
    await matrixSkill.click();
    await expect(page).toHaveURL(new RegExp(`${matrixSkillHref}$`));
    await expect(page.getByTestId("skills-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_SKILL_NAME }),
    ).toBeVisible();

    const matrixBack = page.getByTestId("skills-detail-back-link");
    await matrixBack.click();
    await expect(page).toHaveURL(/\/platform\/skills\/catalog(?:\?|$)/);
  });

  test("recognition hub types, history/detail, recipient, source, and Back navigate", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openRecognitionHub(page);

    const types = page.getByTestId("recognition-types-link");
    await expect(types).toHaveAttribute("href", "/platform/recognition/types");
    await types.click();
    await expect(page).toHaveURL(/\/platform\/recognition\/types(?:\?|$)/);
    await expect(page.getByTestId("recognition-types-page")).toBeVisible();
    await expect(page.getByTestId("recognition-type-management")).toBeVisible();

    const typesBack = page.getByTestId("recognition-types-back-link");
    await expect(typesBack).toHaveAttribute("href", "/platform/recognition");
    await typesBack.click();
    await expect(page).toHaveURL(/\/platform\/recognition(?:\?|$)/);
    await expect(page.getByTestId("recognition-feed")).toBeVisible();

    const awardRow = page
      .getByRole("link", { name: new RegExp(DEMO_RECOGNITION_TITLE) })
      .first();
    await expect(awardRow).toBeVisible();
    const awardHref = await awardRow.getAttribute("href");
    expect(awardHref).toMatch(/\/platform\/recognition\/[0-9a-f-]{36}$/);
    await awardRow.click();
    await expect(page).toHaveURL(new RegExp(`${awardHref}$`));
    await expect(page.getByTestId("recognition-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_RECOGNITION_TITLE }),
    ).toBeVisible();

    const recipient = page.getByTestId(/^recognition-recipient-link-/).first();
    await expect(recipient).toBeVisible();
    const recipientHref = await recipient.getAttribute("href");
    expect(recipientHref).toMatch(/\/platform\/people\/[0-9a-f-]{36}$/);
    expect(await recipient.innerText()).toBe(DEMO_USERS.operator.displayName);
    await recipient.click();
    await expect(page).toHaveURL(new RegExp(`${recipientHref}$`));
    await expect(page.getByTestId("capability-profile-page")).toBeVisible();

    await page.goto(awardHref ?? "/platform/recognition");
    await expect(page.getByTestId("recognition-detail-page")).toBeVisible();
    const source = page.getByTestId("recognition-source-link");
    await expect(source).toBeVisible();
    const sourceHref = await source.getAttribute("href");
    expect(sourceHref).toMatch(/\/platform\/suggestions\/[0-9a-f-]{36}$/);
    expect(await source.innerText()).toMatch(
      new RegExp(`Open ${DEMO_SOURCE_SUGGESTION_TITLE}`),
    );
    expect(await source.innerText()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    await source.click();
    await expect(page).toHaveURL(new RegExp(`${sourceHref}$`));
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: DEMO_SOURCE_SUGGESTION_TITLE }),
    ).toBeVisible();

    await page.goto(awardHref ?? "/platform/recognition");
    const detailBack = page.getByTestId("recognition-detail-back-link");
    await expect(detailBack).toHaveAttribute("href", "/platform/recognition");
    await detailBack.click();
    await expect(page).toHaveURL(/\/platform\/recognition(?:\?|$)/);
    await expect(page.getByTestId("recognition-feed")).toBeVisible();
  });

  test("keyboard Enter on Award recognition navigates", async ({ page }) => {
    await signInAsDemoUser(page, "admin");
    await openRecognitionHub(page);

    const award = page.getByTestId("recognition-award-link");
    await expect(award).toHaveAttribute("href", "/platform/recognition/new");
    await award.focus();
    await expect(award).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/platform\/recognition\/new(?:\?|$)/);
    await expect(page.getByTestId("award-recognition-page")).toBeVisible();
    await expect(page.getByTestId("award-recognition-form")).toBeVisible();
  });

  test("modified click on Types keeps the current document", async ({
    page,
    context,
  }) => {
    await signInAsDemoUser(page, "admin");
    await openRecognitionHub(page);
    const currentUrl = page.url();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("recognition-types-link").click({
      modifiers: ["ControlOrMeta"],
    });
    const popup = await popupPromise;
    await popup.waitForURL(/\/platform\/recognition\/types/);
    await expect(page).toHaveURL(currentUrl);
    await expect(popup.getByTestId("recognition-types-page")).toBeVisible();
    await popup.close();
  });

  test("award creation opens the resulting record without a router race", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "admin");
    await page.goto("/platform/recognition/new");
    await expect(page.getByTestId("award-recognition-page")).toBeVisible();
    await expect(page.getByTestId("award-recognition-form")).toBeVisible();

    await page.getByLabel("Title").fill(awardTitle);
    await page
      .getByLabel("Message")
      .fill("NAV-CLICK local award so create-and-open can be verified.");
    await page
      .getByTestId("recognition-unit-select")
      .selectOption({ index: 1 });
    await page.getByTestId("recognition-recipient-select").selectOption({
      label: new RegExp(DEMO_USERS.operator.displayName),
    });
    await page.getByTestId("award-recognition-submit").click();

    await expect(page).toHaveURL(/\/platform\/recognition\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("recognition-detail-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: awardTitle })).toBeVisible();
    await expect(
      page.getByTestId(/^recognition-recipient-link-/).first(),
    ).toHaveText(DEMO_USERS.operator.displayName);
  });
});
