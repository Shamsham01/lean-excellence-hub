#!/usr/bin/env node

import { assertDatabaseTypesCurrent } from "./database-types-verify";
import { QA_ORGANISATION_CODE, QA_USERS } from "./constants";
import {
  collectCookieWorksInventory,
  formatInventoryReport,
} from "./inventory";
import { loadLocalSupabaseEnv, buildLocalVerificationEnv } from "./local-env";
import {
  assertCookieWorksFoundationOnlyVerified,
  formatVerificationSummary,
} from "./verification";
import { runNpmScript as executeNpmScript } from "./npm-exec";
import {
  assertWorkingTreeClean,
  NEXT_ENV_RELATIVE_PATH,
  readTrackedFileBytes,
  restoreNextEnvIfOnlyTypegenImportDrift,
  snapshotWorkingTreeStatus,
} from "./working-tree-verify";

type StepResult = {
  name: string;
  command: string;
  status: "PASS" | "FAIL";
  detail?: string;
};

const repoRoot = process.cwd();

function parseArgs(argv: string[]) {
  return {
    skipReset: argv.includes("--skip-reset"),
    skipBuild: argv.includes("--skip-build"),
    skipE2e: argv.includes("--skip-e2e"),
  };
}

function runNpmScript(
  script: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return executeNpmScript(script, { cwd: repoRoot, env });
}

function runStep(
  name: string,
  command: string,
  action: () => void,
): StepResult {
  process.stdout.write(`\n==> ${name}\n`);
  process.stdout.write(`    ${command}\n`);

  try {
    action();
    process.stdout.write("    PASS\n");
    return { name, command, status: "PASS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`    FAIL: ${message}\n`);
    return { name, command, status: "FAIL", detail: message };
  }
}

function assertCookieWorksFoundationState(databaseUrl: string) {
  const inventory = collectCookieWorksInventory(databaseUrl);
  const report = formatInventoryReport(inventory);

  if (!inventory.organisation) {
    throw new Error(
      "CookieWorks inventory returned no organisation; foundation seed may have failed.",
    );
  }

  if (!report.includes("users (QA personas): 7")) {
    throw new Error("CookieWorks inventory expected 7 QA personas.");
  }

  if (!report.includes(`Code: ${QA_ORGANISATION_CODE}`)) {
    throw new Error(
      `CookieWorks inventory expected organisation code ${QA_ORGANISATION_CODE}.`,
    );
  }

  const verification = assertCookieWorksFoundationOnlyVerified(databaseUrl);
  const summary = formatVerificationSummary(verification);

  if (!summary.includes("FOUNDATION-ONLY VERIFIED")) {
    throw new Error("CookieWorks foundation-only verification failed.");
  }

  const expectedPersonaCount = Object.keys(QA_USERS).length;
  if (expectedPersonaCount !== 7) {
    throw new Error(
      `QA persona constant drift: expected 7 personas, found ${expectedPersonaCount}.`,
    );
  }

  process.stdout.write("\n");
  process.stdout.write(report);
  process.stdout.write("\n\n");
  process.stdout.write(summary);
  process.stdout.write("\n");
}

function printSummary(results: StepResult[]) {
  process.stdout.write("\n");
  process.stdout.write("Clean rebuild verification summary\n");
  process.stdout.write("------------------------------------\n");

  for (const result of results) {
    process.stdout.write(`${result.status.padEnd(4)} ${result.name}\n`);
    if (result.status === "FAIL" && result.detail) {
      process.stdout.write(`      ${result.detail}\n`);
    }
  }

  const failed = results.filter((result) => result.status === "FAIL");
  process.stdout.write("\n");

  if (failed.length === 0) {
    process.stdout.write(
      "LOCAL CLEAN REBUILD VERIFIED — schema reproducible from migrations.\n",
    );
    return;
  }

  process.stdout.write(
    `LOCAL CLEAN REBUILD FAILED — ${failed.length} step(s) require attention.\n`,
  );
  process.exitCode = 1;
}

function main() {
  const { skipReset, skipBuild, skipE2e } = parseArgs(process.argv.slice(2));
  const results: StepResult[] = [];

  const verificationEnv = buildLocalVerificationEnv("qa:verify:clean-rebuild");

  const preStatus = snapshotWorkingTreeStatus(repoRoot);
  const preNextEnvBytes = readTrackedFileBytes(
    repoRoot,
    NEXT_ENV_RELATIVE_PATH,
  );
  if (preStatus.length > 0) {
    process.stdout.write(
      "Warning: working tree was not clean before verification:\n",
    );
    process.stdout.write(`${preStatus}\n\n`);
  }

  if (!skipReset) {
    results.push(
      runStep("Database reset", "npm run db:reset", () => {
        runNpmScript("db:reset");
      }),
    );
  } else {
    results.push({
      name: "Database reset",
      command: "skipped (--skip-reset)",
      status: "PASS",
      detail: "Assuming database already reset",
    });
  }

  results.push(
    runStep("Database tests (pgTAP)", "npm run test:db", () => {
      runNpmScript("test:db");
    }),
  );

  results.push(
    runStep(
      "Generated type verification",
      "npm run db:types && git diff --exit-code --ignore-space-at-eol database.types.ts",
      () => {
        assertDatabaseTypesCurrent({
          repoRoot,
          runDbTypes: () => runNpmScript("db:types"),
        });
      },
    ),
  );

  results.push(
    runStep("Typecheck", "npm run typecheck", () => {
      runNpmScript("typecheck");
    }),
  );

  results.push(
    runStep(
      "Apex demo seed",
      "LEANHUB_ALLOW_DEMO_SEED=1 npm run db:seed-demo",
      () => {
        runNpmScript("db:seed-demo", {
          ...process.env,
          LEANHUB_ALLOW_DEMO_SEED: "1",
        });
      },
    ),
  );

  results.push(
    runStep(
      "CookieWorks foundation seed",
      "LEANHUB_ALLOW_QA_TENANT=1 npm run qa:cookie:seed",
      () => {
        runNpmScript("qa:cookie:seed", {
          ...process.env,
          LEANHUB_ALLOW_QA_TENANT: "1",
        });
      },
    ),
  );

  results.push(
    runStep(
      "CookieWorks foundation-only inventory",
      "npm run qa:cookie:inventory (programmatic verification)",
      () => {
        const env = loadLocalSupabaseEnv("qa:verify:clean-rebuild");
        assertCookieWorksFoundationState(env.databaseUrl);
      },
    ),
  );

  results.push(
    runStep("Unit tests", "npm run test", () => {
      runNpmScript("test", {
        ...process.env,
        LEANHUB_SKIP_LEGACY_REPLACEMENT_INTEGRATION: "1",
      });
    }),
  );

  if (!skipE2e) {
    results.push(
      runStep("Smoke E2E", "npm run test:e2e:smoke", () => {
        runNpmScript("test:e2e:smoke", verificationEnv);
      }),
    );
  }

  if (!skipBuild) {
    results.push(
      runStep("Production build", "npm run build", () => {
        runNpmScript("build", verificationEnv);
      }),
    );
  }

  results.push(
    runStep(
      "Working tree cleanliness",
      "git status --short (must be empty when started clean)",
      () => {
        if (preStatus.length === 0) {
          restoreNextEnvIfOnlyTypegenImportDrift(repoRoot, preNextEnvBytes);
          assertWorkingTreeClean(repoRoot);
        } else {
          process.stdout.write(
            "    Skipped: working tree was not clean before verification.\n",
          );
        }
      },
    ),
  );

  printSummary(results);
}

main();
