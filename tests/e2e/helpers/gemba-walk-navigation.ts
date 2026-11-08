import { expect, type Page } from "@playwright/test";

export async function expectGembaPromptHeading(page: Page, prompt: string) {
  await expect(page.getByRole("heading", { name: prompt })).toBeVisible({
    timeout: 15_000,
  });
}

export async function navigateGembaPrompt(
  page: Page,
  direction: "Next" | "Previous",
  expectedPrompt: string,
) {
  const control = page.getByRole("button", { name: direction, exact: true });
  await expect(control).toBeEnabled({ timeout: 30_000 });
  await control.click();
  await expect(page).toHaveURL(/prompt=/, { timeout: 15_000 });
  await expectGembaPromptHeading(page, expectedPrompt);
}
