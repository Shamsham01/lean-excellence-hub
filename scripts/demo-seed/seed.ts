import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DEMO_MATURITY_LEVELS,
  DEMO_MATURITY_PILLARS,
  DEMO_ORGANISATION,
  DEMO_PLATFORM_SAMPLES,
  DEMO_FIVE_S_CATEGORIES,
  DEMO_FIVE_S_STANDARD,
  DEMO_GEMBA_DEFINITION,
  DEMO_JOB_FUNCTIONS,
  DEMO_PROFICIENCY_SCALE,
  DEMO_ROLES,
  DEMO_SKILLS,
  DEMO_TRAINING_COURSES,
  DEMO_TRAINING_SESSION,
  DEMO_UNITS,
  DEMO_USERS,
} from "./constants";
import { invitationTokenDigest, invitationTokenFromSeed } from "./crypto";
import { loadLocalSupabaseEnv } from "./local-env";

type DemoUserKey = keyof typeof DEMO_USERS;

type UnitMap = Record<string, string>;

async function ensureAuthUser(admin: SupabaseClient, userKey: DemoUserKey) {
  const user = DEMO_USERS[userKey];
  const existing = await admin.auth.admin.getUserById(user.id);

  if (existing.error || !existing.data.user) {
    const created = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.displayName },
    });

    if (created.error && created.error.status !== 422) {
      throw created.error;
    }
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.displayName },
    });

    if (updated.error) {
      throw updated.error;
    }
  }

  const { error: enrolmentError } = await admin.rpc(
    "finalise_identity_enrolment",
    {
      target_user_id: user.id,
    },
  );

  if (enrolmentError) {
    throw enrolmentError;
  }
}

async function signInUser(
  apiUrl: string,
  publishableKey: string,
  userKey: DemoUserKey,
) {
  const user = DEMO_USERS[userKey];
  const client = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw error ?? new Error(`Unable to sign in ${user.email}`);
  }

  return client;
}

async function provisionOrganisation(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("provision_organisation", {
    owner_user_id: DEMO_USERS.admin.id,
    organisation_code: DEMO_ORGANISATION.code,
    organisation_name: DEMO_ORGANISATION.name,
  });

  if (error && !error.message.includes("duplicate key value")) {
    throw error;
  }

  return data as string | null;
}

async function resolveOrganisationId(client: SupabaseClient) {
  const { data, error } = await client.rpc("list_my_eligible_organisations");

  if (error) {
    throw error;
  }

  const organisations = (data ?? []) as Array<{
    organisation_id: string;
    organisation_code: string;
  }>;

  const organisation = organisations.find(
    (row) => row.organisation_code === DEMO_ORGANISATION.code,
  );

  if (!organisation) {
    throw new Error("Demo organisation was not found after provisioning.");
  }

  return organisation.organisation_id;
}

async function switchOrganisation(
  client: SupabaseClient,
  organisationId: string,
) {
  const { data, error } = await client.rpc("switch_organisation", {
    target_organisation_id: organisationId,
  });

  if (error || data !== true) {
    throw error ?? new Error("Unable to select demo organisation.");
  }
}

async function ensureUnits(
  client: SupabaseClient,
  organisationId: string,
): Promise<UnitMap> {
  const unitIds: UnitMap = {};

  const { data: existingUnits, error: existingError } = await client
    .from("organisation_units")
    .select("id, code")
    .eq("organisation_id", organisationId);

  if (existingError) {
    throw existingError;
  }

  for (const unit of existingUnits ?? []) {
    unitIds[unit.code] = unit.id;
  }

  for (const unit of DEMO_UNITS) {
    if (unitIds[unit.code]) {
      continue;
    }

    const parentId = unit.parentKey ? unitIds[unit.parentKey] : null;
    const { data, error } = await client.rpc("create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: parentId,
      unit_code: unit.code,
      unit_name: unit.name,
      unit_type: unit.type,
    });

    if (error) {
      throw error;
    }

    unitIds[unit.code] = data as string;
  }

  return unitIds;
}

async function findPublishedRoleVersionId(
  client: SupabaseClient,
  organisationId: string,
  canonicalName: string,
) {
  const { data: roles, error: rolesError } = await client
    .from("roles")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("canonical_name", canonicalName)
    .maybeSingle();

  if (rolesError) {
    throw rolesError;
  }

  if (!roles) {
    return null;
  }

  const { data: version, error: versionError } = await client
    .from("role_versions")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("role_id", roles.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw versionError;
  }

  return version?.id ?? null;
}

async function ensurePublishedRole(
  client: SupabaseClient,
  organisationId: string,
  roleKey: keyof typeof DEMO_ROLES,
) {
  const role = DEMO_ROLES[roleKey];
  const existingVersionId = await findPublishedRoleVersionId(
    client,
    organisationId,
    role.canonicalName,
  );

  if (existingVersionId) {
    return existingVersionId;
  }

  const { data: draftVersionId, error: draftError } = await client.rpc(
    "create_role_draft",
    {
      target_organisation_id: organisationId,
      role_canonical_name: role.canonicalName,
      role_display_name: role.displayName,
      role_description: role.description,
    },
  );

  if (draftError) {
    throw draftError;
  }

  for (const permissionKey of role.permissions) {
    const { error } = await client.rpc("add_role_permission", {
      target_organisation_id: organisationId,
      target_role_version_id: draftVersionId,
      target_permission_key: permissionKey,
    });

    if (error) {
      throw error;
    }
  }

  const { error: publishError } = await client.rpc("publish_role_version", {
    target_organisation_id: organisationId,
    target_role_version_id: draftVersionId,
  });

  if (publishError) {
    throw publishError;
  }

  return draftVersionId as string;
}

async function userHasOrganisationMembership(
  ownerClient: SupabaseClient,
  organisationId: string,
  userId: string,
) {
  const { data, error } = await ownerClient
    .from("organisation_memberships")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function ensureInvitationAccepted(
  ownerClient: SupabaseClient,
  apiUrl: string,
  publishableKey: string,
  organisationId: string,
  userKey: Exclude<DemoUserKey, "admin">,
  roleVersionId: string,
  unitIds: UnitMap,
) {
  const alreadyMember = await userHasOrganisationMembership(
    ownerClient,
    organisationId,
    DEMO_USERS[userKey].id,
  );

  if (alreadyMember) {
    return;
  }

  const role = DEMO_ROLES[userKey];
  const token = invitationTokenFromSeed(role.invitationTokenSeed);
  const digest = invitationTokenDigest(token);
  const scopeUnitId =
    role.scopeUnitKey && unitIds[role.scopeUnitKey]
      ? unitIds[role.scopeUnitKey]
      : null;

  const invitee = await signInUser(apiUrl, publishableKey, userKey);
  const existingAccept = await invitee.rpc("accept_organisation_invitation", {
    invitation_token_digest: digest,
  });

  if (!existingAccept.error && existingAccept.data) {
    return;
  }

  const { error: inviteError } = await ownerClient.rpc(
    "issue_organisation_invitation",
    {
      target_organisation_id: organisationId,
      invitation_recipient_type: "email",
      invitation_canonical_recipient: DEMO_USERS[userKey].email,
      invitation_token_digest: digest,
      invitation_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      offered_role_version_id: roleVersionId,
      offered_scope_type: role.scopeType,
      offered_scope_unit_id: scopeUnitId,
    },
  );

  if (inviteError && inviteError.code !== "23505") {
    throw inviteError;
  }

  const { error: acceptError } = await invitee.rpc(
    "accept_organisation_invitation",
    {
      invitation_token_digest: digest,
    },
  );

  if (acceptError) {
    throw acceptError;
  }
}

async function ensureMaturityDemo(client: SupabaseClient, unitIds: UnitMap) {
  const { data: existing } = await client
    .from("maturity_models")
    .select("id")
    .eq("display_name", DEMO_PLATFORM_SAMPLES.maturityFrameworkName)
    .limit(1);

  if ((existing ?? []).length > 0) {
    return;
  }

  const { data: modelId, error: modelError } = await client.rpc(
    "create_maturity_model_draft",
    {
      target_display_name: DEMO_PLATFORM_SAMPLES.maturityFrameworkName,
      target_description: DEMO_PLATFORM_SAMPLES.maturityFrameworkDescription,
    },
  );

  if (modelError) {
    throw modelError;
  }

  const { data: version } = await client
    .from("maturity_model_versions")
    .select("id")
    .eq("model_id", modelId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!version) {
    throw new Error("Demo maturity version was not created.");
  }

  for (const level of DEMO_MATURITY_LEVELS) {
    await client.rpc("add_maturity_level", {
      target_model_version_id: version.id,
      target_level_number: level.number,
      target_name: level.name,
      target_color_token: level.color,
    });
  }

  let pillarPosition = 1;
  for (const pillar of DEMO_MATURITY_PILLARS) {
    const { data: pillarId, error: pillarError } = await client.rpc(
      "add_maturity_pillar",
      {
        target_model_version_id: version.id,
        target_name: pillar.name,
        target_position: pillarPosition,
        target_section_title: pillar.name,
      },
    );

    if (pillarError) {
      throw pillarError;
    }

    const { data: pillarRow } = await client
      .from("maturity_pillars")
      .select("section_id")
      .eq("id", pillarId)
      .maybeSingle();

    if (!pillarRow?.section_id) {
      throw new Error("Demo pillar section missing.");
    }

    let criterionPosition = 1;
    for (const criterionName of pillar.criteria) {
      const { data: criterionId, error: criterionError } = await client.rpc(
        "add_maturity_criterion",
        {
          target_pillar_id: pillarId,
          target_name: criterionName,
          target_position: criterionPosition,
        },
      );

      if (criterionError) {
        throw criterionError;
      }

      const { data: questionId, error: questionError } = await client.rpc(
        "add_maturity_question",
        {
          target_model_version_id: version.id,
          target_section_id: pillarRow.section_id,
          target_question_type: "score",
          target_prompt: `Rate: ${criterionName}`,
          target_position: criterionPosition,
          target_allows_not_applicable: true,
        },
      );

      if (questionError) {
        throw questionError;
      }

      await client.rpc("link_criterion_question", {
        target_criterion_id: criterionId,
        target_question_id: questionId,
        target_contributes_to_score: true,
        target_scoring_metadata: { type: "direct" },
      });

      criterionPosition += 1;
    }

    pillarPosition += 1;
  }

  await client.rpc("publish_maturity_model_version", {
    target_model_version_id: version.id,
  });

  const cornwallUnitId = unitIds["cornwall-plant"];
  if (!cornwallUnitId) {
    return;
  }

  const { data: historicalAssessmentId, error: histError } = await client.rpc(
    "start_maturity_assessment",
    {
      target_model_version_id: version.id,
      target_unit_id: cornwallUnitId,
      target_assessment_type: "formal",
    },
  );

  if (histError) {
    throw histError;
  }

  const { data: criteria } = await client
    .from("maturity_criteria")
    .select("id")
    .limit(3);

  for (const criterion of criteria ?? []) {
    const { data: links } = await client
      .from("maturity_criterion_questions")
      .select("question_id")
      .eq("criterion_id", criterion.id)
      .limit(1);

    const questionId = links?.[0]?.question_id;
    if (!questionId) continue;

    await client.rpc("upsert_maturity_assessment_answer", {
      target_assessment_id: historicalAssessmentId,
      target_question_id: questionId,
      target_number_value: 3.5,
    });
  }

  await client.rpc("submit_maturity_assessment", {
    target_assessment_id: historicalAssessmentId,
  });
  await client.rpc("begin_assessor_review", {
    target_assessment_id: historicalAssessmentId,
  });
  await client.rpc("approve_maturity_assessment", {
    target_assessment_id: historicalAssessmentId,
  });
  await client.rpc("publish_official_maturity_result", {
    target_assessment_id: historicalAssessmentId,
  });

  const { data: selfAssessmentId, error: selfError } = await client.rpc(
    "start_maturity_assessment",
    {
      target_model_version_id: version.id,
      target_unit_id: cornwallUnitId,
      target_assessment_type: "self",
    },
  );

  if (selfError) {
    throw selfError;
  }

  console.log(`Self assessment ready: ${selfAssessmentId}`);
}

async function ensureM6Demo(client: SupabaseClient, unitIds: UnitMap) {
  const operationsUnitId = unitIds[DEMO_FIVE_S_STANDARD.unitKey];
  if (!operationsUnitId) return;

  const { data: existing } = await client
    .from("five_s_standards")
    .select("id")
    .eq("display_name", DEMO_FIVE_S_STANDARD.name)
    .maybeSingle();

  if (existing) return;

  const { data: adminMembership } = await client
    .from("organisation_memberships")
    .select("id")
    .eq("user_id", DEMO_USERS.admin.id)
    .maybeSingle();

  if (!adminMembership?.id) return;

  const { data: fiveSStandardId, error: fiveSError } = await client.rpc(
    "create_five_s_standard_draft",
    {
      target_display_name: DEMO_FIVE_S_STANDARD.name,
      target_description: DEMO_FIVE_S_STANDARD.description,
      target_threshold_percent: 90,
    },
  );
  if (fiveSError) throw fiveSError;

  const { data: fiveSVersion } = await client
    .from("five_s_standard_versions")
    .select("id")
    .eq("standard_id", fiveSStandardId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!fiveSVersion?.id) throw new Error("Demo 5S version missing");

  let position = 1;
  for (const category of DEMO_FIVE_S_CATEGORIES) {
    const { data: sectionId, error: sectionError } = await client.rpc(
      "add_five_s_section",
      {
        target_standard_version_id: fiveSVersion.id,
        target_title: category,
        target_position: position,
      },
    );
    if (sectionError) throw sectionError;

    await client.rpc("add_five_s_question", {
      target_standard_version_id: fiveSVersion.id,
      target_section_id: sectionId,
      target_question_type: "yes_no",
      target_prompt: `${category}: area meets standard?`,
      target_position: 1,
      target_contributes_to_score: true,
      target_scoring_metadata: { type: "yes_no", yes_value: 100, no_value: 0 },
    });
    position += 1;
  }

  await client.rpc("publish_five_s_standard_version", {
    target_standard_version_id: fiveSVersion.id,
  });

  const { data: gembaDefinitionId, error: gembaError } = await client.rpc(
    "create_gemba_definition_draft",
    {
      target_display_name: DEMO_GEMBA_DEFINITION.name,
      target_description: DEMO_GEMBA_DEFINITION.description,
      target_expected_duration_minutes: 45,
    },
  );
  if (gembaError) throw gembaError;

  const { data: gembaVersion } = await client
    .from("gemba_definition_versions")
    .select("id")
    .eq("definition_id", gembaDefinitionId)
    .maybeSingle();

  if (gembaVersion?.id) {
    const { data: sectionId, error: gembaSectionError } = await client.rpc(
      "add_gemba_section",
      {
        target_definition_version_id: gembaVersion.id,
        target_title: "Operations floor",
        target_position: 1,
      },
    );
    if (gembaSectionError) throw gembaSectionError;

    const { error: gembaQuestionError } = await client.rpc(
      "add_gemba_question",
      {
        target_definition_version_id: gembaVersion.id,
        target_section_id: sectionId,
        target_question_type: "long_text",
        target_prompt: "What did you observe on the operations floor?",
        target_position: 1,
      },
    );
    if (gembaQuestionError) throw gembaQuestionError;
    await client.rpc("publish_gemba_definition_version", {
      target_definition_version_id: gembaVersion.id,
    });
  }

  await client.rpc("create_schedule_definition", {
    target_activity_resource_id: fiveSStandardId,
    target_title: "Weekly Production 5S",
    target_unit_id: operationsUnitId,
    target_owner_membership_id: adminMembership.id,
    target_recurrence: {
      frequency: "weekly",
      interval: 1,
      weekdays: ["monday"],
    },
    target_start_date: new Date().toISOString().slice(0, 10),
    target_is_all_day: true,
  });

  if (gembaDefinitionId) {
    await client.rpc("create_schedule_definition", {
      target_activity_resource_id: gembaDefinitionId,
      target_title: "Weekly Operations Gemba",
      target_unit_id: operationsUnitId,
      target_owner_membership_id: adminMembership.id,
      target_recurrence: {
        frequency: "weekly",
        interval: 1,
        weekdays: ["wednesday"],
      },
      target_start_date: new Date().toISOString().slice(0, 10),
      target_is_all_day: false,
      target_local_time: "09:00:00",
    });
  }

  const { data: completedAuditId } = await client.rpc("start_five_s_audit", {
    target_standard_id: fiveSStandardId,
    target_unit_id: operationsUnitId,
  });

  if (completedAuditId) {
    const { data: version } = await client
      .from("five_s_standard_versions")
      .select("template_version_id")
      .eq("id", fiveSVersion.id)
      .maybeSingle();

    const { data: questions } = await client
      .from("template_questions")
      .select("id")
      .eq("template_version_id", version?.template_version_id ?? "");

    for (const q of questions ?? []) {
      await client.rpc("upsert_five_s_audit_answer", {
        target_audit_id: completedAuditId,
        target_question_id: q.id,
        target_text_value: "yes",
      });
    }

    await client.rpc("complete_five_s_audit", {
      target_audit_id: completedAuditId,
    });
  }

  if (gembaDefinitionId) {
    const { data: walkId } = await client.rpc("start_gemba_walk", {
      target_definition_id: gembaDefinitionId,
      target_unit_id: operationsUnitId,
    });
    if (walkId) {
      await client.rpc("create_gemba_observation", {
        target_walk_id: walkId,
        target_observation_text:
          "Operator updated visual standard after improvement.",
        target_observation_type: "positive_practice",
      });
      await client.rpc("complete_gemba_walk", {
        target_walk_id: walkId,
        target_summary_notes: "Completed demo operations Gemba.",
      });
    }
  }
}

async function ensurePlatformSamples(client: SupabaseClient) {
  const { count: actionCount, error: actionCountError } = await client
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("title", DEMO_PLATFORM_SAMPLES.actionTitle);

  if (actionCountError) {
    throw actionCountError;
  }

  if ((actionCount ?? 0) === 0) {
    const { error } = await client.rpc("create_action", {
      target_title: DEMO_PLATFORM_SAMPLES.actionTitle,
      target_description:
        "Demonstration action seeded for local Milestone 4 development.",
      target_priority: "normal",
    });

    if (error) {
      throw error;
    }
  }

  const { data: templates, error: templateError } = await client
    .from("templates")
    .select("id")
    .eq("display_name", DEMO_PLATFORM_SAMPLES.templateName)
    .limit(1);

  if (templateError) {
    throw templateError;
  }

  if ((templates ?? []).length > 0) {
    return;
  }

  const { data: templateId, error: createTemplateError } = await client.rpc(
    "create_template_draft",
    {
      target_display_name: DEMO_PLATFORM_SAMPLES.templateName,
      target_description: DEMO_PLATFORM_SAMPLES.templateDescription,
    },
  );

  if (createTemplateError) {
    throw createTemplateError;
  }

  const { data: templateVersion, error: versionError } = await client
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("version_number", 1)
    .maybeSingle();

  if (versionError || !templateVersion) {
    throw versionError ?? new Error("Demo template version was not created.");
  }

  const { error: publishError } = await client.rpc("publish_template_version", {
    target_template_version_id: templateVersion.id,
  });

  if (publishError) {
    throw publishError;
  }
}

async function ensureM7Demo(client: SupabaseClient, unitIds: UnitMap) {
  const operationsUnitId = unitIds[DEMO_FIVE_S_STANDARD.unitKey];
  if (!operationsUnitId) return;

  const { data: existingCourse } = await client
    .from("training_courses")
    .select("id")
    .eq("code", "lean-basic")
    .maybeSingle();

  if (existingCourse) return;

  const jobFunctionIds: Record<string, string> = {};
  for (const jf of DEMO_JOB_FUNCTIONS) {
    const { data: id, error } = await client.rpc("create_job_function", {
      target_name: jf.name,
      target_code: jf.code,
    });
    if (error) throw error;
    jobFunctionIds[jf.code] = id as string;
  }

  const courseIds: Record<string, string> = {};
  const courseVersionIds: Record<string, string> = {};
  for (const course of DEMO_TRAINING_COURSES) {
    const { data: courseId, error } = await client.rpc(
      "create_training_course_draft",
      {
        target_name: course.name,
        target_code: course.code,
      },
    );
    if (error) throw error;
    courseIds[course.code] = courseId as string;

    const { data: version } = await client
      .from("training_course_versions")
      .select("id")
      .eq("course_id", courseId)
      .eq("version_number", 1)
      .maybeSingle();

    if (!version?.id) throw new Error(`Missing version for ${course.code}`);

    await client.rpc("update_training_course_draft_version", {
      target_course_version_id: version.id,
      target_validity_days: course.validityDays,
      target_delivery_method: "classroom",
    });
    await client.rpc("publish_training_course_version", {
      target_course_version_id: version.id,
    });
    courseVersionIds[course.code] = version.id;
  }

  const { data: curriculumId, error: curriculumError } = await client.rpc(
    "create_training_curriculum_draft",
    {
      target_name: "Apex Training Curriculum",
      target_code: "apex-curriculum",
    },
  );
  if (curriculumError) throw curriculumError;

  const { data: curriculumVersion } = await client
    .from("training_curriculum_versions")
    .select("id")
    .eq("curriculum_id", curriculumId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!curriculumVersion?.id)
    throw new Error("Demo curriculum version missing");

  const curriculumRules: Array<{ jobFunction: string; courses: string[] }> = [
    { jobFunction: "operator", courses: ["lean-basic"] },
    {
      jobFunction: "team-leader",
      courses: ["lean-basic", "white-belt", "five-s-practitioner"],
    },
    {
      jobFunction: "engineer",
      courses: ["lean-basic", "yellow-belt", "problem-solving"],
    },
    { jobFunction: "shift-manager", courses: ["lean-basic", "yellow-belt"] },
    { jobFunction: "department-manager", courses: ["green-belt"] },
  ];

  for (const rule of curriculumRules) {
    for (const courseCode of rule.courses) {
      await client.rpc("add_training_requirement", {
        target_curriculum_version_id: curriculumVersion.id,
        target_course_id: courseIds[courseCode],
        target_job_function_id: jobFunctionIds[rule.jobFunction],
        target_mandatory: true,
      });
    }
  }

  await client.rpc("publish_training_curriculum_version", {
    target_curriculum_version_id: curriculumVersion.id,
  });

  const { data: scaleId, error: scaleError } = await client.rpc(
    "create_skill_proficiency_scale_draft",
    {
      target_name: DEMO_PROFICIENCY_SCALE.name,
    },
  );
  if (scaleError) throw scaleError;

  const { data: scaleVersion } = await client
    .from("skill_proficiency_scale_versions")
    .select("id")
    .eq("scale_id", scaleId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!scaleVersion?.id) throw new Error("Demo scale version missing");

  const levelIds: Record<number, string> = {};
  for (const level of DEMO_PROFICIENCY_SCALE.levels) {
    const { data: levelId, error } = await client.rpc(
      "add_skill_proficiency_level",
      {
        target_scale_version_id: scaleVersion.id,
        target_order_value: level.order,
        target_label: level.label,
      },
    );
    if (error) throw error;
    levelIds[level.order] = levelId as string;
  }

  await client.rpc("publish_skill_proficiency_scale_version", {
    target_scale_version_id: scaleVersion.id,
  });

  const skillIds: Record<string, string> = {};
  for (const skill of DEMO_SKILLS) {
    const { data: skillId, error } = await client.rpc("create_skill", {
      target_name: skill.name,
      target_code: skill.code,
    });
    if (error) throw error;
    skillIds[skill.code] = skillId as string;
  }

  const { data: capabilitySetId, error: setError } = await client.rpc(
    "create_skill_capability_set_draft",
    {
      target_name: "Apex Capability Requirements",
      target_code: "apex-capability",
    },
  );
  if (setError) throw setError;

  const { data: capabilityVersion } = await client
    .from("skill_capability_set_versions")
    .select("id")
    .eq("capability_set_id", capabilitySetId)
    .eq("version_number", 1)
    .maybeSingle();

  if (!capabilityVersion?.id)
    throw new Error("Demo capability set version missing");

  await client.rpc("add_skill_requirement", {
    target_capability_set_version_id: capabilityVersion.id,
    target_skill_id: skillIds["a3-facilitation"],
    target_job_function_id: jobFunctionIds["team-leader"],
    target_proficiency_scale_version_id: scaleVersion.id,
    target_target_proficiency_level_id: levelIds[3],
  });

  await client.rpc("add_skill_requirement", {
    target_capability_set_version_id: capabilityVersion.id,
    target_skill_id: skillIds["five-s-auditing"],
    target_job_function_id: jobFunctionIds["operator"],
    target_proficiency_scale_version_id: scaleVersion.id,
    target_target_proficiency_level_id: levelIds[4],
  });

  await client.rpc("publish_skill_capability_set_version", {
    target_capability_set_version_id: capabilityVersion.id,
  });

  const { data: memberships } = await client
    .from("organisation_memberships")
    .select("id, user_id")
    .in("user_id", [DEMO_USERS.manager.id, DEMO_USERS.operator.id]);

  const managerMembership = memberships?.find(
    (m) => m.user_id === DEMO_USERS.manager.id,
  );
  const operatorMembership = memberships?.find(
    (m) => m.user_id === DEMO_USERS.operator.id,
  );

  if (managerMembership?.id) {
    await client.rpc("assign_membership_job_function", {
      target_membership_id: managerMembership.id,
      target_job_function_id: jobFunctionIds["team-leader"],
      target_primary: true,
      target_organisational_unit_id: operationsUnitId,
    });
  }

  if (operatorMembership?.id) {
    await client.rpc("assign_membership_job_function", {
      target_membership_id: operatorMembership.id,
      target_job_function_id: jobFunctionIds["operator"],
      target_primary: true,
      target_organisational_unit_id: operationsUnitId,
    });

    await client.rpc("record_training_completion", {
      target_membership_id: operatorMembership.id,
      target_course_version_id: courseVersionIds["lean-basic"],
      target_completed_at: new Date().toISOString(),
      target_completion_method: "classroom",
    });

    await client.rpc("record_skill_validation", {
      target_membership_id: operatorMembership.id,
      target_skill_id: skillIds["five-s-auditing"],
      target_proficiency_scale_version_id: scaleVersion.id,
      target_proficiency_level_id: levelIds[3],
      target_assessment_method: "manager_assessment",
    });
  }

  if (managerMembership?.id) {
    const scheduledStart = new Date();
    scheduledStart.setDate(scheduledStart.getDate() + 7);
    const { data: sessionId, error: sessionError } = await client.rpc(
      "create_training_session",
      {
        target_course_version_id:
          courseVersionIds[DEMO_TRAINING_SESSION.courseCode],
        target_title: DEMO_TRAINING_SESSION.title,
        target_organisational_unit_id: operationsUnitId,
        target_scheduled_start: scheduledStart.toISOString(),
        target_scheduled_end: new Date(
          scheduledStart.getTime() + 2 * 60 * 60 * 1000,
        ).toISOString(),
        target_location: "Cornwall Plant Training Room",
      },
    );
    if (sessionError) throw sessionError;

    await client.rpc("add_training_session_participant", {
      target_session_id: sessionId as string,
      target_membership_id: managerMembership.id,
    });
  }

  console.log("M7 demo: job functions, training, and skills seeded.");
}

async function ensureDemoDisplayNames(apiUrl: string, publishableKey: string) {
  for (const userKey of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    const user = DEMO_USERS[userKey];
    const client = await signInUser(apiUrl, publishableKey, userKey);
    const { error } = await client
      .from("profiles")
      .update({ display_name: user.displayName })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
  }

  const seedDir = dirname(fileURLToPath(import.meta.url));
  execSync(
    `npx supabase db query --local -f "${join(seedDir, "set-membership-display-names.sql")}"`,
    { stdio: "inherit" },
  );
  execSync(
    `npx supabase db query --local -f "${join(seedDir, "set-profile-display-names.sql")}"`,
    { stdio: "inherit" },
  );
}

async function main() {
  const env = loadLocalSupabaseEnv();
  const admin = createClient(env.apiUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(
    "Seeding Apex Manufacturing demo tenant (local development only)...",
  );

  for (const userKey of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    await ensureAuthUser(admin, userKey);
  }

  await provisionOrganisation(admin);

  const adminClient = await signInUser(env.apiUrl, env.publishableKey, "admin");
  const organisationId = await resolveOrganisationId(adminClient);
  await switchOrganisation(adminClient, organisationId);

  const unitIds = await ensureUnits(adminClient, organisationId);
  const managerRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "manager",
  );
  const operatorRoleVersionId = await ensurePublishedRole(
    adminClient,
    organisationId,
    "operator",
  );

  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "manager",
    managerRoleVersionId,
    unitIds,
  );
  await ensureInvitationAccepted(
    adminClient,
    env.apiUrl,
    env.publishableKey,
    organisationId,
    "operator",
    operatorRoleVersionId,
    unitIds,
  );

  await ensureDemoDisplayNames(env.apiUrl, env.publishableKey);

  await ensurePlatformSamples(adminClient);
  await ensureMaturityDemo(adminClient, unitIds);
  await ensureM6Demo(adminClient, unitIds);
  await ensureM7Demo(adminClient, unitIds);

  console.log("Demo seed complete.");
  console.log(
    `Organisation: ${DEMO_ORGANISATION.name} (${DEMO_ORGANISATION.code})`,
  );
  console.log("Admin login: admin@apex.local");
  console.log(
    "Routes: /platform, /platform/maturity, /platform/5s, /platform/gemba, /platform/schedule",
  );
  console.log("Reset: npm run db:reset && npm run db:seed-demo");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
