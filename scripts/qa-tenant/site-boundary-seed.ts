#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

import { purgeCookieWorksTenantModules } from "./delete-tenant";
import { QA_USERS } from "./constants";
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

  await purgeCookieWorksTenantModules(options.databaseUrl, {
    storageAdmin: admin,
  });

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
      target_organisation_id: organisationId,
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
      target_organisation_id: organisationId,
      target_parent_unit_id: exeterSiteId,
      unit_code: EXETER_SITE.packingCode,
      unit_name: EXETER_SITE.packingName,
      unit_type: "area",
    });

  if (exeterPackingError || !exeterPackingId) {
    throw (
      exeterPackingError ?? new Error("Failed to create Exeter packing unit")
    );
  }

  unitIds[EXETER_SITE.code] = exeterSiteId;
  unitIds[EXETER_SITE.packingCode] = exeterPackingId;

  const { data: operatorJobFunctionId, error: operatorJobFunctionError } =
    await adminClient.rpc("create_job_function", {
      target_name: "Operator",
      target_code: "site-boundary-operator",
    });

  if (operatorJobFunctionError || !operatorJobFunctionId) {
    throw (
      operatorJobFunctionError ??
      new Error("Failed to create operator job function for site boundary seed")
    );
  }

  const { data: operatorMembership, error: operatorMembershipError } =
    await adminClient
      .from("organisation_memberships")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("user_id", QA_USERS.operator.id)
      .maybeSingle();

  const bodminPackingUnitId = unitIds["packing"];
  if (
    operatorMembershipError ||
    !operatorMembership?.id ||
    !bodminPackingUnitId
  ) {
    throw (
      operatorMembershipError ??
      new Error("Operator membership or Bodmin packing unit missing for placement")
    );
  }

  const { error: operatorPlacementError } = await adminClient.rpc(
    "assign_membership_job_function",
    {
      target_membership_id: operatorMembership.id,
      target_job_function_id: operatorJobFunctionId,
      target_primary: true,
      target_organisational_unit_id: bodminPackingUnitId,
    },
  );

  if (operatorPlacementError) {
    throw operatorPlacementError;
  }

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

  const bodminSiteId = unitIds["bodmin-cookie-factory"];
  if (!bodminSiteId) {
    throw new Error("Bodmin site unit missing for maturity fixture");
  }

  const { data: bodminAssessmentId, error: bodminAssessmentError } =
    await adminClient.rpc("start_maturity_assessment", {
      target_model_version_id: modelVersion.id,
      target_unit_id: bodminSiteId,
      target_assessment_type: "self",
      target_assessment_scope_type: "site",
    });

  if (bodminAssessmentError || !bodminAssessmentId) {
    throw new Error(
      `Bodmin start_maturity_assessment failed: ${
        bodminAssessmentError?.message ?? "missing assessment id"
      }`,
    );
  }

  const { data: exeterAssessmentId, error: exeterAssessmentError } =
    await adminClient.rpc("start_maturity_assessment", {
      target_model_version_id: modelVersion.id,
      target_unit_id: exeterSiteId,
      target_assessment_type: "self",
      target_assessment_scope_type: "site",
    });

  if (exeterAssessmentError || !exeterAssessmentId) {
    throw new Error(
      `start_maturity_assessment failed (expected canonical 5-arg RPC contract): ${
        exeterAssessmentError?.message ??
        "missing assessment id — verify target_assessment_type and target_assessment_scope_type"
      }`,
    );
  }

  const { data: exeterAssessment, error: exeterAssessmentReadError } =
    await adminClient
      .from("maturity_assessments")
      .select("id, site_unit_id, unit_id")
      .eq("id", exeterAssessmentId)
      .maybeSingle();

  if (exeterAssessmentReadError || !exeterAssessment) {
    throw (
      exeterAssessmentReadError ??
      new Error("Exeter maturity assessment missing after seed")
    );
  }

  if (exeterAssessment.site_unit_id !== exeterSiteId) {
    throw new Error(
      `Exeter maturity assessment site snapshot mismatch: expected ${exeterSiteId}, got ${exeterAssessment.site_unit_id}`,
    );
  }

  return {
    organisationId,
    unitIds,
    bodminAssessmentId,
    exeterAssessmentId,
    exeterSiteId,
    bodminSiteId,
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
