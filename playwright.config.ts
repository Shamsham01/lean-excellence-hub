import { execSync } from "node:child_process";

import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;

function loadLocalSupabaseEnv(): Record<string, string> {
  if (process.env.E2E_WITH_SUPABASE !== "1") {
    return {};
  }

  try {
    const output = execSync("npx supabase status -o json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const status = JSON.parse(output) as {
      API_URL?: string;
      ANON_KEY?: string;
      SERVICE_ROLE_KEY?: string;
    };

    return {
      ...(status.API_URL ? { NEXT_PUBLIC_SUPABASE_URL: status.API_URL } : {}),
      ...(status.ANON_KEY
        ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY }
        : {}),
      ...(status.SERVICE_ROLE_KEY
        ? { SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY }
        : {}),
    };
  } catch {
    return {};
  }
}

const localSupabaseEnv = loadLocalSupabaseEnv();

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      APP_ORIGIN: baseURL,
      AUTH_RATE_LIMIT_PEPPER:
        process.env.AUTH_RATE_LIMIT_PEPPER ??
        "playwright-only-pepper-that-is-at-least-32-characters",
      E2E_WITH_SUPABASE: process.env.E2E_WITH_SUPABASE ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        localSupabaseEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "sb_publishable_playwright_placeholder",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        localSupabaseEnv.NEXT_PUBLIC_SUPABASE_URL ??
        "http://127.0.0.1:54321",
      SUPABASE_SECRET_KEY:
        process.env.SUPABASE_SECRET_KEY ??
        localSupabaseEnv.SUPABASE_SECRET_KEY ??
        "sb_secret_playwright_placeholder",
      AI_ENABLED:
        process.env.E2E_WITH_SUPABASE === "1"
          ? "1"
          : (process.env.AI_ENABLED ?? "0"),
      AI_PROVIDER:
        process.env.E2E_WITH_SUPABASE === "1"
          ? "fake"
          : (process.env.AI_PROVIDER ?? "openai"),
      AI_ALLOW_FAKE_PROVIDER: process.env.E2E_WITH_SUPABASE === "1" ? "1" : "0",
    },
    reuseExistingServer: !process.env.CI,
    url: baseURL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
