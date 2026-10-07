import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const skillsAuthoringUser = {
  id: "e2e00000-0000-0000-0000-000000000266",
  email: "skills-authoring-e2e@example.test",
  password: "SkillsAuthoringE2ePassword123!",
} as const;

export type SkillsAuthoringOrganisation = {
  email: string;
  password: string;
  organisationName: string;
  jobFunctionName: string;
  displayName: string;
};

function resolveSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && serviceRoleKey && publishableKey) {
    return { url, serviceRoleKey, publishableKey };
  }

  const output = execSync("npx supabase status -o json", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  const status = JSON.parse(output) as {
    API_URL?: string;
    ANON_KEY?: string;
    SERVICE_ROLE_KEY?: string;
  };

  return {
    url: url ?? status.API_URL,
    serviceRoleKey: serviceRoleKey ?? status.SERVICE_ROLE_KEY,
    publishableKey: publishableKey ?? status.ANON_KEY,
  };
}

async function ensureAuthUser(admin: SupabaseClient) {
  const existing = await admin.auth.admin.getUserById(skillsAuthoringUser.id);

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: skillsAuthoringUser.id,
      email: skillsAuthoringUser.email,
      password: skillsAuthoringUser.password,
      email_confirm: true,
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  }
}

export async function ensureSkillsAuthoringOrganisation(): Promise<SkillsAuthoringOrganisation> {
  const { url, serviceRoleKey, publishableKey } = resolveSupabaseEnv();

  if (!url || !serviceRoleKey || !publishableKey) {
    throw new Error(
      "Supabase URL, publishable key, and service role key are required",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await ensureAuthUser(admin);

  const stamp = Date.now();
  const organisationCode = `skills-e2e-${stamp}`.slice(0, 32);
  const organisationName = `Skills Authoring ${stamp}`;
  const jobFunctionName = "Production Operator";
  const displayName = "Skills Framework Owner";

  const { data: organisationId, error: provisionError } = await admin.rpc(
    "provision_organisation",
    {
      owner_user_id: skillsAuthoringUser.id,
      organisation_code: organisationCode,
      organisation_name: organisationName,
    },
  );

  if (provisionError || !organisationId) {
    throw provisionError ?? new Error("Organisation was not provisioned");
  }

  const owner = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await owner.auth.signInWithPassword({
    email: skillsAuthoringUser.email,
    password: skillsAuthoringUser.password,
  });

  if (signInError) {
    throw signInError;
  }

  const { error: switchError } = await owner.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (switchError) {
    throw switchError;
  }

  await owner
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", skillsAuthoringUser.id);

  const { data: organisations, error: organisationsError } = await owner.rpc(
    "list_my_eligible_organisations",
  );

  if (organisationsError) {
    throw organisationsError;
  }

  const membershipId = (
    organisations as
      | Array<{ organisation_id: string; membership_id: string }>
      | null
  )?.find(
    (organisation) => organisation.organisation_id === organisationId,
  )?.membership_id;

  if (!membershipId) {
    throw new Error("Owner membership was not found");
  }

  const { data: unitId, error: unitError } = await owner.rpc(
    "create_organisation_unit",
    {
      target_organisation_id: organisationId,
      target_parent_unit_id: null,
      unit_code: "skills-site",
      unit_name: "Skills Site",
      unit_type: "site",
    },
  );

  if (unitError || !unitId) {
    throw unitError ?? new Error("Site was not created");
  }

  const { data: jobFunctionId, error: jobFunctionError } = await owner.rpc(
    "create_job_function",
    {
      target_name: jobFunctionName,
      target_code: "production-operator",
    },
  );

  if (jobFunctionError || !jobFunctionId) {
    throw jobFunctionError ?? new Error("Job function was not created");
  }

  const { error: assignmentError } = await owner.rpc(
    "assign_membership_job_function",
    {
      target_membership_id: membershipId,
      target_job_function_id: jobFunctionId,
      target_primary: true,
      target_organisational_unit_id: unitId,
    },
  );

  if (assignmentError) {
    throw assignmentError;
  }

  const { data: directory } = await owner.rpc("get_people_directory", {
    target_page: 1,
    target_page_size: 20,
  });
  const people = (
    directory as { people?: Array<{ display_name?: string | null }> } | null
  )?.people;
  const resolvedName = people?.find((person) => person.display_name)
    ?.display_name;

  return {
    email: skillsAuthoringUser.email,
    password: skillsAuthoringUser.password,
    organisationName,
    jobFunctionName,
    displayName: resolvedName || "Person",
  };
}
