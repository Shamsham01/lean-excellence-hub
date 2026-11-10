import { expect, type Page } from "@playwright/test";

export async function openPeopleInviteDialog(page: Page) {
  await page.getByTestId("people-invite-open").click();
  await expect(page.getByTestId("people-invite-dialog")).toBeVisible();
  await expect(page.getByTestId("invite-colleague-form")).toBeVisible();
}

export async function dismissPeopleInviteDialog(page: Page) {
  const dialog = page.getByTestId("people-invite-dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page
      .getByTestId("people-invite-dialog")
      .getByRole("button", { name: "Close" })
      .click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
}

export async function openPeoplePendingInvitationsTab(page: Page) {
  await dismissPeopleInviteDialog(page);
  await page.getByTestId("people-settings-tab-pending").click();
  await expect(page.getByTestId("pending-invitations-list")).toBeVisible();
}

export async function openPeopleAddEmployeeDialog(page: Page) {
  await page.getByTestId("people-settings-create-link").click();
  await expect(page.getByTestId("people-add-employee-dialog")).toBeVisible();
  await expect(page.getByTestId("create-workforce-user-form")).toBeVisible();
}

export async function openSuggestionsNewDialog(page: Page) {
  await page.getByTestId("suggestions-new-link").click();
  await expect(page.getByTestId("suggestions-new-dialog")).toBeVisible();
  await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
}

export async function openExecutionStartDialog(
  page: Page,
  openTestId: string,
  formTestId: string,
) {
  await page.getByTestId(openTestId).click();
  await expect(page.getByTestId(`${formTestId}-dialog`)).toBeVisible();
  await expect(page.getByTestId(formTestId)).toBeVisible();
}

const FRAMEWORK_DIALOG_IDS = [
  "framework-add-level-dialog",
  "framework-add-pillar-dialog",
  "framework-add-criterion-dialog",
  "framework-add-question-dialog",
] as const;

async function dismissFrameworkDialogs(page: Page) {
  for (const dialogId of FRAMEWORK_DIALOG_IDS) {
    await dismissOverlayDialog(page, dialogId);
  }
}

export async function openFrameworkAddLevel(page: Page) {
  await dismissFrameworkDialogs(page);
  await page.getByTestId("framework-add-level-open").click();
  await expect(page.getByTestId("framework-add-level-dialog")).toBeVisible();
}

export async function openFrameworkAddPillar(page: Page) {
  await dismissFrameworkDialogs(page);
  await page.getByTestId("framework-add-pillar-open").click();
  await expect(page.getByTestId("framework-add-pillar-dialog")).toBeVisible();
}

export async function openFrameworkAddCriterion(page: Page) {
  await dismissFrameworkDialogs(page);
  await page.getByTestId("framework-add-criterion-open").click();
  await expect(
    page.getByTestId("framework-add-criterion-dialog"),
  ).toBeVisible();
}

export async function openFrameworkAddQuestion(page: Page) {
  await dismissFrameworkDialogs(page);
  await page.getByTestId("framework-add-question-open").click();
  await expect(page.getByTestId("framework-add-question-dialog")).toBeVisible();
}

async function dismissOverlayDialog(page: Page, testId: string) {
  const dialog = page.getByTestId(testId);
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  await page.getByTestId(testId).getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

export async function openFiveSAddCategory(page: Page) {
  await dismissOverlayDialog(page, "five-s-add-question-dialog");
  await dismissOverlayDialog(page, "five-s-add-category-dialog");
  await page.getByTestId("five-s-add-category-open").click();
  await expect(page.getByTestId("five-s-add-category-dialog")).toBeVisible();
}

export async function openFiveSAddQuestion(page: Page, sectionIndex = 0) {
  await dismissOverlayDialog(page, "five-s-add-category-dialog");
  await dismissOverlayDialog(page, "five-s-add-question-dialog");
  await page
    .getByTestId(/^five-s-add-question-open-/)
    .nth(sectionIndex)
    .click();
  await expect(page.getByTestId("five-s-add-question-dialog")).toBeVisible();
}

export async function openGembaAddSection(page: Page) {
  await dismissOverlayDialog(page, "gemba-add-prompt-dialog");
  await dismissOverlayDialog(page, "gemba-add-section-dialog");
  await page.getByTestId("gemba-add-section-open").click();
  await expect(page.getByTestId("gemba-add-section-dialog")).toBeVisible();
}

export async function openGembaAddPrompt(page: Page, sectionIndex = 0) {
  await dismissOverlayDialog(page, "gemba-add-section-dialog");
  await dismissOverlayDialog(page, "gemba-add-prompt-dialog");
  await page
    .getByTestId(/^gemba-add-prompt-open-/)
    .nth(sectionIndex)
    .click();
  await expect(page.getByTestId("gemba-add-prompt-dialog")).toBeVisible();
}

export async function openTrainingCourseCreateDialog(page: Page) {
  const dialog = page.getByTestId("training-course-create-dialog");
  if ((await dialog.count()) === 0) {
    await page.getByTestId("training-course-new-button").click();
  }
  await expect(dialog).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog.getByTestId("training-course-create-form")).toBeVisible();
}

export async function openSkillsCatalogNewSkillDialog(page: Page) {
  if ((await page.getByTestId("skill-create-form").count()) === 0) {
    await page.getByTestId("skills-catalog-new-link").click();
  }
  await expect(page.getByTestId("skills-catalog-create-dialog")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("skill-create-form")).toBeVisible();
}

export async function openRecognitionAwardDialog(page: Page) {
  await page.getByTestId("recognition-award-link").click();
  await expect(page.getByTestId("recognition-award-dialog")).toBeVisible();
  await expect(page.getByTestId("award-recognition-form")).toBeVisible();
}

export async function openStartAssessmentDialogFromHub(
  page: Page,
  triggerTestId:
    | "maturity-start-assessment-link"
    | "maturity-start-assessment-dialog-open"
    | "maturity-overview-start-assessment" = "maturity-start-assessment-link",
) {
  await page.getByTestId(triggerTestId).click();
  await expect(
    page.getByTestId("maturity-start-assessment-dialog"),
  ).toBeVisible();
  await expect(page.getByTestId("start-assessment-form")).toBeVisible();
}
