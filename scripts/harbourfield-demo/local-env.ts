import { execSync } from "node:child_process";

import {
  assertHarbourfieldLocalCommandAllowed,
  isLocalSupabaseUrl,
} from "./guards";

export type HarbourfieldLocalEnv = {
  apiUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
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
    "demo:harbourfield:top-up" | "demo:harbourfield:top-up:dry-run",
): HarbourfieldLocalEnv {
  let output = "";

  try {
    output = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      "Local Supabase is not running. Start it with `npm run db:start` before running Harbourfield demo top-up.",
      { cause: error },
    );
  }

  const values = parseSupabaseStatusEnv(output);
  const apiUrl = values.API_URL;

  if (!apiUrl || !values.SERVICE_ROLE_KEY || !values.PUBLISHABLE_KEY) {
    throw new Error(
      "Unable to read local Supabase credentials from `supabase status -o env`.",
    );
  }

  assertHarbourfieldLocalCommandAllowed(apiUrl, lifecycleEvent);

  if (!isLocalSupabaseUrl(apiUrl)) {
    throw new Error(
      `Harbourfield demo top-up refused because Supabase status reported a non-local API URL: ${apiUrl}`,
    );
  }

  return {
    apiUrl,
    publishableKey: values.PUBLISHABLE_KEY,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
  };
}
