#!/usr/bin/env node
/**
 * Multi-connection proof using public.start_ai_run (not helper-only reserve).
 */
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PSQL_EXEC = [
  "docker",
  "exec",
  "-i",
  "supabase_db_lean-excellence-hub",
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
] as const;

function runPsqlFile(file: string, json = false): string {
  const jsonFlag = json ? ["-t", "-A", "-F", "|"] : [];
  return execFileSync(PSQL_EXEC[0], [...PSQL_EXEC.slice(1), ...jsonFlag], {
    encoding: "utf-8",
    input: readFileSync(file),
  });
}

function runPsqlStatements(statements: string[], context: string): void {
  const dir = mkdtempSync(join(tmpdir(), "leanai-cc-"));
  const file = join(dir, "q.sql");
  writeFileSync(file, `${statements.join("\n")}\n`, "utf8");
  try {
    runPsqlFile(file, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withAuthTransaction(statements: string[]): string[] {
  return ["begin;", ...statements, "commit;"];
}

function runPsqlScript(
  statements: string | string[],
  context: string,
  transactional = false,
): string {
  const dir = mkdtempSync(join(tmpdir(), "leanai-cc-script-"));
  const file = join(dir, "q.sql");
  const stmts = Array.isArray(statements) ? statements : [statements.trim()];
  const body = transactional ? withAuthTransaction(stmts) : stmts;
  writeFileSync(file, `${body.join("\n")}\n`, "utf8");
  try {
    return runPsqlFile(file, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runPsqlQuery<T extends Record<string, unknown>>(
  sql: string,
  context: string,
): T[] {
  const dir = mkdtempSync(join(tmpdir(), "leanai-cc-q-"));
  const file = join(dir, "q.sql");
  writeFileSync(file, `${sql.trim()}\n`, "utf8");
  try {
    const raw = runPsqlFile(file, true).trim();
    if (!raw) return [];
    const lines = raw.split("\n").filter(Boolean);
    const firstPipe = lines[0]?.includes("|") ?? false;
    if (!firstPipe && lines.length === 1) {
      const sqlLower = sql.toLowerCase();
      const alias = sqlLower.match(/as\s+(\w+)\s*;?\s*$/s)?.[1] ?? "value";
      return [{ [alias]: lines[0] } as T];
    }
    const [header, ...data] = lines;
    const keys = header.split("|");
    return data.map((line) => {
      const cols = line.split("|");
      const row: Record<string, unknown> = {};
      keys.forEach((key, i) => {
        row[key] = cols[i];
      });
      return row as T;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runAsyncPsqlFile(
  file: string,
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const child = spawn(PSQL_EXEC[0], PSQL_EXEC.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.write(readFileSync(file));
    child.stdin.end();
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => {
      out += c.toString();
    });
    child.stderr.on("data", (c) => {
      err += c.toString();
    });
    child.on("close", (code) => {
      const text = out + err;
      if (code !== 0) {
        resolve({
          ok: false,
          detail: text.includes("allowance exceeded") ? "rejected" : text,
        });
        return;
      }
      resolve({ ok: true, detail: text });
    });
  });
}

async function main() {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const userEmail = `cc-${randomUUID().slice(0, 8)}@example.test`;
  const orgCode = `cc-${randomUUID().slice(0, 8)}`;
  const stripeCustomerId = `cus_cc_${randomUUID().slice(0, 8)}`;
  const stripeSubscriptionId = `sub_cc_${randomUUID().slice(0, 8)}`;

  runPsqlStatements(
    [
      `insert into auth.users (id,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
values ('${userId}','${userEmail}',now(),now(),now(),'{"provider":"email"}','{}',false,false);`,
      `insert into auth.sessions (id,user_id,created_at,updated_at) values ('${sessionId}','${userId}',now(),now()) on conflict do nothing;`,
    ],
    "auth",
  );

  const provisioned = runPsqlQuery<{ organisation_id: string }>(
    `select private.provision_organisation('${userId}','${orgCode}','CC Org') as organisation_id;`,
    "provision",
  );
  const organisationId = provisioned[0]?.organisation_id;
  if (!organisationId) throw new Error("missing org");

  const upperRows = runPsqlQuery<{ upper: string }>(
    `select private.leanai_ai_run_reserve_upper_bound('${organisationId}'::uuid,'fake','fake-model','concurrent probe')::text as upper;`,
    "upper bound",
  );
  const reserveUpper = upperRows[0]?.upper;
  if (!reserveUpper) throw new Error("missing reserve upper bound");

  runPsqlStatements(
    [
      `select public.apply_organisation_subscription_snapshot('${organisationId}'::uuid,'fake','${stripeCustomerId}','${stripeSubscriptionId}','professional','monthly',1,'p','active','active',now(),now()+interval '30 days',false,timestamptz '2026-11-08 16:00:00+00');`,
      `insert into public.organisation_ai_settings (organisation_id,ai_enabled,credit_policy_enforced) values ('${organisationId}'::uuid,true,true)
on conflict (organisation_id) do update set credit_policy_enforced=true, ai_enabled=true;`,
      `update private.identity_controls set status='active', enrolment_status='complete', enrolment_completed_at=now() where user_id='${userId}'::uuid;`,
      `select private.ensure_organisation_ai_credit_period('${organisationId}'::uuid);`,
      `update public.organisation_ai_credit_periods set allowance_credits = ${reserveUpper}::bigint where organisation_id='${organisationId}'::uuid;`,
    ],
    "tight allowance",
  );

  const coachOut = runPsqlScript(
    [
      `select set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated","session_id":"${sessionId}","email":"${userEmail}"}',true);`,
      `set local role authenticated;`,
      `select public.switch_organisation('${organisationId}'::uuid);`,
      `select public.create_ai_coach_session('onboarding','structure_first',null,'Explain','coach-session-v1');`,
    ],
    "coach",
    true,
  );
  const coachMatch = coachOut.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  );
  const aiSessionId = coachMatch?.at(-1);
  if (!aiSessionId) throw new Error(`coach session missing (${coachOut})`);

  const startSqlPath = (key: string) => {
    const dir = mkdtempSync(join(tmpdir(), "leanai-cc-start-"));
    const file = join(dir, `start-${key}.sql`);
    writeFileSync(
      file,
      `
begin;
select set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated","session_id":"${sessionId}","email":"${userEmail}"}',true);
set local role authenticated;
select public.switch_organisation('${organisationId}'::uuid);
select public.start_ai_run(
  '${aiSessionId}'::uuid,
  'concurrent ${key}',
  '${key}',
  'fake',
  'fake-model',
  'coach',
  '1',
  'hash-${key}'
);
commit;
`,
      "utf8",
    );
    return { dir, file };
  };

  const startA = startSqlPath("cc-a");
  const startB = startSqlPath("cc-b");
  try {
    const [a, b] = await Promise.all([
      runAsyncPsqlFile(startA.file),
      runAsyncPsqlFile(startB.file),
    ]);
    const winners = [a, b].filter((r) => r.ok).length;
    if (winners !== 1) {
      throw new Error(
        `expected 1 concurrent start_ai_run, got ${winners} (${JSON.stringify({ a, b })})`,
      );
    }
  } finally {
    rmSync(startA.dir, { recursive: true, force: true });
    rmSync(startB.dir, { recursive: true, force: true });
  }

  const countRaw = runPsqlScript(
    `select count(*)::int from public.organisation_ai_credit_reservations where organisation_id='${organisationId}'::uuid and status='reserved';`,
    "count",
  );
  const reservationCount = Number.parseInt(
    countRaw.match(/\d+/)?.[0] ?? "0",
    10,
  );
  if (reservationCount !== 1) {
    throw new Error(
      `expected 1 reservation, got ${reservationCount} (org=${organisationId})`,
    );
  }

  const reservedRaw = runPsqlScript(
    `select reserved_credits::text from public.organisation_ai_credit_reservations where organisation_id='${organisationId}'::uuid and status='reserved' limit 1;`,
    "reserved amount",
  );
  const reservedCredits = reservedRaw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^\d+$/.test(line));
  if (reservedCredits !== reserveUpper) {
    throw new Error(
      `reservation must match cost upper bound: reserved=${reservedCredits} upper=${reserveUpper}`,
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      organisationId,
      reserved_credits: reservedCredits,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
