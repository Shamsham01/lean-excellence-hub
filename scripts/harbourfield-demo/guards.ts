import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  HARBOURFIELD_HOSTED_APPLY_CONFIRM_TOKEN,
  HARBOURFIELD_ORGANISATION_CODE,
} from "./constants";

const LOCAL_SUPABASE_URL_PATTERN =
  /^https?:\/\/(127\.0\.0\.1|localhost):54321\b/;

export type HarbourfieldDemoTarget = "local" | "hosted";
export type HarbourfieldDemoMode = "dry-run" | "apply";

export function isLocalSupabaseUrl(url: string) {
  return LOCAL_SUPABASE_URL_PATTERN.test(url);
}

export function extractSupabaseProjectRef(url: string): string | null {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\b/i);
  return match?.[1] ?? null;
}

export function parseHarbourfieldDemoArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const hosted = argv.includes("--hosted");
  return {
    mode: apply ? ("apply" as const) : ("dry-run" as const),
    target: hosted ? ("hosted" as const) : ("local" as const),
    apply,
    hosted,
  };
}

export function assertHarbourfieldLocalCommandAllowed(
  apiUrl: string,
  lifecycleEvent:
    "demo:harbourfield:top-up" | "demo:harbourfield:top-up:dry-run",
) {
  const invokedViaNpmScript =
    process.env.npm_lifecycle_event === lifecycleEvent ||
    process.env.npm_lifecycle_event === "demo:harbourfield:top-up";
  const explicitlyAllowed = process.env.LEANHUB_ALLOW_HARBOURFIELD_DEMO === "1";

  if (!invokedViaNpmScript && !explicitlyAllowed) {
    throw new Error(
      `Harbourfield demo top-up is blocked. Run \`npm run ${lifecycleEvent}\` or set LEANHUB_ALLOW_HARBOURFIELD_DEMO=1.`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Harbourfield demo top-up cannot run with NODE_ENV=production.",
    );
  }

  if (!isLocalSupabaseUrl(apiUrl)) {
    throw new Error(
      `Harbourfield demo local top-up is blocked for non-local Supabase URL: ${apiUrl}`,
    );
  }

  if (/\.supabase\.co\b/i.test(apiUrl)) {
    throw new Error(
      "Harbourfield demo local top-up is blocked for hosted Supabase projects.",
    );
  }

  const linkedProjectRef = resolve(".supabase", "linked-project");
  if (existsSync(linkedProjectRef)) {
    throw new Error(
      "Harbourfield demo local top-up is blocked while a linked Supabase project is configured.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (databaseUrl && /\.supabase\.co\b/i.test(databaseUrl)) {
    throw new Error(
      "Harbourfield demo local top-up is blocked because DATABASE_URL targets hosted Supabase.",
    );
  }
}

export function resolveHarbourfieldHostedCredentials() {
  const apiUrl = process.env.LEANHUB_HARBOURFIELD_DEMO_SUPABASE_URL;
  const serviceRoleKey = process.env.LEANHUB_HARBOURFIELD_DEMO_SERVICE_ROLE_KEY;
  const expectedProjectRef = process.env.LEANHUB_HARBOURFIELD_DEMO_PROJECT_REF;
  const publishableKey = process.env.LEANHUB_HARBOURFIELD_DEMO_PUBLISHABLE_KEY;
  const organisationCode =
    process.env.LEANHUB_HARBOURFIELD_ORG_CODE ?? HARBOURFIELD_ORGANISATION_CODE;
  const organisationId = process.env.LEANHUB_HARBOURFIELD_ORG_ID;
  const adminEmail = process.env.LEANHUB_HARBOURFIELD_DEMO_ADMIN_EMAIL;
  const adminPassword = process.env.LEANHUB_HARBOURFIELD_DEMO_ADMIN_PASSWORD;

  if (!apiUrl) {
    throw new Error(
      "Hosted Harbourfield demo top-up requires LEANHUB_HARBOURFIELD_DEMO_SUPABASE_URL.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Hosted Harbourfield demo top-up requires LEANHUB_HARBOURFIELD_DEMO_SERVICE_ROLE_KEY.",
    );
  }

  if (!expectedProjectRef) {
    throw new Error(
      "Hosted Harbourfield demo top-up requires LEANHUB_HARBOURFIELD_DEMO_PROJECT_REF.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "Hosted Harbourfield demo top-up requires LEANHUB_HARBOURFIELD_DEMO_PUBLISHABLE_KEY.",
    );
  }

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Hosted Harbourfield demo top-up requires LEANHUB_HARBOURFIELD_DEMO_ADMIN_EMAIL and LEANHUB_HARBOURFIELD_DEMO_ADMIN_PASSWORD.",
    );
  }

  return {
    apiUrl,
    serviceRoleKey,
    expectedProjectRef,
    publishableKey,
    organisationCode,
    organisationId,
    adminEmail,
    adminPassword,
  };
}

export function assertHarbourfieldHostedTopUpAllowed(options: {
  apiUrl: string;
  expectedProjectRef: string;
  organisationCode: string;
  mode: HarbourfieldDemoMode;
}) {
  if (process.env.NEXT_RUNTIME) {
    throw new Error(
      "Harbourfield demo top-up cannot run from Next.js application runtime.",
    );
  }

  if (isLocalSupabaseUrl(options.apiUrl)) {
    throw new Error(
      `Hosted Harbourfield demo top-up is blocked for local Supabase URLs: ${options.apiUrl}`,
    );
  }

  if (!/\.supabase\.co\b/i.test(options.apiUrl)) {
    throw new Error(
      `Hosted Harbourfield demo top-up requires a hosted Supabase API URL (*.supabase.co). Received: ${options.apiUrl}`,
    );
  }

  const actualProjectRef = extractSupabaseProjectRef(options.apiUrl);
  if (!actualProjectRef) {
    throw new Error(
      `Unable to resolve Supabase project reference from API URL: ${options.apiUrl}`,
    );
  }

  if (actualProjectRef !== options.expectedProjectRef) {
    throw new Error(
      `Hosted Harbourfield demo top-up refused: expected project ref ${options.expectedProjectRef}, actual ${actualProjectRef}.`,
    );
  }

  const forbiddenOrganisationCodes = [
    "apex-manufacturing",
    "cookieworks-manufacturing",
    "lean-excellence-demo",
  ] as const;

  if (
    forbiddenOrganisationCodes.includes(
      options.organisationCode as (typeof forbiddenOrganisationCodes)[number],
    )
  ) {
    throw new Error(
      `Hosted Harbourfield demo top-up refused: organisation code ${options.organisationCode} is not the Harbourfield demo tenant.`,
    );
  }

  if (options.mode === "apply") {
    if (
      process.env.LEANHUB_HARBOURFIELD_DEMO_CONFIRM !==
      HARBOURFIELD_HOSTED_APPLY_CONFIRM_TOKEN
    ) {
      throw new Error(
        `Hosted apply requires LEANHUB_HARBOURFIELD_DEMO_CONFIRM=${HARBOURFIELD_HOSTED_APPLY_CONFIRM_TOKEN}.`,
      );
    }
  }
}
