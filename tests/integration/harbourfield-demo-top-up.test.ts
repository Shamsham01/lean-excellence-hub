// @vitest-environment node
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HARBOURFIELD_ORGANISATION } from "../../scripts/harbourfield-demo/constants";
import { collectHarbourfieldDemoInventory } from "../../scripts/harbourfield-demo/inventory";
import { planHarbourfieldTopUp } from "../../scripts/harbourfield-demo/planner";
import { loadLocalSupabaseEnv } from "../../scripts/harbourfield-demo/local-env";

function isLocalSupabaseAvailable() {
  try {
    execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

const hasLocalSupabase = isLocalSupabaseAvailable();

describe.skipIf(!hasLocalSupabase)(
  "Harbourfield demo top-up integration",
  () => {
    beforeAll(() => {
      process.env.LEANHUB_ALLOW_HARBOURFIELD_DEMO = "1";
    }, 120_000);

    afterAll(() => {
      delete process.env.LEANHUB_ALLOW_HARBOURFIELD_DEMO;
    });

    it("applies idempotently against local Supabase", async () => {
      execFileSync(
        "node",
        ["--import", "tsx", "scripts/harbourfield-demo/seed-cli.ts", "--apply"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            npm_lifecycle_event: "demo:harbourfield:top-up",
            LEANHUB_ALLOW_HARBOURFIELD_DEMO: "1",
          },
        },
      );

      const env = loadLocalSupabaseEnv("demo:harbourfield:top-up");
      const manager = createClient(env.apiUrl, env.publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: signInError } = await manager.auth.signInWithPassword({
        email: "manager@harbourfield.local",
        password: "Manager@Harbourfield-Demo-2026!",
      });
      expect(signInError).toBeNull();

      const { data: eligible, error: eligibleError } = await manager.rpc(
        "list_my_eligible_organisations",
      );
      expect(eligibleError).toBeNull();

      const organisation = (
        eligible as Array<{
          organisation_id: string;
          organisation_code: string;
        }>
      ).find((row) => row.organisation_code === HARBOURFIELD_ORGANISATION.code);

      expect(organisation?.organisation_code).toBe(
        HARBOURFIELD_ORGANISATION.code,
      );

      await manager.rpc("switch_organisation", {
        target_organisation_id: organisation!.organisation_id,
      });

      const firstInventory = await collectHarbourfieldDemoInventory(manager);
      expect(planHarbourfieldTopUp(firstInventory)).toEqual([]);

      execFileSync(
        "node",
        ["--import", "tsx", "scripts/harbourfield-demo/seed-cli.ts", "--apply"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            npm_lifecycle_event: "demo:harbourfield:top-up",
            LEANHUB_ALLOW_HARBOURFIELD_DEMO: "1",
          },
        },
      );

      const secondInventory = await collectHarbourfieldDemoInventory(manager);
      expect(planHarbourfieldTopUp(secondInventory)).toEqual([]);
      expect(secondInventory.overdueOpenAction).toBe(true);
      expect(secondInventory.suggestionAwaitingReview).toBe(true);
      expect(secondInventory.benefitAwaitingValidation).toBe(true);
    }, 240_000);
  },
);
