import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const NEXT_ENV_RELATIVE_PATH = "next-env.d.ts";

export type GitStatusRunner = (repoRoot: string) => string;

function defaultGitStatus(repoRoot: string): string {
  return execFileSync("git", ["status", "--short"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function normalizeNextEnvTypegenImports(content: string): string {
  return content.replace(/\.next\/dev\/types\//g, ".next/types/");
}

/**
 * `npm run typecheck` runs `next typegen`, which rewrites next-env.d.ts import
 * paths between `.next/dev/types` and `.next/types`. Restore committed bytes
 * when that is the only semantic change.
 */
export function restoreNextEnvIfOnlyTypegenImportDrift(
  repoRoot: string,
  originalBytes: Buffer,
): void {
  const absolutePath = join(repoRoot, NEXT_ENV_RELATIVE_PATH);
  const current = readFileSync(absolutePath, "utf8");
  const original = originalBytes.toString("utf8");

  if (
    current !== original &&
    normalizeNextEnvTypegenImports(current) ===
      normalizeNextEnvTypegenImports(original)
  ) {
    writeFileSync(absolutePath, originalBytes);
  }
}

export function assertWorkingTreeClean(
  repoRoot: string,
  runGitStatus: GitStatusRunner = defaultGitStatus,
): void {
  const status = runGitStatus(repoRoot).trim();
  if (status.length > 0) {
    throw new Error(
      `Working tree is not clean after verification. git status --short:\n${status}`,
    );
  }
}

export function snapshotWorkingTreeStatus(
  repoRoot: string,
  runGitStatus: GitStatusRunner = defaultGitStatus,
): string {
  return runGitStatus(repoRoot).trim();
}

export function readTrackedFileBytes(
  repoRoot: string,
  relativePath: string,
): Buffer {
  return readFileSync(join(repoRoot, relativePath));
}
