import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { DEMO_USERS } from "../../scripts/demo-seed/constants";
import { signInAsDemoUser } from "./helpers/demo-auth";
import {
  ensureOnboardingE2eOrganisation,
  onboardingE2eCredentials,
} from "./helpers/onboarding-auth";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function trackProductionRuntimeErrors(
  page: Page,
  options?: { allowForcedResourceFailure?: boolean },
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (
      options?.allowForcedResourceFailure &&
      text.includes("Failed to load resource") &&
      text.includes("400")
    ) {
      return;
    }

    consoleErrors.push(`[console.error] ${text}`);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(`[pageerror] ${error.message}`);
  });

  return () => {
    expect(
      pageErrors,
      pageErrors.length > 0
        ? `Unexpected uncaught page errors:\n${pageErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
    expect(
      consoleErrors,
      consoleErrors.length > 0
        ? `Unexpected console.error output:\n${consoleErrors.join("\n")}`
        : undefined,
    ).toEqual([]);
  };
}

function resolveBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && publishableKey) {
    return { url, publishableKey };
  }

  const output = execSync("npx supabase status -o json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  const status = JSON.parse(output) as {
    API_URL?: string;
    ANON_KEY?: string;
  };

  return {
    url: url ?? status.API_URL,
    publishableKey: publishableKey ?? status.ANON_KEY,
  };
}

async function signInRpcClient(
  email: string,
  password: string,
  organisationCode?: string,
): Promise<SupabaseClient> {
  const { url, publishableKey } = resolveBrowserSupabase();
  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required.");
  }

  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  const { data: organisations, error: listError } = await client.rpc(
    "list_my_eligible_organisations",
  );
  if (listError) {
    throw listError;
  }

  const organisation = organisationCode
    ? organisations?.find(
        (entry: { organisation_code: string }) =>
          entry.organisation_code === organisationCode,
      )
    : organisations?.[0];

  if (!organisation?.organisation_id) {
    throw new Error(
      "No eligible organisation was available for the RPC client.",
    );
  }

  const { error: switchError } = await client.rpc("switch_organisation", {
    target_organisation_id: organisation.organisation_id,
  });
  if (switchError) {
    throw switchError;
  }

  return client;
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

function writeFixture(name: string, contents: Buffer | string) {
  const path = join(tmpdir(), name);
  writeFileSync(path, contents);
  return path;
}

async function fillSuggestionIdea(
  page: Page,
  noticed: string,
  proposed: string,
) {
  await page.getByLabel("What have you noticed?").fill(noticed);
  await page.getByLabel("What would you change?").fill(proposed);
}

async function openEvidenceTab(page: Page) {
  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
}

test.describe("Suggestion submission evidence", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test("submit without evidence still works", async ({ page }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await fillSuggestionIdea(
      page,
      `No-evidence idea ${Date.now()}`,
      "Keep submitting ideas without files",
    );
    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await openEvidenceTab(page);
    await expect(page.getByText("floor.png")).toHaveCount(0);
    assertNoProductionRuntimeErrors();
  });

  test("submit image and document, reload, and open both", async ({ page }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    const stamp = Date.now();
    const imagePath = writeFixture(`sug-evidence-${stamp}.png`, PNG_BYTES);
    const notePath = writeFixture(
      `sug-evidence-${stamp}.txt`,
      "changeover photo notes",
    );

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await fillSuggestionIdea(
      page,
      `Evidence idea ${stamp}`,
      "Attach a photo and a note",
    );
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles([imagePath, notePath]);
    await expect(page.getByText(`sug-evidence-${stamp}.png`)).toBeVisible();
    await expect(page.getByText(`sug-evidence-${stamp}.txt`)).toBeVisible();
    await expect(page.getByTestId("suggestion-evidence-list")).toContainText(
      /\d+(\.\d+)?\s(?:B|KB)/,
    );

    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    const suggestionUrl = page.url();

    await openEvidenceTab(page);
    await expect(page.getByText(`sug-evidence-${stamp}.png`)).toBeVisible();
    await expect(page.getByText(`sug-evidence-${stamp}.txt`)).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await openEvidenceTab(page);
    await expect(page.getByText(`sug-evidence-${stamp}.png`)).toBeVisible();
    await expect(page.getByText(`sug-evidence-${stamp}.txt`)).toBeVisible();
    await expect(page.getByTestId("evidence-file-input")).toHaveCount(0);

    const firstDownload = page.waitForEvent("download");
    await page
      .getByTestId(/evidence-download-/)
      .first()
      .click();
    expect((await firstDownload).suggestedFilename()).toMatch(
      /sug-evidence-\d+\.(png|txt)/,
    );
    const secondDownload = page.waitForEvent("download");
    await page
      .getByTestId(/evidence-download-/)
      .nth(1)
      .click();
    expect((await secondDownload).suggestedFilename()).toMatch(
      /sug-evidence-\d+\.(png|txt)/,
    );

    expect(page.url()).toBe(suggestionUrl);
    assertNoProductionRuntimeErrors();
  });

  test("rejects invalid type and size before upload", async ({ page }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    const stamp = Date.now();
    const exePath = writeFixture(`payload-${stamp}.exe`, "not-an-image");
    const hugePath = writeFixture(
      `huge-${stamp}.pdf`,
      Buffer.alloc(10 * 1024 * 1024 + 1, 1),
    );

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles(exePath);
    await expect(
      page.getByTestId("suggestion-evidence-validation"),
    ).toContainText("not a supported evidence type");

    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles(hugePath);
    await expect(
      page.getByTestId("suggestion-evidence-validation"),
    ).toContainText("larger than the 10 MB limit");
    await expect(page.getByTestId("suggestion-evidence-list")).toHaveCount(0);
    assertNoProductionRuntimeErrors();
  });

  test("partial upload failure retries the same draft without silent submit", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page, {
      allowForcedResourceFailure: true,
    });
    const stamp = Date.now();
    const firstPath = writeFixture(`retry-a-${stamp}.txt`, "first file");
    const secondPath = writeFixture(`retry-b-${stamp}.txt`, "second file");
    let createDraftCalls = 0;
    let failNextStorageUpload = true;

    await page.route(
      "**/rest/v1/rpc/create_suggestion_draft",
      async (route) => {
        createDraftCalls += 1;
        await route.continue();
      },
    );
    await page.route("**/storage/v1/object/**", async (route) => {
      if (route.request().method() === "POST" && failNextStorageUpload) {
        failNextStorageUpload = false;
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "forced upload failure" }),
        });
        return;
      }
      await route.continue();
    });

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await fillSuggestionIdea(
      page,
      `Partial upload ${stamp}`,
      "Keep the draft after a failed file",
    );
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles([firstPath, secondPath]);
    await page.getByTestId("suggestion-submit-button").click();

    await expect(page.getByTestId("suggestion-submit-error")).toContainText(
      "Some evidence could not be attached",
    );
    await expect(page.getByTestId("suggestion-submit-button")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByTestId("suggestion-catalogue-locked")).toBeVisible();
    await expect(page.getByLabel("Programme")).toBeDisabled();
    await expect(page.getByLabel("Category")).toBeDisabled();
    expect(createDraftCalls).toBe(1);

    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    expect(createDraftCalls).toBe(1);
    await openEvidenceTab(page);
    await expect(page.getByText(`retry-a-${stamp}.txt`)).toBeVisible();
    await expect(page.getByText(`retry-b-${stamp}.txt`)).toBeVisible();
    assertNoProductionRuntimeErrors();
  });

  test("withdraws a successful upload before retry without leaving it attached", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page, {
      allowForcedResourceFailure: true,
    });
    const stamp = Date.now();
    const keepPath = writeFixture(`keep-${stamp}.txt`, "keep this file");
    const dropPath = writeFixture(`drop-${stamp}.txt`, "withdraw this file");
    let createDraftCalls = 0;
    let failNextStorageUpload = true;

    await page.route(
      "**/rest/v1/rpc/create_suggestion_draft",
      async (route) => {
        createDraftCalls += 1;
        await route.continue();
      },
    );
    await page.route("**/storage/v1/object/**", async (route) => {
      if (route.request().method() === "POST" && failNextStorageUpload) {
        failNextStorageUpload = false;
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ message: "forced upload failure" }),
        });
        return;
      }
      await route.continue();
    });

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await fillSuggestionIdea(
      page,
      `Withdraw upload ${stamp}`,
      "Remove the successful file before retry",
    );
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles([dropPath, keepPath]);
    await page.getByTestId("suggestion-submit-button").click();

    await expect(page.getByTestId("suggestion-submit-error")).toContainText(
      "Some evidence could not be attached",
    );
    await expect(page.getByText(`drop-${stamp}.txt`)).toBeVisible();
    await expect(page.getByText(`keep-${stamp}.txt`)).toBeVisible();

    const uploadedItem = page.locator('[data-status="uploaded"]');
    await uploadedItem.getByRole("button", { name: "Remove" }).click();
    await expect(uploadedItem).toHaveCount(0);

    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    expect(createDraftCalls).toBe(1);
    await openEvidenceTab(page);
    await expect(page.getByText(`keep-${stamp}.txt`)).toBeVisible();
    await expect(page.getByText(`drop-${stamp}.txt`)).toHaveCount(0);
    assertNoProductionRuntimeErrors();
  });

  test("successful upload then failed submit retries the same draft", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page, {
      allowForcedResourceFailure: true,
    });
    const stamp = Date.now();
    const notePath = writeFixture(
      `submit-retry-${stamp}.txt`,
      "ready to submit",
    );
    let createDraftCalls = 0;
    let failNextSubmit = true;

    await page.route(
      "**/rest/v1/rpc/create_suggestion_draft",
      async (route) => {
        createDraftCalls += 1;
        await route.continue();
      },
    );
    await page.route("**/rest/v1/rpc/submit_suggestion", async (route) => {
      if (failNextSubmit) {
        failNextSubmit = false;
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "P0001",
            message: "suggestion is not submittable",
          }),
        });
        return;
      }
      await route.continue();
    });

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await fillSuggestionIdea(
      page,
      `Submit retry ${stamp}`,
      "Retry submit after evidence is attached",
    );
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles(notePath);
    await page.getByTestId("suggestion-submit-button").click();

    await expect(page.getByTestId("suggestion-submit-error")).toBeVisible();
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    expect(createDraftCalls).toBe(1);

    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    expect(createDraftCalls).toBe(1);
    await openEvidenceTab(page);
    await expect(page.getByText(`submit-retry-${stamp}.txt`)).toBeVisible();
    assertNoProductionRuntimeErrors();
  });

  test("restricted users and other organisations cannot attach or read", async ({
    page,
  }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    const stamp = Date.now();
    const notePath = writeFixture(`deny-${stamp}.txt`, "author only");

    await signInAsDemoUser(page, "operator");
    await page.goto("/platform/suggestions/new");
    await fillSuggestionIdea(
      page,
      `Isolation idea ${stamp}`,
      "Evidence stays on the author suggestion",
    );
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles(notePath);
    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    const suggestionId = page.url().split("/").pop();
    expect(suggestionId).toMatch(/[0-9a-f-]{36}/);

    const financeClient = await signInRpcClient(
      DEMO_USERS.finance.email,
      DEMO_USERS.finance.password,
      "apex-manufacturing",
    );
    const { error: restrictedError } = await financeClient.rpc(
      "initiate_attachment_upload",
      {
        target_resource_id: suggestionId,
        target_filename: "denied.txt",
        target_mime_type: "text/plain",
        target_byte_size: 12,
      },
    );
    expect(restrictedError).toBeTruthy();

    const { data: financeRows } = await financeClient
      .from("attachments")
      .select("id")
      .eq("target_resource_id", suggestionId);
    expect(financeRows ?? []).toHaveLength(1);

    const contributorClient = await signInRpcClient(
      DEMO_USERS.psContributor.email,
      DEMO_USERS.psContributor.password,
      "apex-manufacturing",
    );
    const { error: contributorUploadError } = await contributorClient.rpc(
      "initiate_attachment_upload",
      {
        target_resource_id: suggestionId,
        target_filename: "denied-contributor.txt",
        target_mime_type: "text/plain",
        target_byte_size: 12,
      },
    );
    expect(contributorUploadError).toBeTruthy();

    const { data: contributorRows } = await contributorClient
      .from("attachments")
      .select("id")
      .eq("target_resource_id", suggestionId);
    expect(contributorRows ?? []).toEqual([]);

    await ensureOnboardingE2eOrganisation();
    const foreignClient = await signInRpcClient(
      onboardingE2eCredentials.email,
      onboardingE2eCredentials.password,
      onboardingE2eCredentials.organisationCode,
    );
    const { error: crossOrgError } = await foreignClient.rpc(
      "initiate_attachment_upload",
      {
        target_resource_id: suggestionId,
        target_filename: "forged.txt",
        target_mime_type: "text/plain",
        target_byte_size: 12,
      },
    );
    expect(crossOrgError).toBeTruthy();

    const { data: foreignRows } = await foreignClient
      .from("attachments")
      .select("id")
      .eq("target_resource_id", suggestionId);
    expect(foreignRows ?? []).toEqual([]);

    assertNoProductionRuntimeErrors();
  });

  test("desktop and 390px layouts stay usable", async ({ page }) => {
    const assertNoProductionRuntimeErrors = trackProductionRuntimeErrors(page);
    const stamp = Date.now();
    const notePath = writeFixture(`mobile-${stamp}.txt`, "layout check");

    await signInAsDemoUser(page, "operator");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/platform/suggestions/new");
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await expect(page.getByTestId("suggestion-evidence-picker")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await expect(
      page.getByTestId("suggestion-evidence-file-input"),
    ).toBeAttached();
    await page
      .getByTestId("suggestion-evidence-file-input")
      .setInputFiles(notePath);
    await expect(page.getByText(`mobile-${stamp}.txt`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await fillSuggestionIdea(
      page,
      `Mobile idea ${stamp}`,
      "Check the form on a narrow handset",
    );
    await page.getByTestId("suggestion-submit-button").click();
    await expect(page.getByTestId("suggestion-detail-page")).toBeVisible();
    await openEvidenceTab(page);
    await expect(page.getByText(`mobile-${stamp}.txt`)).toBeVisible();
    await assertNoHorizontalOverflow(page);
    assertNoProductionRuntimeErrors();
  });
});
