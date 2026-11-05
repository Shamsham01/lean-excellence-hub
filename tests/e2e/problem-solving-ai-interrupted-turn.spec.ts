import { expect, test } from "@playwright/test";

import { signInAsDemoUser } from "./helpers/demo-auth";
import { DEMO_PROBLEM_SOLVING_CASE } from "../../scripts/demo-seed/constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("Problem Solving LeanAI interrupted turn", () => {
  test.setTimeout(120_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and demo seed applied",
  );

  test("preserves the prompt and explains a wall-clock interruption", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();

    const prompt = "leanai-e2e-interrupt-turn please review this case.";
    await page.getByTestId("lean-ai-input").fill(prompt);
    await page.getByTestId("lean-ai-send").click();

    await expect(page.getByTestId("lean-ai-input")).toHaveValue(prompt, {
      timeout: 30_000,
    });
    await expect(page.getByText(/took too long|lost contact with the provider/i))
      .toBeVisible({ timeout: 30_000 })
      .catch(async () => {
        await expect(
          page.getByText(/did not confirm whether this turn finished/i),
        ).toBeVisible({ timeout: 5_000 });
      });
  });

  test("maps a dropped server-action response to an understandable retry message", async ({
    page,
  }) => {
    await signInAsDemoUser(page, "manager");
    await page.goto("/platform/problem-solving");
    await page
      .getByRole("link", { name: DEMO_PROBLEM_SOLVING_CASE.title })
      .click();
    await page.getByTestId("tab-lean-ai").click();

    await page.route("**/*", async (route) => {
      const request = route.request();
      const nextAction = request.headers()["next-action"];
      if (request.method() === "POST" && nextAction) {
        await route.fulfill({
          status: 502,
          contentType: "text/plain",
          body: "upstream reset",
        });
        return;
      }
      await route.continue();
    });

    const prompt = "Please summarise the current condition facts.";
    await page.getByTestId("lean-ai-input").fill(prompt);
    await page.getByTestId("lean-ai-send").click();

    await expect(
      page.getByText(/did not confirm whether this turn finished/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lean-ai-input")).toHaveValue(prompt);
  });
});
