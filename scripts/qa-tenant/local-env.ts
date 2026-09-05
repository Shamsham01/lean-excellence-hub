import { execSync } from "node:child_process";

import { assertQaLocalCommandAllowed } from "./guards";

export type LocalSupabaseEnv = {
  apiUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
};

function parseSupabaseStatusEnv(output: string) {
  const values: Record<string, string> = {};

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) {
      values[match[1]!] = match[2]!;
    }
  }

  return values;
}

export function loadLocalSupabaseEnv(
  lifecycleEvent:
    | "qa:cookie:seed"
    | "qa:cookie:reset"
    | "qa:cookie:inventory"
    | "qa:verify:clean-rebuild",
): LocalSupabaseEnv {
  let output = "";

  try {
    output = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      "Local Supabase is not running. Start it with `npm run db:start` before running QA tenant commands.",
      { cause: error },
    );
  }

  const values = parseSupabaseStatusEnv(output);
  const apiUrl = values.API_URL;
  const databaseUrl = values.DB_URL;

  if (
    !apiUrl ||
    !values.SERVICE_ROLE_KEY ||
    !values.PUBLISHABLE_KEY ||
    !databaseUrl
  ) {
    throw new Error(
      "Unable to read local Supabase credentials from `supabase status -o env`.",
    );
  }

  assertQaLocalCommandAllowed(apiUrl, lifecycleEvent);

  return {
    apiUrl,
    publishableKey: values.PUBLISHABLE_KEY,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
    databaseUrl,
  };
}

const DEFAULT_VERIFICATION_APP_ORIGIN = "http://127.0.0.1:3000";
const DEFAULT_VERIFICATION_AUTH_PEPPER =
  "ci-only-pepper-that-is-at-least-32-characters";

/**
 * Builds process env for verifier steps that require Supabase-backed Next.js
 * compilation (production build, smoke E2E).
 */
export function buildLocalVerificationEnv(
  lifecycleEvent:
    | "qa:cookie:seed"
    | "qa:cookie:reset"
    | "qa:cookie:inventory"
    | "qa:verify:clean-rebuild",
): NodeJS.ProcessEnv {
  const local = loadLocalSupabaseEnv(lifecycleEvent);

  return {
    ...process.env,
    APP_ORIGIN: process.env.APP_ORIGIN ?? DEFAULT_VERIFICATION_APP_ORIGIN,
    AUTH_RATE_LIMIT_PEPPER:
      process.env.AUTH_RATE_LIMIT_PEPPER ?? DEFAULT_VERIFICATION_AUTH_PEPPER,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
    SUPABASE_SECRET_KEY: local.serviceRoleKey,
  };
}
