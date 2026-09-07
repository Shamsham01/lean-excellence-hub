#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { purgeCookieWorksTenantModules } from "./delete-tenant";
import { seedCookieWorksFoundation } from "./foundation-seed";
import { loadLocalSupabaseEnv } from "./local-env";
import { seedCookieWorksModuleFixtures } from "./module-fixtures";
import {
  ensureUnits,
  resolveOrganisationId,
  switchOrganisation,
} from "./shared/organisation";
import { signInUser } from "./shared/auth";

const EXETER_SITE = {
  code: "exeter-cookie-factory",
  name: "Exeter Cookie Factory",
  packingCode: "exeter-packing",
  packingName: "Exeter Packing",
} as const;

export async function seedSiteBoundaryFixture(options: {
  apiUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
}) {
  const admin = createClient(options.apiUrl, options.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await purgeCookieWorksTenantModules(options.databaseUrl, { storageAdmin: admin });

  await seedCookieWorksFoundation({
    admin,
    apiUrl: options.apiUrl,
    publishableKey: options.publishableKey,
    databaseUrl: options.databaseUrl,
  });

  const adminClient = await signInUser(
    options.apiUrl,
    options.publishableKey,
    "admin",
  );
  const organisationId = await resolveOrganisationId(adminClient);
  await switchOrganisation(adminClient, organisationId);

  const unitIds = await ensureUnits(adminClient, organisationId);

  const { data: exeterSiteId, error: exeterSiteError } = await adminClient.rpc(
    "create_organisation_unit",
    {
      target_parent_unit_id: null,
      unit_code: EXETER_SITE.code,
      unit_name: EXETER_SITE.name,
      unit_type: "site",
    },
  );

  if (exeterSiteError || !exeterSiteId) {
    throw exeterSiteError ?? new Error("Failed to create Exeter site unit");
  }

  const { data: exeterPackingId, error: exeterPackingError } =
    await adminClient.rpc("create_organisation_unit", {
      target_parent_unit_id: exeterSiteId,
      unit_code: EXETER_SITE.packingCode,
      unit_name: EXETER_SITE.packingName,
      unit_type: "area",
    });

  if (exeterPackingError || !exeterPackingId) {
    throw exeterPackingError ?? new Error("Failed to create Exeter packing unit");
  }

  unitIds[EXETER_SITE.code] = exeterSiteId;
  unitIds[EXETER_SITE.packingCode] = exeterPackingId;

  const ciManagerClient = await signInUser(
    options.apiUrl,
    options.publishableKey,
    "ciManager",
  );
  const assessorClient = await signInUser(
    options.apiUrl,
    options.publishableKey,
    "assessor",
  );

  await seedCookieWorksModuleFixtures({
    adminClient,
    ciManagerClient,
    assessorClient,
    organisationId,
    unitIds,
  });

  const { data: modelVersion, error: modelVersionError } = await adminClient
    .from("maturity_model_versions")
    .select("id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (modelVersionError || !modelVersion) {
    throw modelVersionError ?? new Error("Published maturity model missing");
  }

  const { data: exeterAssessmentId, error: exeterAssessmentError } =
    await adminClient.rpc("start_maturity_assessment", {
      target_model_version_id: modelVersion.id,
      target_unit_id: exeterSiteId,
      target_assessment_mode: "formal",
      target_scope_type: "site",
    });

  if (exeterAssessmentError || !exeterAssessmentId) {
    throw (
      exeterAssessmentError ??
      new Error("Failed to create Exeter maturity assessment")
    );
  }

  return {
    organisationId,
    unitIds,
    exeterAssessmentId,
    exeterSiteId,
    bodminSiteId: unitIds["bodmin-cookie-factory"],
  };
}

async function main() {
  const env = loadLocalSupabaseEnv("qa:site-boundary:reset");
  const result = await seedSiteBoundaryFixture({
    apiUrl: env.apiUrl,
    publishableKey: env.publishableKey,
    serviceRoleKey: env.serviceRoleKey,
    databaseUrl: env.databaseUrl,
  });

  console.log("Site boundary QA seed complete.");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
