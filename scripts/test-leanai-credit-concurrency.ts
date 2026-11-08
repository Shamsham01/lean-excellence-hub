#!/usr/bin/env node
/**
 * Multi-connection concurrency proof via public.start_ai_run (production path).
 */
import { execSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type DbRow = Record<string, unknown>;

function runLocalQuery<T extends DbRow>(sql: string, context: string): T[] {
  const queryDirectory = mkdtempSync(join(tmpdir(), "leanai-credit-query-"));
  const queryFile = join(queryDirectory, "query.sql");
  writeFileSync(queryFile, sql, "utf8");
  try {
    const output = execSync(
      `npx supabase db query --local --output-format json -f ${JSON.stringify(queryFile)}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const jsonStart = output.indexOf("{");
    if (jsonStart === -1) throw new Error(`${context}: bad output`);
    const parsed = JSON.parse(output.slice(jsonStart)) as {
      rows?: T[];
      error?: { message?: string };
    };
    if (parsed.error?.message) throw new Error(`${context}: ${parsed.error.message}`);
    return parsed.rows ?? [];
  } finally {
    rmSync(queryDirectory, { recursive: true, force: true });
  }
}

function runQueryAsync(sql: string): Promise<{ ok: boolean; error?: string }> {
  const queryDirectory = mkdtempSync(join(tmpdir(), "leanai-credit-async-"));
  const queryFile = join(queryDirectory, "query.sql");
  writeFileSync(queryFile, sql, "utf8");
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["supabase", "db", "query", "--local", "--output-format", "json", "-f", queryFile],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("close", (code) => {
      rmSync(queryDirectory, { recursive: true, force: true });
      if (code !== 0) {
        resolve({ ok: false, error: stderr || stdout });
        return;
      }
      resolve({ ok: !/leanai credit allowance exceeded/i.test(stdout + stderr) });
    });
  });
}

async function main() {
  const userId = "b2700000-0000-4000-8000-000000000001";
  const sessionId = "b2710000-0000-4000-8000-000000000001";
  const orgCode = `credit-cc-${randomUUID().slice(0, 8)}`;

  runLocalQuery(
    `
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values ('${userId}', 'credit-cc@example.test', now(), now(), now(), '{"provider":"email"}', '{}', false, false)
on conflict (id) do nothing;
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('${sessionId}', '${userId}', now(), now())
on conflict (id) do nothing;
`,
    "auth",
  );

  const provisioned = runLocalQuery<{ organisation_id: string }>(
    `select private.provision_organisation('${userId}', '${orgCode}', 'Credit CC Org') as organisation_id;`,
    "provision",
  );
  const organisationId = provisioned[0]?.organisation_id;
  if (!organisationId) throw new Error("provision missing organisation id");

  runLocalQuery(
    `
select public.apply_organisation_subscription_snapshot(
  '${organisationId}'::uuid, 'fake','cus','sub','professional','monthly',1,'price','active','active', now(), now() + interval '30 days', false, timestamptz '2026-11-08 14:10:00+00'
);
insert into public.organisation_ai_settings (organisation_id, ai_enabled, credit_policy_enforced)
values ('${organisationId}'::uuid, true, true)
on conflict (organisation_id) do update set credit_policy_enforced = true, ai_enabled = true;
select private.ensure_organisation_ai_credit_period('${organisationId}'::uuid);
update public.organisation_ai_credit_periods set allowance_credits = 1
where organisation_id = '${organisationId}'::uuid;
`,
    "policy",
  );

  const coachRows = runLocalQuery<{ coach_session_id: string }>(
    `
select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated","session_id":"${sessionId}"}', true);
set role authenticated;
select public.switch_organisation('${organisationId}'::uuid);
select public.create_ai_coach_session(
  'onboarding', 'structure_first', 'Explain', '1.0'
) as coach_session_id;
`,
    "coach session",
  );
  const aiSessionId = coachRows[0]?.coach_session_id;
  if (!aiSessionId) throw new Error("coach session not created");

  const startSql = (idempotencyKey: string) => `
select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated","session_id":"${sessionId}"}', true);
set role authenticated;
select public.switch_organisation('${organisationId}'::uuid);
select public.start_ai_run(
  '${aiSessionId}'::uuid,
  'hello',
  '${idempotencyKey}',
  'fake',
  'fake-model',
  'coach',
  '1',
  'hash-${idempotencyKey}'
);
`;

  const [a, b] = await Promise.all([
    runQueryAsync(startSql("cc-start-a")),
    runQueryAsync(startSql("cc-start-b")),
  ]);
  const successes = [a, b].filter((r) => r.ok).length;
  if (successes !== 1) {
    throw new Error(`expected one start_ai_run reserve winner, got ${successes}`);
  }

  const reservations = runLocalQuery<{ count: number }>(
    `
select count(*)::int as count
from public.organisation_ai_credit_reservations
where organisation_id = '${organisationId}'::uuid and status = 'reserved';
`,
    "reservations",
  );
  if ((reservations[0]?.count ?? 0) !== 1) {
    throw new Error(`expected one reserved row, got ${reservations[0]?.count}`);
  }

  console.log(JSON.stringify({ ok: true, organisationId, successes }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
