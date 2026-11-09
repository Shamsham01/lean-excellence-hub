#!/usr/bin/env node
/**
 * Two concurrent DB sessions delegate to different targets; exactly one active assignment remains.
 * Requires local Supabase. Run after `npm run db:reset` for deterministic acceptance.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function dockerDbExecArgs(sqlFile?: string, sqlCommand?: string): [string, string[]] {
  const container = execFileSync(
    "docker",
    ["ps", "--format", "{{.Names}}"],
    { encoding: "utf-8" },
  )
    .split("\n")
    .find((name) => name.startsWith("supabase_db_"));
  if (!container) {
    throw new Error("suggestion-delegation-concurrency: no supabase_db container");
  }
  const base = [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
  ];
  if (sqlFile) {
    return ["docker", [...base, "-f", "-"]];
  }
  return ["docker", [...base, "-c", sqlCommand ?? ""]];
}

function runSqlFile(relativePath: string): void {
  const abs = join(ROOT, relativePath);
  if (!existsSync(abs)) {
    throw new Error(`missing SQL fixture: ${relativePath}`);
  }
  const [cmd, args] = dockerDbExecArgs(abs);
  const result = spawnSync(cmd, args, {
    input: readFileSync(abs),
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(
      `SQL fixture failed (${relativePath}):\n${result.stderr || result.stdout}`,
    );
  }
}

function runSqlFileAllowFailureAsync(relativePath: string): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  const abs = join(ROOT, relativePath);
  const [cmd, args] = dockerDbExecArgs(abs);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.write(readFileSync(abs));
    child.stdin.end();
  });
}

function queryScalar(sql: string): string {
  const [cmd, args] = dockerDbExecArgs(undefined, `${sql.trim()}`);
  const result = spawnSync(cmd, args, { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`query failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout ?? "").trim();
}

async function main(): Promise<void> {
  execFileSync("npx", ["supabase", "status"], { cwd: ROOT, stdio: "pipe" });

  runSqlFile("scripts/fixtures/suggestion-delegation-concurrency-cleanup.sql");
  runSqlFile("scripts/fixtures/suggestion-delegation-concurrency-seed.sql");

  const [raceA, raceB] = await Promise.all([
    runSqlFileAllowFailureAsync(
      "scripts/fixtures/suggestion-delegation-concurrency-race-a.sql",
    ),
    runSqlFileAllowFailureAsync(
      "scripts/fixtures/suggestion-delegation-concurrency-race-b.sql",
    ),
  ]);

  const activeCount = queryScalar(`
    select count(*)::text
    from public.suggestion_review_assignments assignment_row
    where assignment_row.organisation_id = (select id from private._t119_conc_ids where key = 'organisation')
      and assignment_row.suggestion_id = (select id from private._t119_conc_ids where key = 'suggestion')
      and assignment_row.status = 'active'
  `);

  if (activeCount !== "1") {
    console.error("suggestion-delegation-concurrency: expected 1 active assignment, got", activeCount);
    console.error("race-a:\n", raceA.stderr || raceA.stdout);
    console.error("race-b:\n", raceB.stderr || raceB.stdout);
    process.exit(1);
  }

  const oneSucceeded =
    raceA.status === 0 || raceB.status === 0;
  if (!oneSucceeded) {
    console.error("suggestion-delegation-concurrency: expected at least one race session to commit");
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      scope: "suggestion-delegation-concurrency",
      activeAssignments: 1,
      result: "PASS",
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
