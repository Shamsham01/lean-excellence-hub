import { expect, type Page } from "@playwright/test";

export async function expectGembaPromptHeading(page: Page, prompt: string) {
  await expect(page.getByRole("heading", { name: prompt })).toBeVisible({
    timeout: 15_000,
  });
}

/** Flush debounced notes, wait for persist, and fail with inline error if save does not commit. */
export async function fillGembaWalkNotesExpectSaved(page: Page, text: string) {
  const notes = page.getByTestId("gemba-walk-notes");
  await notes.fill(text);
  await notes.blur();
  const status = page.getByTestId("answer-save-status");
  await expect
    .poll(
      async () => {
        const body = (await status.textContent()) ?? "";
        if (body.includes("Saved")) return "saved";
        if (body.includes("Saving")) return "saving";
        if (body.includes("Couldn't") || body.includes("Try again")) {
          return "error";
        }
        const retryVisible = await page
          .getByTestId("answer-save-retry")
          .isVisible()
          .catch(() => false);
        if (retryVisible) return "error";
        return "idle";
      },
      { timeout: 30_000 },
    )
    .toBe("saved");
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

/** Browser back/forward must restore prompt-scoped URLs before UI catches up. */
export async function expectGembaBrowserHistoryPrompt(
  page: Page,
  action: "back" | "forward",
  expectedPrompt: string,
  expectedUrl: string,
) {
  if (action === "back") {
    await page.goBack();
  } else {
    await page.goForward();
  }
  await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 });
  await expectGembaPromptHeading(page, expectedPrompt);
}
