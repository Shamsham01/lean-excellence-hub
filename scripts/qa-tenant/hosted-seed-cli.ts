#!/usr/bin/env node
import { runHostedCookieWorksSeed } from "./hosted-seed";

async function main() {
  await runHostedCookieWorksSeed();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
