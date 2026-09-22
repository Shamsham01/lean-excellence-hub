import type { SupabaseClient } from "@supabase/supabase-js";

import { expectRpc } from "./shared/auth";

export const QA_ISOLATION_ORGANISATION = {
  code: "qa-isolation-canary",
  name: "QA Isolation Canary",
} as const;

export const QA_ISOLATION_USER = {
  id: "c0000000-0000-0000-0000-000000000001",
  email: "isolation-canary@cookieworks.local",
  password: "Isolation@Canary-QA-2026!",
  displayName: "QA Isolation Canary Owner",
} as const;

export async function ensureIsolationCanaryTenant(admin: SupabaseClient) {
  const existing = await admin.auth.admin.getUserById(QA_ISOLATION_USER.id);

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: QA_ISOLATION_USER.id,
      email: QA_ISOLATION_USER.email,
      password: QA_ISOLATION_USER.password,
      email_confirm: true,
      user_metadata: { full_name: QA_ISOLATION_USER.displayName },
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  }

  const { error: enrolmentError } = await admin.rpc(
    "finalise_identity_enrolment",
    {
      target_user_id: QA_ISOLATION_USER.id,
    },
  );

  if (enrolmentError) {
    throw enrolmentError;
  }

  const { error: provisionError } = await admin.rpc("provision_organisation", {
    owner_user_id: QA_ISOLATION_USER.id,
    organisation_code: QA_ISOLATION_ORGANISATION.code,
    organisation_name: QA_ISOLATION_ORGANISATION.name,
  });

  if (
    provisionError &&
    !provisionError.message.includes("duplicate key value")
  ) {
    throw provisionError;
  }
}

async function assertIsolationCanaryPublishReady(
  client: SupabaseClient,
  versionId: string,
) {
  const { count: levelCount, error: levelError } = await client
    .from("maturity_levels")
    .select("id", { count: "exact", head: true })
    .eq("model_version_id", versionId);

  if (levelError) {
    throw levelError;
  }

  const { count: pillarCount, error: pillarError } = await client
    .from("maturity_pillars")
    .select("id", { count: "exact", head: true })
    .eq("model_version_id", versionId);

  if (pillarError) {
    throw pillarError;
  }

  const { data: pillars, error: pillarListError } = await client
    .from("maturity_pillars")
    .select("id")
    .eq("model_version_id", versionId);

  if (pillarListError) {
    throw pillarListError;
  }

  const pillarIds = (pillars ?? []).map((pillar) => pillar.id);

  const { count: criterionCount, error: criterionError } = await client
    .from("maturity_criteria")
    .select("id", { count: "exact", head: true })
    .in("pillar_id", pillarIds);

  if (criterionError) {
    throw criterionError;
  }

  const { data: criteria, error: criteriaListError } = await client
    .from("maturity_criteria")
    .select("id")
    .in("pillar_id", pillarIds);

  if (criteriaListError) {
    throw criteriaListError;
  }

  const criterionIds = (criteria ?? []).map((criterion) => criterion.id);

  const { count: linkedQuestionCount, error: linkError } = await client
    .from("maturity_criterion_questions")
    .select("id", { count: "exact", head: true })
    .in("criterion_id", criterionIds)
    .eq("contributes_to_score", true);

  if (linkError) {
    throw linkError;
  }

  if ((levelCount ?? 0) < 1) {
    throw new Error("Isolation canary maturity version requires a level.");
  }

  if ((pillarCount ?? 0) < 1) {
    throw new Error("Isolation canary maturity version requires a pillar.");
  }

  if ((criterionCount ?? 0) < 1) {
    throw new Error("Isolation canary maturity version requires a criterion.");
  }

  if ((linkedQuestionCount ?? 0) < 1) {
    throw new Error(
      "Isolation canary maturity version requires a scored linked question.",
    );
  }
}

export async function seedIsolationCanaryModuleRecord(
  apiUrl: string,
  publishableKey: string,
) {
  const { createClient } = await import("@supabase/supabase-js");

  const client = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({
    email: QA_ISOLATION_USER.email,
    password: QA_ISOLATION_USER.password,
  });

  if (signInError) {
    throw signInError;
  }

  const { data: organisations, error: listError } = await client.rpc(
    "list_my_eligible_organisations",
  );

  if (listError) {
    throw listError;
  }

  const organisation = (organisations ?? []).find(
    (row: { organisation_code: string }) =>
      row.organisation_code === QA_ISOLATION_ORGANISATION.code,
  );

  if (!organisation) {
    throw new Error(
      "Isolation canary organisation not found after provisioning.",
    );
  }

  await expectRpc(client, "switch_organisation", {
    target_organisation_id: organisation.organisation_id,
  });

  const { count: existingModels } = await client
    .from("maturity_models")
    .select("id", { count: "exact", head: true });

  if ((existingModels ?? 0) > 0) {
    return organisation.organisation_id as string;
  }

  const modelId = (await expectRpc(client, "create_maturity_model_draft", {
    target_display_name: "Isolation Canary Framework",
    target_description: "Unrelated tenant control record.",
  })) as string;

  const { data: version } = await client
    .from("maturity_model_versions")
    .select("id")
    .eq("model_id", modelId)
    .eq("version_number", 1)
    .single();

  if (!version?.id) {
    throw new Error("Isolation canary maturity version missing.");
  }

  await expectRpc(client, "add_maturity_level", {
    target_model_version_id: version.id,
    target_level_number: 1,
    target_name: "Initial",
    target_color_token: "slate",
  });

  const pillarId = (await expectRpc(client, "add_maturity_pillar", {
    target_model_version_id: version.id,
    target_name: "Canary pillar",
    target_position: 1,
    target_section_title: "Canary pillar",
  })) as string;

  const { data: pillarRow } = await client
    .from("maturity_pillars")
    .select("section_id")
    .eq("id", pillarId)
    .single();

  const criterionId = (await expectRpc(client, "add_maturity_criterion", {
    target_pillar_id: pillarId,
    target_name: "Canary criterion",
    target_position: 1,
  })) as string;

  const questionId = (await expectRpc(client, "add_maturity_question", {
    target_model_version_id: version.id,
    target_section_id: pillarRow?.section_id,
    target_question_type: "score",
    target_prompt: "Rate canary standard work adherence",
    target_position: 1,
    target_allows_not_applicable: true,
  })) as string;

  await expectRpc(client, "link_criterion_question", {
    target_criterion_id: criterionId,
    target_question_id: questionId,
    target_contributes_to_score: true,
    target_scoring_metadata: { type: "direct" },
  });

  await assertIsolationCanaryPublishReady(client, version.id);

  await expectRpc(client, "publish_maturity_model_version", {
    target_model_version_id: version.id,
  });

  return organisation.organisation_id as string;
}
