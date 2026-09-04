import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertDatabaseTypesCurrent,
  DATABASE_TYPES_RELATIVE_PATH,
  type GitDiffRunner,
} from "../../scripts/qa-tenant/database-types-verify";
import { assertWorkingTreeClean } from "../../scripts/qa-tenant/working-tree-verify";

function createTypesFixtureRepo(content = "export type Foo = 1;\n") {
  const repoRoot = mkdtempSync(join(tmpdir(), "qa-db-types-mock-"));
  const relativePath = DATABASE_TYPES_RELATIVE_PATH;
  const absolutePath = join(repoRoot, relativePath);
  mkdirSync(join(repoRoot, "src/platform/supabase"), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
  return { repoRoot, relativePath, absolutePath };
}

describe("assertDatabaseTypesCurrent", () => {
  it("passes when generated database.types.ts matches HEAD", () => {
    const { repoRoot, absolutePath } = createTypesFixtureRepo();
    const typesPath = join(repoRoot, DATABASE_TYPES_RELATIVE_PATH);
    const runGitDiff = vi
      .fn<GitDiffRunner>()
      .mockReturnValue({ exitCode: 0, stdout: "", stderr: "" });
    const runDbTypes = vi.fn(() => {
      writeFileSync(absolutePath, "export type Foo = 1;\n", "utf8");
    });

    expect(() =>
      assertDatabaseTypesCurrent({
        repoRoot,
        runDbTypes,
        runGitDiff,
      }),
    ).not.toThrow();

    expect(runGitDiff).toHaveBeenCalledTimes(2);
    expect(runGitDiff).toHaveBeenNthCalledWith(1, repoRoot, typesPath);
    expect(runGitDiff).toHaveBeenNthCalledWith(2, repoRoot, typesPath);
    expect(runDbTypes).toHaveBeenCalledOnce();
  });

  it("passes when only end-of-line whitespace differs after generation", () => {
    const { repoRoot, absolutePath } = createTypesFixtureRepo();
    const runGitDiff = vi
      .fn<GitDiffRunner>()
      .mockReturnValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ exitCode: 0, stdout: "", stderr: "" });
    const runDbTypes = vi.fn(() => {
      writeFileSync(absolutePath, "export type Foo = 1;\r\n", "utf8");
    });

    expect(() =>
      assertDatabaseTypesCurrent({
        repoRoot,
        runDbTypes,
        runGitDiff,
      }),
    ).not.toThrow();
  });

  it("fails when generated database.types.ts has substantive drift", () => {
    const { repoRoot, absolutePath } = createTypesFixtureRepo();
    const runGitDiff = vi
      .fn<GitDiffRunner>()
      .mockReturnValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        exitCode: 1,
        stdout: "diff --git a/src/platform/supabase/database.types.ts",
        stderr: "",
      });
    const runDbTypes = vi.fn(() => {
      writeFileSync(absolutePath, "export type Foo = 2;\n", "utf8");
    });

    expect(() =>
      assertDatabaseTypesCurrent({
        repoRoot,
        runDbTypes,
        runGitDiff,
      }),
    ).toThrow(
      "Generated database.types.ts differs from HEAD after db:types (schema/type drift).",
    );
  });

  it("fails clearly when database.types.ts is dirty before generation", () => {
    const { repoRoot } = createTypesFixtureRepo();
    const typesPath = join(repoRoot, DATABASE_TYPES_RELATIVE_PATH);
    const runGitDiff = vi.fn<GitDiffRunner>().mockReturnValueOnce({
      exitCode: 1,
      stdout: "diff --git a/src/platform/supabase/database.types.ts",
      stderr: "",
    });
    const runDbTypes = vi.fn();

    expect(() =>
      assertDatabaseTypesCurrent({
        repoRoot,
        runDbTypes,
        runGitDiff,
      }),
    ).toThrow(
      "database.types.ts has uncommitted changes before db:types. Commit or revert local edits before running clean-rebuild verification.",
    );

    expect(runGitDiff).toHaveBeenCalledWith(repoRoot, typesPath);
    expect(runDbTypes).not.toHaveBeenCalled();
  });
});

describe("Windows path joining", () => {
  it("uses platform-aware path for database.types.ts on Windows", () => {
    const expectedPath = win32.join("D:\\repo", DATABASE_TYPES_RELATIVE_PATH);

    expect(expectedPath).toBe(
      "D:\\repo\\src\\platform\\supabase\\database.types.ts",
    );
    expect(expectedPath).not.toBe(
      "/repo/src/platform/supabase/database.types.ts",
    );
  });

  it("uses platform-aware path for database.types.ts on POSIX", () => {
    const repoRoot = "/repo";
    const expectedPath = join(repoRoot, DATABASE_TYPES_RELATIVE_PATH);

    expect(expectedPath).toBe("/repo/src/platform/supabase/database.types.ts");
  });
});

describe("assertWorkingTreeClean", () => {
  it("passes when git status is empty", () => {
    expect(() => assertWorkingTreeClean("/repo", () => "")).not.toThrow();
  });

  it("fails when git status shows modifications", () => {
    expect(() =>
      assertWorkingTreeClean("/repo", () => " M next-env.d.ts"),
    ).toThrow("Working tree is not clean after verification");
  });
});

describe("defaultGitDiff EOL semantics", () => {
  it("treats CRLF-only changes as no drift with --ignore-space-at-eol", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "qa-db-types-"));
    const relativePath = DATABASE_TYPES_RELATIVE_PATH;
    const absolutePath = join(repoRoot, relativePath);
    mkdirSync(join(repoRoot, "src/platform/supabase"), { recursive: true });

    execFileSync("git", ["init"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "qa@example.com"], {
      cwd: repoRoot,
    });
    execFileSync("git", ["config", "user.name", "QA"], { cwd: repoRoot });

    writeFileSync(absolutePath, "export type Foo = 1;\n", "utf8");
    execFileSync("git", ["add", relativePath], { cwd: repoRoot });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: repoRoot });

    writeFileSync(absolutePath, "export type Foo = 1;\r\n", "utf8");

    expect(() =>
      assertDatabaseTypesCurrent({
        repoRoot,
        runDbTypes: () => {
          writeFileSync(absolutePath, "export type Foo = 1;\n", "utf8");
        },
      }),
    ).not.toThrow();
  });

  it("fails on substantive type changes after generation", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "qa-db-types-"));
    const relativePath = DATABASE_TYPES_RELATIVE_PATH;
    const absolutePath = join(repoRoot, relativePath);
    mkdirSync(join(repoRoot, "src/platform/supabase"), { recursive: true });

    execFileSync("git", ["init"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "qa@example.com"], {
      cwd: repoRoot,
    });
    execFileSync("git", ["config", "user.name", "QA"], { cwd: repoRoot });

    writeFileSync(absolutePath, "export type Foo = 1;\n", "utf8");
    execFileSync("git", ["add", relativePath], { cwd: repoRoot });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: repoRoot });

    expect(() =>
      assertDatabaseTypesCurrent({
        repoRoot,
        runDbTypes: () => {
          writeFileSync(absolutePath, "export type Foo = 2;\n", "utf8");
        },
      }),
    ).toThrow(
      "Generated database.types.ts differs from HEAD after db:types (schema/type drift).",
    );
  });
});
