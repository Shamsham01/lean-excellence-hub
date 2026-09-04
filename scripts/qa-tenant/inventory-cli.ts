#!/usr/bin/env node
import {
  collectCookieWorksInventory,
  formatInventoryReport,
} from "./inventory";
import { loadLocalSupabaseEnv } from "./local-env";

async function main() {
  const env = loadLocalSupabaseEnv("qa:cookie:inventory");
  const inventory = collectCookieWorksInventory(env.databaseUrl);
  console.log(formatInventoryReport(inventory));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
