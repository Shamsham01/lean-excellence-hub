import { describe, expect, it } from "vitest";

import {
  resolveNpmExecExecCall,
  resolveNpmExecInvocation,
  resolveNpmRunExecCall,
  resolveNpmRunInvocation,
} from "../../scripts/qa-tenant/npm-exec";

describe("resolveNpmRunInvocation", () => {
  it("prefers npm_execpath via the current Node executable on Windows", () => {
    const invocation = resolveNpmRunInvocation("db:reset", {
      env: {
        npm_execpath: "/path/to/npm-cli.js",
        NODE_ENV: "test",
      },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
    });

    expect(invocation).toEqual({
      executable: "C:\\Program Files\\nodejs\\node.exe",
      args: ["/path/to/npm-cli.js", "run", "db:reset"],
    });
    expect(invocation.executable).not.toBe("npm.cmd");
    expect(invocation.args[0]).toBe("/path/to/npm-cli.js");
  });

  it("uses cmd.exe to run npm.cmd when npm_execpath is absent on Windows", () => {
    const invocation = resolveNpmRunInvocation("test", {
      env: {
        NODE_ENV: "test",
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
      },
      platform: "win32",
    });

    expect(invocation).toEqual({
      executable: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", "run", "test"],
    });
    expect(invocation.executable).not.toBe("npm.cmd");
    expect(invocation.args).not.toContain("npm");
  });

  it("defaults to cmd.exe when ComSpec is absent on Windows", () => {
    const invocation = resolveNpmRunInvocation("build", {
      env: { NODE_ENV: "test" },
      platform: "win32",
    });

    expect(invocation.executable).toBe("cmd.exe");
    expect(invocation.args).toEqual([
      "/d",
      "/s",
      "/c",
      "npm.cmd",
      "run",
      "build",
    ]);
  });

  it("keeps a Unix npm fallback when npm_execpath is absent", () => {
    const invocation = resolveNpmRunInvocation("build", {
      env: { NODE_ENV: "test" },
      platform: "linux",
    });

    expect(invocation).toEqual({
      executable: "npm",
      args: ["run", "build"],
    });
  });
});

describe("resolveNpmRunExecCall", () => {
  it("propagates cwd and env overrides for nested npm scripts", () => {
    const env = {
      ...process.env,
      npm_execpath: "/fake/npm-cli.js",
      LEANHUB_ALLOW_DEMO_SEED: "1",
    };

    const call = resolveNpmRunExecCall("db:seed-demo", {
      cwd: "/repo",
      env,
      execPath: "/fake/node",
    });

    expect(call).toEqual({
      executable: "/fake/node",
      args: ["/fake/npm-cli.js", "run", "db:seed-demo"],
      options: {
        cwd: "/repo",
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    });
  });

  it("propagates cwd and env overrides through the Windows cmd.exe fallback", () => {
    const env = {
      NODE_ENV: "test",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
      LEANHUB_ALLOW_QA_TENANT: "1",
    } as NodeJS.ProcessEnv;

    const call = resolveNpmRunExecCall("qa:cookie:seed", {
      cwd: "D:\\repo",
      env,
      platform: "win32",
    });

    expect(call).toEqual({
      executable: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", "run", "qa:cookie:seed"],
      options: {
        cwd: "D:\\repo",
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    });
  });
});

describe("resolveNpmExecInvocation", () => {
  const supabaseArgs = ["db", "query", "--local", "-f", "query.sql"];

  it("prefers npm_execpath via the current Node executable", () => {
    const invocation = resolveNpmExecInvocation("supabase", supabaseArgs, {
      env: {
        NODE_ENV: "test",
        npm_execpath: "/path/to/npm-cli.js",
      },
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      platform: "win32",
    });

    expect(invocation).toEqual({
      executable: "C:\\Program Files\\nodejs\\node.exe",
      args: ["/path/to/npm-cli.js", "exec", "--", "supabase", ...supabaseArgs],
    });
    expect(invocation.executable).not.toBe("npx");
    expect(invocation.executable).not.toBe("npx.cmd");
    expect(invocation.args).not.toContain("npx");
    expect(invocation.args).not.toContain("npx.cmd");
  });

  it("uses cmd.exe to run npm.cmd exec when npm_execpath is absent on Windows", () => {
    const invocation = resolveNpmExecInvocation("supabase", supabaseArgs, {
      env: {
        NODE_ENV: "test",
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
      },
      platform: "win32",
    });

    expect(invocation).toEqual({
      executable: "C:\\Windows\\System32\\cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "npm.cmd",
        "exec",
        "--",
        "supabase",
        ...supabaseArgs,
      ],
    });
    expect(invocation.executable).not.toBe("npx");
    expect(invocation.executable).not.toBe("npx.cmd");
    expect(invocation.args).not.toContain("npx");
    expect(invocation.args).not.toContain("npx.cmd");
  });

  it("defaults to cmd.exe when ComSpec is absent on Windows", () => {
    const invocation = resolveNpmExecInvocation("supabase", supabaseArgs, {
      env: { NODE_ENV: "test" },
      platform: "win32",
    });

    expect(invocation.executable).toBe("cmd.exe");
    expect(invocation.args).toEqual([
      "/d",
      "/s",
      "/c",
      "npm.cmd",
      "exec",
      "--",
      "supabase",
      ...supabaseArgs,
    ]);
  });

  it("keeps a Unix npm exec fallback when npm_execpath is absent", () => {
    const invocation = resolveNpmExecInvocation("supabase", supabaseArgs, {
      env: { NODE_ENV: "test" },
      platform: "linux",
    });

    expect(invocation).toEqual({
      executable: "npm",
      args: ["exec", "--", "supabase", ...supabaseArgs],
    });
  });

  it("preserves Supabase CLI argument order", () => {
    const invocation = resolveNpmExecInvocation(
      "supabase",
      ["db", "query", "--local", "--output-format", "json", "select 1"],
      {
        env: { NODE_ENV: "test", npm_execpath: "/fake/npm-cli.js" },
        execPath: "/fake/node",
      },
    );

    expect(invocation.args).toEqual([
      "/fake/npm-cli.js",
      "exec",
      "--",
      "supabase",
      "db",
      "query",
      "--local",
      "--output-format",
      "json",
      "select 1",
    ]);
  });
});

describe("resolveNpmExecExecCall", () => {
  it("propagates cwd and env overrides for Supabase CLI invocation", () => {
    const env = {
      ...process.env,
      npm_execpath: "/fake/npm-cli.js",
      DATABASE_URL: "postgresql://example",
    };

    const call = resolveNpmExecExecCall(
      "supabase",
      ["db", "query", "--local", "-f", "query.sql"],
      {
        cwd: "/repo",
        env,
        execPath: "/fake/node",
      },
    );

    expect(call).toEqual({
      executable: "/fake/node",
      args: [
        "/fake/npm-cli.js",
        "exec",
        "--",
        "supabase",
        "db",
        "query",
        "--local",
        "-f",
        "query.sql",
      ],
      options: {
        cwd: "/repo",
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    });
  });
});
