import { existsSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_SUPABASE_URL_PATTERN =
  /^https?:\/\/(127\.0\.0\.1|localhost):54321\b/;

export function isLocalSupabaseUrl(url: string) {
  return LOCAL_SUPABASE_URL_PATTERN.test(url);
}

export function assertDemoSeedAllowed(apiUrl: string) {
  const invokedViaNpmScript =
    process.env.npm_lifecycle_event === "db:seed-demo";
  const explicitlyAllowed = process.env.LEANHUB_ALLOW_DEMO_SEED === "1";

  if (!invokedViaNpmScript && !explicitlyAllowed) {
    throw new Error(
      "Demo seed is blocked. Run `npm run db:seed-demo` or set LEANHUB_ALLOW_DEMO_SEED=1 for an explicit local-only run.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed cannot run with NODE_ENV=production.");
  }

  if (!isLocalSupabaseUrl(apiUrl)) {
    throw new Error(
      `Demo seed is blocked for non-local Supabase URL: ${apiUrl}`,
    );
  }

  if (/\.supabase\.co\b/i.test(apiUrl)) {
    throw new Error("Demo seed is blocked for hosted Supabase projects.");
  }

  const linkedProjectRef = resolve(".supabase", "linked-project");
  if (existsSync(linkedProjectRef)) {
    throw new Error(
      "Demo seed is blocked while a linked Supabase project is configured. Use only the local Docker stack.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (databaseUrl && /\.supabase\.co\b/i.test(databaseUrl)) {
    throw new Error(
      "Demo seed is blocked because DATABASE_URL targets a hosted Supabase project.",
    );
  }
}
