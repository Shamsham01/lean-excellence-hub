import { expect, type Page, type Locator } from "@playwright/test";

/** `PageHeader` page title (`h1`). Use `exact: true` so empty-state `h3` titles cannot partial-match (e.g. "No actions in your scope"). */
export function modulePageHeading(page: Page, title: string): Locator {
  return page.getByRole("heading", { level: 1, name: title, exact: true });
}

export async function expectModulePageHeading(
  page: Page,
  title: string,
): Promise<void> {
  await expect(modulePageHeading(page, title)).toBeVisible();
}

/** Any heading level with exact accessible name (card titles, profile sections). */
export function exactHeading(page: Page, name: string): Locator {
  return page.getByRole("heading", { name, exact: true });
}

export async function expectExactHeading(
  page: Page,
  name: string,
): Promise<void> {
  await expect(exactHeading(page, name)).toBeVisible();
}
