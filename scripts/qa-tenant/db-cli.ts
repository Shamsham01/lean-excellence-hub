import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseSupabaseDbQueryRows,
  type ParseDbQueryRowsOptions,
} from "./db-query-result";
import { resolveNpmExecExecCall } from "./npm-exec";

export type SupabaseDbQueryOptions = {
  databaseUrl?: string;
  local?: boolean;
  sql?: string;
  filePath?: string;
  outputFormat?: "json" | "text";
  /** Override the default bounded execution timeout. */
  timeoutMs?: number;
  /** Catalog/inventory/purge queries that legitimately run longer. */
  heavy?: boolean;
  /**
   * Opt-in retry for transient Postgres connection drops on read-only queries.
   * Destructive SQL must leave this false (default) so a dropped connection after
   * commit cannot be retried.
   */
  retryTransientConnection?: boolean;
};

export class SupabaseDbQueryError extends Error {
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.name = "SupabaseDbQueryError";
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

const DEFAULT_QUERY_TIMEOUT_MS = 120_000;
const HEAVY_QUERY_TIMEOUT_MS = 300_000;
export const TRANSIENT_DB_CONNECTION_RETRY_MAX_ATTEMPTS = 3;

function resolveQueryTimeoutMs(options: SupabaseDbQueryOptions) {
  if (options.timeoutMs !== undefined) {
    return options.timeoutMs;
  }
  return options.heavy ? HEAVY_QUERY_TIMEOUT_MS : DEFAULT_QUERY_TIMEOUT_MS;
}

function resolveSupabaseExecCall(commandArgs: string[]) {
  const binDir = join(process.cwd(), "node_modules", ".bin");
  const supabaseBin =
    process.platform === "win32"
      ? join(binDir, "supabase.cmd")
      : join(binDir, "supabase");

  if (existsSync(supabaseBin)) {
    if (process.platform === "win32") {
      return {
        executable: process.env.ComSpec ?? "cmd.exe",
        args: ["/d", "/s", "/c", supabaseBin, ...commandArgs],
      };
    }

    return {
      executable: supabaseBin,
      args: commandArgs,
    };
  }

  return resolveNpmExecExecCall("supabase", commandArgs);
}

export function buildSupabaseDbQueryArgs(options: SupabaseDbQueryOptions) {
  const args = ["supabase", "db", "query"];
  const preferLocal =
    options.local ||
    (process.env.LEANHUB_QA_DB_LOCAL === "1" && Boolean(options.databaseUrl));

  if (preferLocal) {
    args.push("--local");
  } else if (options.databaseUrl) {
    args.push("--db-url", options.databaseUrl);
  } else {
    throw new Error(
      "Supabase DB query requires either local=true or databaseUrl.",
    );
  }

  if (options.outputFormat === "json") {
    // Deterministic machine-readable contract: disable agent auto-detection so
    // Cursor/CI and physical Windows PowerShell receive the same JSON array shape.
    args.push("--output-format", "json", "--agent", "no");
  } else if (options.outputFormat) {
    args.push("--output-format", options.outputFormat);
  }

  if (options.filePath) {
    args.push("-f", options.filePath);
  } else if (options.sql) {
    args.push(options.sql);
  } else {
    throw new Error("Supabase DB query requires sql or filePath.");
  }

  return args;
}

function formatExecFailure(
  error: Error & { stdout?: string; stderr?: string; signal?: NodeJS.Signals },
  timeoutMs: number,
  sqlPreview: string,
): never {
  const stdout = error.stdout ?? "";
  const stderr = error.stderr ?? "";

  if (error.signal === "SIGTERM") {
    throw new SupabaseDbQueryError(
      `Supabase DB query timed out after ${timeoutMs}ms. SQL preview: ${sqlPreview}`,
      stdout,
      stderr,
    );
  }

  const parsed = parseSupabaseCliError(stdout, stderr);
  throw new SupabaseDbQueryError(parsed, stdout, stderr);
}

function readSqlPreview(options: SupabaseDbQueryOptions) {
  if (options.sql) {
    return options.sql.replace(/\s+/g, " ").trim().slice(0, 160);
  }

  if (options.filePath) {
    try {
      return readFileSync(options.filePath, "utf8")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
    } catch {
      return options.filePath;
    }
  }

  return "unknown SQL";
}

export function isTransientDbConnectionError(message: string) {
  return /connection terminated unexpectedly|server closed the connection unexpectedly|ECONNRESET|connection reset by peer/i.test(
    message,
  );
}

export function executeWithOptionalTransientConnectionRetry<T>(
  enabled: boolean,
  execute: () => T,
): T {
  if (!enabled) {
    return execute();
  }

  const maxAttempts = TRANSIENT_DB_CONNECTION_RETRY_MAX_ATTEMPTS;
  let lastError: SupabaseDbQueryError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return execute();
    } catch (error) {
      if (
        error instanceof SupabaseDbQueryError &&
        isTransientDbConnectionError(error.message) &&
        attempt < maxAttempts
      ) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw (
    lastError ?? new SupabaseDbQueryError("Supabase DB query failed.", "", "")
  );
}

export function runSupabaseDbQuery(options: SupabaseDbQueryOptions): string {
  return executeWithOptionalTransientConnectionRetry(
    options.retryTransientConnection === true,
    () => runSupabaseDbQueryOnce(options),
  );
}

function runSupabaseDbQueryOnce(options: SupabaseDbQueryOptions): string {
  let tempFile: string | undefined;
  const timeoutMs = resolveQueryTimeoutMs(options);
  const sqlPreview = readSqlPreview(options);

  try {
    const queryOptions = { ...options };

    if (!queryOptions.filePath && queryOptions.sql) {
      tempFile = join(
        tmpdir(),
        `leanhub-qa-sql-${process.pid}-${Date.now()}.sql`,
      );
      writeFileSync(tempFile, queryOptions.sql, "utf8");
      queryOptions.filePath = tempFile;
      delete queryOptions.sql;
    }

    const supabaseArgs = buildSupabaseDbQueryArgs(queryOptions);
    const command = supabaseArgs[0];
    if (!command) {
      throw new Error("Supabase DB query args must include a command.");
    }
    const commandArgs = supabaseArgs.slice(1);
    const { executable, args } = resolveSupabaseExecCall(commandArgs);
    const { options: npmExecOptions } = resolveNpmExecExecCall(
      "supabase",
      commandArgs,
    );

    try {
      return execFileSync(executable, args, {
        ...npmExecOptions,
        timeout: timeoutMs,
      });
    } catch (error) {
      return formatExecFailure(
        error as Error & {
          stdout?: string;
          stderr?: string;
          signal?: NodeJS.Signals;
        },
        timeoutMs,
        sqlPreview,
      );
    }
  } finally {
    if (tempFile) {
      try {
        unlinkSync(tempFile);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function parseSupabaseCliError(stdout: string, stderr: string): string {
  const combined = `${stdout}\n${stderr}`.trim();

  try {
    const envelope = JSON.parse(stdout) as {
      error?: { message?: string };
    };
    if (envelope.error?.message) {
      return envelope.error.message;
    }
  } catch {
    // fall through
  }

  return combined || "Supabase DB query failed.";
}

export function runSupabaseDbQueryJson<T extends Record<string, unknown>>(
  options: SupabaseDbQueryOptions,
  parseOptions?: ParseDbQueryRowsOptions,
): T[] {
  const output = runSupabaseDbQuery({
    ...options,
    outputFormat: options.outputFormat ?? "json",
  });

  return parseSupabaseDbQueryRows<T>(output, parseOptions);
}
