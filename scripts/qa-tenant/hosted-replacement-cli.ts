#!/usr/bin/env node
import { runHostedTenantReplacement } from "./hosted-replacement";

async function main() {
  await runHostedTenantReplacement();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
