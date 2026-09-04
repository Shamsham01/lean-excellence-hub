import { describe, expect, it } from "vitest";

import {
  resolveNpmRunExecCall,
  resolveNpmRunInvocation,
} from "../../scripts/qa-tenant/npm-exec";

describe("resolveNpmRunInvocation", () => {
  it("prefers npm_execpath via the current Node executable", () => {
    const invocation = resolveNpmRunInvocation("db:reset", {
      env: {
        npm_execpath: "/path/to/npm-cli.js",
        NODE_ENV: "test",
      },
      execPath: "/usr/bin/node",
      platform: "win32",
    });

    expect(invocation).toEqual({
      executable: "/usr/bin/node",
      args: ["/path/to/npm-cli.js", "run", "db:reset"],
    });
  });

  it("does not rely on bare npm resolution on Windows", () => {
    const invocation = resolveNpmRunInvocation("test", {
      env: { NODE_ENV: "test" },
      platform: "win32",
    });

    expect(invocation).toEqual({
      executable: "npm.cmd",
      args: ["run", "test"],
    });
    expect(invocation.executable).not.toBe("npm");
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
});
