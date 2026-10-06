import { expect, test } from "@playwright/test";

import {
  ensureInvitationLifecycleUser,
  getInvitationLifecycleClients,
} from "./helpers/invitation-lifecycle";
import { fetchLatestEmailHrefWithRetry } from "./helpers/mailpit";

const e2eOrigin = "http://127.0.0.1:3000";
const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const OLD_PASSWORD = "RecoveryOld-Pass123!";
const NEW_PASSWORD = "RecoveryNew-Pass456!";

function toE2eOriginUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const parsed = new URL(pathOrUrl);
    return `${e2eOrigin}${parsed.pathname}${parsed.search}`;
  }

  return `${e2eOrigin}${pathOrUrl}`;
}

function uniqueRecoveryEmail(label: string) {
  return `recovery-e2e-${label}-${Date.now()}@example.test`;
}

async function submitRecoveryRequest(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/recover");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await expect(page.getByTestId("recover-sent")).toBeVisible();
  await expect(page.getByTestId("recover-sent")).toHaveText(
    /if an eligible account exists, recovery instructions have been sent/i,
  );
  await expect(page.getByText(/account already exists/i)).toHaveCount(0);
  await expect(page.getByText(/no account found/i)).toHaveCount(0);
}

async function stageAndContinueRecovery(
  page: import("@playwright/test").Page,
  href: string,
) {
  await page.goto(toE2eOriginUrl(href));
  await expect(page).toHaveURL(/\/recover\?continue=true/);
  await expect(page.getByTestId("recover-staged")).toBeVisible();
  expect(page.url()).not.toContain("token_hash=");
  expect(page.url()).not.toContain("code=");
  await page
    .getByRole("button", { name: "Continue account recovery" })
    .click();
}

async function signOut(page: import("@playwright/test").Page) {
  await page.request.post("/auth/signout", {
    form: { next: "/login" },
  });
}

async function submitEmailLogin(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Email sign in" }).click();
}

test.describe("Password recovery", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and local Supabase",
  );

  test(
    "real recovery email survives GET prefetch and replaces the credential",
    async ({ page, browser }) => {
      const email = uniqueRecoveryEmail("happy");
      const { admin } = getInvitationLifecycleClients();
      await ensureInvitationLifecycleUser(admin, {
        email,
        password: OLD_PASSWORD,
      });

      await submitRecoveryRequest(page, email);

      const recoveryHref = await fetchLatestEmailHrefWithRetry(
        email,
        "/auth/recovery",
      );
      expect(recoveryHref).toContain("token_hash=");
      expect(recoveryHref).toContain("type=recovery");
      expect(recoveryHref).not.toContain("/auth/confirm");

      // Simulate a mail-security scanner following the GET in a separate context.
      // GET must not consume the single-use recovery OTP.
      const scannerContext = await browser.newContext();
      const scannerPage = await scannerContext.newPage();
      await scannerPage.goto(toE2eOriginUrl(recoveryHref));
      await expect(scannerPage).toHaveURL(/\/recover\?continue=true/);
      await scannerContext.close();

      await stageAndContinueRecovery(page, recoveryHref);
      await expect(page).toHaveURL(/\/update-password(?:\?|$)/);
      await expect(
        page.getByRole("heading", { name: "Set a new password" }),
      ).toBeVisible();

      await page.locator("#password").fill(NEW_PASSWORD);
      await page.getByRole("button", { name: "Update password" }).click();
      await expect(page).not.toHaveURL(/\/update-password(?:\?|$)/, {
        timeout: 30_000,
      });

      await signOut(page);

      await submitEmailLogin(page, email, OLD_PASSWORD);
      await expect(page).toHaveURL(/\/login\?error=invalid/);
      await expect(page.getByTestId("login-error")).toContainText(
        /unable to sign in\. check your email and password/i,
      );

      await submitEmailLogin(page, email, NEW_PASSWORD);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    },
  );

  test(
    "legacy /auth/confirm recovery links stage and complete recovery",
    async ({ page }) => {
      const email = uniqueRecoveryEmail("legacy-confirm");
      const { admin } = getInvitationLifecycleClients();
      await ensureInvitationLifecycleUser(admin, {
        email,
        password: OLD_PASSWORD,
      });

      await submitRecoveryRequest(page, email);
      const recoveryHref = await fetchLatestEmailHrefWithRetry(
        email,
        "/auth/recovery",
      );
      const confirmHref = recoveryHref.replace(
        "/auth/recovery",
        "/auth/confirm",
      );

      await stageAndContinueRecovery(page, confirmHref);
      await expect(page).toHaveURL(/\/update-password(?:\?|$)/);
      await expect(
        page.getByText("Unable to sign in with those credentials."),
      ).toHaveCount(0);
    },
  );

  test(
    "expired, malformed, replayed, and wrong-type links show recovery error UX",
    async ({ page, browser }) => {
      const email = uniqueRecoveryEmail("replay");
      const { admin } = getInvitationLifecycleClients();
      await ensureInvitationLifecycleUser(admin, {
        email,
        password: OLD_PASSWORD,
      });

      await submitRecoveryRequest(page, email);
      const recoveryHref = await fetchLatestEmailHrefWithRetry(
        email,
        "/auth/recovery",
      );

      await stageAndContinueRecovery(page, recoveryHref);
      await expect(page).toHaveURL(/\/update-password(?:\?|$)/);

      const replayContext = await browser.newContext();
      const replayPage = await replayContext.newPage();
      await replayPage.goto(toE2eOriginUrl(recoveryHref));
      await expect(replayPage).toHaveURL(/\/recover\?continue=true/);
      await replayPage
        .getByRole("button", { name: "Continue account recovery" })
        .click();
      await expect(replayPage).toHaveURL(/\/recover\?error=expired/);
      await expect(replayPage.getByTestId("recover-expired")).toBeVisible();
      await replayContext.close();

      await page.goto("/auth/recovery");
      await expect(page).toHaveURL(/\/recover\?error=expired/);

      await page.goto(
        "/auth/recovery?token_hash=not-a-real-token&type=recovery",
      );
      await expect(page).toHaveURL(/\/recover\?continue=true/);
      await page
        .getByRole("button", { name: "Continue account recovery" })
        .click();
      await expect(page).toHaveURL(/\/recover\?error=expired/);

      for (const type of ["signup", "invite", "magiclink"]) {
        await page.goto(
          `/auth/recovery?token_hash=abc123tokenhash&type=${type}`,
        );
        await expect(page).toHaveURL(/\/recover\?error=expired/);
      }
    },
  );

  test("anonymous update-password cannot change a password", async ({ page }) => {
    await page.goto("/update-password");
    await expect(page.getByTestId("update-password-session")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update password" }),
    ).toHaveCount(0);
  });

  test(
    "unknown and known recovery emails share the same sent state",
    async ({ page }) => {
      const knownEmail = uniqueRecoveryEmail("known-sent");
      const { admin } = getInvitationLifecycleClients();
      await ensureInvitationLifecycleUser(admin, {
        email: knownEmail,
        password: OLD_PASSWORD,
      });

      await submitRecoveryRequest(page, knownEmail);
      const knownCopy = await page.getByTestId("recover-sent").innerText();

      await submitRecoveryRequest(page, uniqueRecoveryEmail("unknown-sent"));
      await expect(page.getByTestId("recover-sent")).toHaveText(knownCopy);
    },
  );
});
