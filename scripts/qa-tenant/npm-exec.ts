import { execFileSync } from "node:child_process";

export type NpmRunInvocation = {
  executable: string;
  args: string[];
};

export type RunNpmScriptOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  platform?: NodeJS.Platform;
};

/**
 * Resolves how to invoke `npm run <script>` in a cross-platform way.
 *
 * When npm_execpath is available (normal when launched via npm), invoke npm
 * through the current Node executable to avoid Windows ENOENT on bare "npm".
 */
export function resolveNpmRunInvocation(
  script: string,
  options: RunNpmScriptOptions = {},
): NpmRunInvocation {
  const env = options.env ?? process.env;
  const execPath = options.execPath ?? process.execPath;
  const platform = options.platform ?? process.platform;

  const npmExecPath = env.npm_execpath;
  if (npmExecPath) {
    return {
      executable: execPath,
      args: [npmExecPath, "run", script],
    };
  }

  if (platform === "win32") {
    return {
      executable: "npm.cmd",
      args: ["run", script],
    };
  }

  return {
    executable: "npm",
    args: ["run", script],
  };
}

export type NpmRunExecCall = NpmRunInvocation & {
  options: {
    cwd: string;
    encoding: "utf8";
    env: NodeJS.ProcessEnv;
    stdio: ["ignore", "pipe", "pipe"];
  };
};

export function resolveNpmRunExecCall(
  script: string,
  options: RunNpmScriptOptions = {},
): NpmRunExecCall {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const invocation = resolveNpmRunInvocation(script, options);

  return {
    ...invocation,
    options: {
      cwd,
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  };
}

export function runNpmScript(
  script: string,
  options: RunNpmScriptOptions = {},
): string {
  const {
    executable,
    args,
    options: execOptions,
  } = resolveNpmRunExecCall(script, options);

  return execFileSync(executable, args, execOptions);
}
