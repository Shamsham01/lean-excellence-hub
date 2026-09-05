import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DATABASE_TYPES_RELATIVE_PATH =
  "src/platform/supabase/database.types.ts";

export type GitDiffResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type GitDiffRunner = (
  repoRoot: string,
  filePath: string,
) => GitDiffResult;

export type AssertDatabaseTypesCurrentOptions = {
  repoRoot: string;
  runDbTypes: () => void;
  runGitDiff?: GitDiffRunner;
};

function defaultGitDiff(repoRoot: string, filePath: string): GitDiffResult {
  try {
    const stdout = execFileSync(
      "git",
      ["diff", "--exit-code", "--ignore-space-at-eol", "--", filePath],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    return { exitCode: 0, stdout, stderr: "" };
  } catch (error) {
    const execError = error as Error & {
      status?: number;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: execError.status ?? 1,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
    };
  }
}

/**
 * After semantic verification passes, restore the pre-generation working-tree
 * bytes when db:types rewrote only line-ending representation. Byte comparison
 * — not git diff — decides restoration so Windows core.autocrlf checkout state
 * cannot skip the restore path.
 */
function restoreOriginalBytesIfChanged(
  typesPath: string,
  originalBytes: Buffer,
): void {
  const generatedBytes = readFileSync(typesPath);
  if (!generatedBytes.equals(originalBytes)) {
    writeFileSync(typesPath, originalBytes);
  }
}

export function assertDatabaseTypesCurrent(
  options: AssertDatabaseTypesCurrentOptions,
): void {
  const runGitDiff = options.runGitDiff ?? defaultGitDiff;
  const typesPath = join(options.repoRoot, DATABASE_TYPES_RELATIVE_PATH);

  const preGenerationDiff = runGitDiff(options.repoRoot, typesPath);
  if (preGenerationDiff.exitCode !== 0) {
    throw new Error(
      "database.types.ts has uncommitted changes before db:types. Commit or revert local edits before running clean-rebuild verification.",
    );
  }

  const originalBytes = readFileSync(typesPath);

  options.runDbTypes();

  const postGenerationDiff = runGitDiff(options.repoRoot, typesPath);
  if (postGenerationDiff.exitCode !== 0) {
    throw new Error(
      "Generated database.types.ts differs from HEAD after db:types (schema/type drift). Run `npm run db:types` and commit the result.",
    );
  }

  restoreOriginalBytesIfChanged(typesPath, originalBytes);
}
