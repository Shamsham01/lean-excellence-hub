import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  QA_HOSTED_RESET_CONFIRM_TOKEN,
  QA_ORGANISATION_CODE,
} from "./constants";
import {
  HOSTED_PRELAUNCH_PROJECT_REF,
  LEGACY_HOSTED_DEMO_ORGANISATION,
  QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN,
} from "./legacy-hosted-demo";

const LOCAL_SUPABASE_URL_PATTERN =
  /^https?:\/\/(127\.0\.0\.1|localhost):54321\b/;

export function isLocalSupabaseUrl(url: string) {
  return LOCAL_SUPABASE_URL_PATTERN.test(url);
}

export function extractSupabaseProjectRef(url: string): string | null {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\b/i);
  return match?.[1] ?? null;
}

export function assertQaLocalCommandAllowed(
  apiUrl: string,
  lifecycleEvent:
    | "qa:cookie:seed"
    | "qa:cookie:reset"
    | "qa:cookie:inventory"
    | "qa:verify:clean-rebuild",
) {
  const invokedViaNpmScript =
    process.env.npm_lifecycle_event === lifecycleEvent;
  const explicitlyAllowed = process.env.LEANHUB_ALLOW_QA_TENANT === "1";

  if (!invokedViaNpmScript && !explicitlyAllowed) {
    throw new Error(
      `QA tenant command is blocked. Run \`npm run ${lifecycleEvent}\` or set LEANHUB_ALLOW_QA_TENANT=1.`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "QA tenant local commands cannot run with NODE_ENV=production.",
    );
  }

  if (!isLocalSupabaseUrl(apiUrl)) {
    throw new Error(
      `QA tenant local commands are blocked for non-local Supabase URL: ${apiUrl}`,
    );
  }

  if (/\.supabase\.co\b/i.test(apiUrl)) {
    throw new Error(
      "QA tenant local commands are blocked for hosted Supabase projects.",
    );
  }

  const linkedProjectRef = resolve(".supabase", "linked-project");
  if (existsSync(linkedProjectRef)) {
    throw new Error(
      "QA tenant local commands are blocked while a linked Supabase project is configured.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (databaseUrl && /\.supabase\.co\b/i.test(databaseUrl)) {
    throw new Error(
      "QA tenant local commands are blocked because DATABASE_URL targets hosted Supabase.",
    );
  }
}

export type HostedResetMode = "dry-run" | "destructive";

export function parseHostedResetArgs(argv: string[]) {
  const destructive = argv.includes("--destructive");
  return {
    mode: destructive ? ("destructive" as const) : ("dry-run" as const),
    destructive,
  };
}

export function assertHostedResetAllowed(options: {
  apiUrl: string;
  expectedProjectRef: string;
  organisationCode: string;
  mode: HostedResetMode;
}) {
  if (process.env.NEXT_RUNTIME) {
    throw new Error(
      "Hosted QA reset cannot run from Next.js application runtime.",
    );
  }

  if (!/\.supabase\.co\b/i.test(options.apiUrl)) {
    throw new Error(
      `Hosted QA reset requires a hosted Supabase API URL (*.supabase.co). Received: ${options.apiUrl}`,
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
      `Hosted QA reset refused: expected project ref ${options.expectedProjectRef}, actual ${actualProjectRef}.`,
    );
  }

  if (options.organisationCode !== QA_ORGANISATION_CODE) {
    throw new Error(
      `Hosted QA reset refused: organisation code must be exactly ${QA_ORGANISATION_CODE}.`,
    );
  }

  if (options.mode === "destructive") {
    if (
      process.env.LEANHUB_QA_RESET_CONFIRM !== QA_HOSTED_RESET_CONFIRM_TOKEN
    ) {
      throw new Error(
        `Destructive hosted QA reset requires LEANHUB_QA_RESET_CONFIRM=${QA_HOSTED_RESET_CONFIRM_TOKEN}.`,
      );
    }
  }
}

export function assertHostedSeedAllowed(options: {
  apiUrl: string;
  expectedProjectRef: string;
}) {
  if (process.env.NEXT_RUNTIME) {
    throw new Error(
      "Hosted CookieWorks seed cannot run from Next.js application runtime.",
    );
  }

  if (isLocalSupabaseUrl(options.apiUrl)) {
    throw new Error(
      `Hosted CookieWorks seed is blocked for local Supabase URLs: ${options.apiUrl}`,
    );
  }

  if (!/\.supabase\.co\b/i.test(options.apiUrl)) {
    throw new Error(
      `Hosted CookieWorks seed requires a hosted Supabase API URL (*.supabase.co). Received: ${options.apiUrl}`,
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
      `Hosted CookieWorks seed refused: expected project ref ${options.expectedProjectRef}, actual ${actualProjectRef}.`,
    );
  }
}

export function resolveHostedSeedCredentials() {
  const apiUrl = process.env.LEANHUB_QA_RESET_SUPABASE_URL;
  const serviceRoleKey = process.env.LEANHUB_QA_RESET_SERVICE_ROLE_KEY;
  const expectedProjectRef = process.env.LEANHUB_QA_RESET_PROJECT_REF;
  const publishableKey = process.env.LEANHUB_QA_RESET_PUBLISHABLE_KEY;
  const databaseUrl = process.env.LEANHUB_QA_RESET_DATABASE_URL;

  if (!apiUrl) {
    throw new Error(
      "Hosted CookieWorks seed requires LEANHUB_QA_RESET_SUPABASE_URL.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Hosted CookieWorks seed requires LEANHUB_QA_RESET_SERVICE_ROLE_KEY.",
    );
  }

  if (!expectedProjectRef) {
    throw new Error(
      "Hosted CookieWorks seed requires LEANHUB_QA_RESET_PROJECT_REF to match the target project exactly.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "Hosted CookieWorks seed requires LEANHUB_QA_RESET_PUBLISHABLE_KEY.",
    );
  }

  return {
    apiUrl,
    serviceRoleKey,
    expectedProjectRef,
    publishableKey,
    databaseUrl,
  };
}

export function resolveHostedCredentials() {
  const apiUrl =
    process.env.LEANHUB_QA_RESET_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.LEANHUB_QA_RESET_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const expectedProjectRef = process.env.LEANHUB_QA_RESET_PROJECT_REF;
  const databaseUrl =
    process.env.LEANHUB_QA_RESET_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DB_URL;
  const publishableKey =
    process.env.LEANHUB_QA_RESET_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!apiUrl) {
    throw new Error(
      "Hosted QA reset requires LEANHUB_QA_RESET_SUPABASE_URL (or SUPABASE_URL).",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Hosted QA reset requires LEANHUB_QA_RESET_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  if (!expectedProjectRef) {
    throw new Error(
      "Hosted QA reset requires LEANHUB_QA_RESET_PROJECT_REF to match the target project exactly.",
    );
  }

  if (!databaseUrl) {
    throw new Error(
      "Hosted QA reset requires LEANHUB_QA_RESET_DATABASE_URL (or DATABASE_URL) for scoped deletion SQL.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "Hosted QA reset requires LEANHUB_QA_RESET_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) for foundation re-seed.",
    );
  }

  return {
    apiUrl,
    serviceRoleKey,
    expectedProjectRef,
    databaseUrl,
    publishableKey,
  };
}

export function assertHostedReplacementAllowed(options: {
  apiUrl: string;
  expectedProjectRef: string;
  mode: HostedResetMode;
}) {
  if (process.env.NEXT_RUNTIME) {
    throw new Error(
      "Hosted QA tenant replacement cannot run from Next.js application runtime.",
    );
  }

  if (!/\.supabase\.co\b/i.test(options.apiUrl)) {
    throw new Error(
      `Hosted QA tenant replacement requires a hosted Supabase API URL (*.supabase.co). Received: ${options.apiUrl}`,
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
      `Hosted QA tenant replacement refused: expected project ref ${options.expectedProjectRef}, actual ${actualProjectRef}.`,
    );
  }

  if (options.expectedProjectRef !== HOSTED_PRELAUNCH_PROJECT_REF) {
    throw new Error(
      `Hosted QA tenant replacement refused: project ref must be exactly ${HOSTED_PRELAUNCH_PROJECT_REF}.`,
    );
  }

  if (options.mode === "destructive") {
    if (
      process.env.LEANHUB_QA_RESET_CONFIRM !==
      QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN
    ) {
      throw new Error(
        `Destructive hosted QA tenant replacement requires LEANHUB_QA_RESET_CONFIRM=${QA_HOSTED_REPLACEMENT_CONFIRM_TOKEN}.`,
      );
    }
  }
}

export function assertLegacyHostedDemoTargetContract() {
  if (
    LEGACY_HOSTED_DEMO_ORGANISATION.code !== "lean-excellence-demo" ||
    LEGACY_HOSTED_DEMO_ORGANISATION.id !==
      "402811bb-aa05-4128-b7e5-a1e3b359b92e"
  ) {
    throw new Error(
      "Legacy hosted demo contract constants are malformed in repository.",
    );
  }
}
