import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveNpmExecExecCall } from "./npm-exec";

export type SupabaseDbQueryOptions = {
  databaseUrl?: string;
  local?: boolean;
  sql?: string;
  filePath?: string;
  outputFormat?: "json" | "text";
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

function buildSupabaseDbQueryArgs(options: SupabaseDbQueryOptions) {
  const args = ["supabase", "db", "query"];

  if (options.local) {
    args.push("--local");
  } else if (options.databaseUrl) {
    args.push("--db-url", options.databaseUrl);
  } else {
    throw new Error(
      "Supabase DB query requires either local=true or databaseUrl.",
    );
  }

  if (options.outputFormat) {
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

export function runSupabaseDbQuery(options: SupabaseDbQueryOptions): string {
  let tempFile: string | undefined;

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
    const {
      executable,
      args,
      options: execOptions,
    } = resolveNpmExecExecCall(command, commandArgs);

    try {
      return execFileSync(executable, args, execOptions);
    } catch (error) {
      const execError = error as Error & { stdout?: string; stderr?: string };
      const stdout = execError.stdout ?? "";
      const stderr = execError.stderr ?? "";
      const parsed = parseSupabaseCliError(stdout, stderr);
      throw new SupabaseDbQueryError(parsed, stdout, stderr);
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

export function runSupabaseDbQueryJson<T>(options: SupabaseDbQueryOptions): T {
  const output = runSupabaseDbQuery({
    ...options,
    outputFormat: options.outputFormat ?? "json",
  });

  return JSON.parse(output) as T;
}
