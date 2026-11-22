import { expect, test } from "@playwright/test";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

test.describe("stale session redirect", () => {
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running Supabase auth stack",
  );

  test("sends corrupted refresh token sessions to login with next", async ({
    context,
    page,
  }) => {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0] || "127";
    const cookieName = `sb-${projectRef}-auth-token`;
    const staleSession = Buffer.from(
      JSON.stringify([
        {
          access_token: "stale-access-token",
          refresh_token: "stale-refresh-token-not-found",
          expires_at: 1,
          token_type: "bearer",
        },
      ]),
    ).toString("base64url");

    await context.addCookies([
      {
        name: cookieName,
        value: staleSession,
        url: "http://127.0.0.1:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/platform");

    await expect(page).toHaveURL(/\/login\?next=%2Fplatform/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText(/couldn.t load/i)).toHaveCount(0);
  });
});
