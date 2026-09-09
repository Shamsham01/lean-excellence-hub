// @vitest-environment node
import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  QA_FOUNDATION_CONTRACT,
  QA_SITE_ROOT_CODES,
  QA_UNITS,
} from "../../scripts/qa-tenant/constants";
import {
  purgeCookieWorksTenantModules,
  assertCookieWorksResetVerified,
} from "../../scripts/qa-tenant/delete-tenant";
import { runSupabaseDbQueryJson } from "../../scripts/qa-tenant/db-cli";
import { seedCookieWorksFoundation } from "../../scripts/qa-tenant/foundation-seed";
import { loadLocalSupabaseEnv } from "../../scripts/qa-tenant/local-env";
import { signInQaPersona } from "../../scripts/qa-tenant/shared/organisation";
import { assertCookieWorksCompleteFoundationVerified } from "../../scripts/qa-tenant/verification";

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

function parseDelegatableScopeUnitIds(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [] as string[];
  }

  const scopeUnitIds = new Set<string>();
  for (const offer of payload) {
    if (!offer || typeof offer !== "object") {
      continue;
    }

    const scopes = (offer as { scopes?: unknown }).scopes;
    if (!Array.isArray(scopes)) {
      continue;
    }

    for (const scope of scopes) {
      if (!scope || typeof scope !== "object") {
        continue;
      }
      const scopeUnitId = (scope as { scope_unit_id?: unknown }).scope_unit_id;
      if (typeof scopeUnitId === "string" && scopeUnitId.length > 0) {
        scopeUnitIds.add(scopeUnitId);
      }
    }
  }

  return [...scopeUnitIds];
}

describe.skipIf(!hasLocalSupabase)(
  "CookieWorks two-site hostile acceptance",
  () => {
    let env: ReturnType<typeof loadLocalSupabaseEnv>;
    let admin: ReturnType<typeof createClient>;
    let organisationId = "";
    let unitIdsByCode: Record<string, string> = {};

    beforeAll(async () => {
      process.env.LEANHUB_ALLOW_QA_TENANT = "1";
      env = loadLocalSupabaseEnv("qa:cookie:reset");
      admin = createClient(env.apiUrl, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });
      assertCookieWorksResetVerified(env.databaseUrl);

      const verification = await assertCookieWorksCompleteFoundationVerified(
        env.databaseUrl,
      );
      organisationId = verification.organisation.id;

      const unitRows = runSupabaseDbQueryJson<{ id: string; code: string }>({
        databaseUrl: env.databaseUrl,
        outputFormat: "json",
        sql: `
          select id, code
          from public.organisation_units
          where organisation_id = '${organisationId}'::uuid
            and status = 'active';
        `,
      });

      unitIdsByCode = Object.fromEntries(
        unitRows.map((row) => [row.code, row.id]),
      );
    }, 180_000);

    afterAll(async () => {
      await purgeCookieWorksTenantModules(env.databaseUrl, {
        storageAdmin: admin,
      });
    }, 180_000);

    it("seeds the deliberate PR4 foundation contract", () => {
      expect(Object.keys(unitIdsByCode)).toHaveLength(QA_UNITS.length);
      expect(Object.keys(unitIdsByCode)).toHaveLength(
        QA_FOUNDATION_CONTRACT.units,
      );

      for (const siteRootCode of QA_SITE_ROOT_CODES) {
        expect(unitIdsByCode[siteRootCode]).toBeTruthy();
      }
    });

    it("resolves Bodmin and Exeter descendants to their site roots", () => {
      const resolveCases = [
        ["operations", "bodmin-cookie-factory"],
        ["packing", "bodmin-cookie-factory"],
        ["exeter-operations", "exeter-cookie-factory"],
        ["exeter-packing", "exeter-cookie-factory"],
      ] as const;

      for (const [unitCode, expectedSiteCode] of resolveCases) {
        const rows = runSupabaseDbQueryJson<{ site_code: string | null }>({
          databaseUrl: env.databaseUrl,
          outputFormat: "json",
          sql: `
            select site_unit.code as site_code
            from public.organisation_units unit_row
            join public.organisation_units site_unit
              on site_unit.id = private.resolve_site_unit_id(
                '${organisationId}'::uuid,
                unit_row.id
              )
            where unit_row.organisation_id = '${organisationId}'::uuid
              and unit_row.code = '${unitCode}';
          `,
        });

        expect(rows[0]?.site_code).toBe(expectedSiteCode);
      }
    });

    it("blocks Bodmin productionManager from enumerating Exeter through scoped hierarchy reads", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "productionManager",
      );

      const { data, error } = await client
        .from("organisation_units")
        .select("id, code, name")
        .eq("status", "active")
        .order("code");

      expect(error).toBeNull();
      const codes = (data ?? []).map((row) => row.code);
      expect(codes).toContain("operations");
      expect(codes).toContain("packing");
      expect(codes.some((code) => code.startsWith("exeter-"))).toBe(false);
      expect(codes).not.toContain("exeter-cookie-factory");
    });

    it("blocks Bodmin productionManager from selecting Exeter delegation scopes", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "productionManager",
      );

      const { data, error } = await client.rpc("get_delegatable_access_offers");
      expect(error).toBeNull();

      const scopeUnitIds = parseDelegatableScopeUnitIds(data);
      expect(scopeUnitIds).not.toContain(
        unitIdsByCode["exeter-cookie-factory"],
      );
      expect(scopeUnitIds).not.toContain(unitIdsByCode["exeter-operations"]);
    });

    it("blocks Bodmin productionManager from creating units under Exeter", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "productionManager",
      );

      const { error } = await client.rpc("create_organisation_unit", {
        target_organisation_id: organisationId,
        target_parent_unit_id: unitIdsByCode["exeter-operations"],
        unit_code: "hostile-bodmin-under-exeter",
        unit_name: "Hostile Bodmin Under Exeter",
        unit_type: "area",
      });

      expect(error).toBeTruthy();
      expect(error?.code).toBe("42501");
    });

    it("blocks Bodmin productionManager from cross-site reparent moves", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "productionManager",
      );

      const { error } = await client.rpc("move_organisation_unit", {
        target_organisation_id: organisationId,
        target_unit_id: unitIdsByCode.packing,
        target_parent_unit_id: unitIdsByCode["exeter-operations"],
      });

      expect(error).toBeTruthy();
    });

    it("allows Exeter productionManager to see Exeter Operations subtree only", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "exeterProductionManager",
      );

      const { data, error } = await client
        .from("organisation_units")
        .select("id, code, name")
        .eq("status", "active")
        .order("code");

      expect(error).toBeNull();
      const codes = (data ?? []).map((row) => row.code);
      expect(codes).toContain("exeter-operations");
      expect(codes).toContain("exeter-packing");
      expect(codes).not.toContain("operations");
      expect(codes).not.toContain("bodmin-cookie-factory");
    });

    it("blocks Exeter productionManager from Bodmin hierarchy management targets", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "exeterProductionManager",
      );

      const { error: createError } = await client.rpc(
        "create_organisation_unit",
        {
          target_organisation_id: organisationId,
          target_parent_unit_id: unitIdsByCode.operations,
          unit_code: "hostile-exeter-under-bodmin",
          unit_name: "Hostile Exeter Under Bodmin",
          unit_type: "area",
        },
      );

      expect(createError).toBeTruthy();

      const { data, error } = await client.rpc("get_delegatable_access_offers");
      expect(error).toBeNull();
      const scopeUnitIds = parseDelegatableScopeUnitIds(data);
      expect(scopeUnitIds).not.toContain(unitIdsByCode.operations);
      expect(scopeUnitIds).not.toContain(
        unitIdsByCode["bodmin-cookie-factory"],
      );
    });

    it("allows organisation-wide CI manager to see both sites", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "ciManager",
      );

      const { data, error } = await client
        .from("organisation_units")
        .select("id, code, name")
        .eq("status", "active")
        .order("code");

      expect(error).toBeNull();
      const codes = (data ?? []).map((row) => row.code);
      expect(codes).toContain("bodmin-cookie-factory");
      expect(codes).toContain("exeter-cookie-factory");
      expect(codes).toContain("operations");
      expect(codes).toContain("exeter-operations");
    });

    it("rejects admin cross-site reparent through authoritative RPC", async () => {
      const client = await signInQaPersona(
        env.apiUrl,
        env.publishableKey,
        "admin",
      );

      const { error } = await client.rpc("move_organisation_unit", {
        target_organisation_id: organisationId,
        target_unit_id: unitIdsByCode.packing,
        target_parent_unit_id: unitIdsByCode["exeter-operations"],
      });

      expect(error).toBeTruthy();
      expect(error?.message?.toLowerCase()).toContain("cross-site");
    });

    it("proves reset idempotence for the two-site foundation contract", async () => {
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });

      const first = await assertCookieWorksCompleteFoundationVerified(
        env.databaseUrl,
      );
      await seedCookieWorksFoundation({
        admin,
        apiUrl: env.apiUrl,
        publishableKey: env.publishableKey,
        databaseUrl: env.databaseUrl,
      });
      const second = await assertCookieWorksCompleteFoundationVerified(
        env.databaseUrl,
      );

      expect(first.membershipCount).toBe(QA_FOUNDATION_CONTRACT.personas);
      expect(first.unitCount).toBe(QA_FOUNDATION_CONTRACT.units);
      expect(second.membershipCount).toBe(first.membershipCount);
      expect(second.unitCount).toBe(first.unitCount);
      expect(second.roleGrantCount).toBe(first.roleGrantCount);
    }, 180_000);
  },
);
