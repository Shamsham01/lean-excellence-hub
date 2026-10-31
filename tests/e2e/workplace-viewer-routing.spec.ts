import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { invitationExpiresAt } from "@/modules/identity/invitation-constants";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";

const publishedStandardName = "Published Bakery Standard";
const draftStandardName = "Unpublished Bakery Standard";
const publishedAuditArea = "Published Audit Area";
const hiddenProgressArea = "Hidden Progress Area";
const siblingAuditArea = "Sibling Bakery";
const closedAuditArea = "Closed Bakery";
const publishedGembaName = "Published Bakery Walk";
const sharedSuggestionTitle = "Shared bakery idea";
const ownSuggestionTitle = "Line stoppage idea";

type MemberCredentials = {
  email: string;
  password: string;
  userId: string;
};

type WorkplaceRoutingFixture = {
  organisationName: string;
  viewer: MemberCredentials;
  reader: MemberCredentials;
  contributor: MemberCredentials;
  draftStandardId: string;
  inProgressAuditId: string;
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

function invitationTokenDigest(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}

async function rpc<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`${fn}: ${error.message}`);
  }
  return data as T;
}

async function createAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const userId = randomUUID();
  const created = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const enrolment = await admin.rpc("finalise_identity_enrolment", {
    target_user_id: userId,
  });
  if (enrolment.error) throw enrolment.error;
  return userId;
}

async function signInClient(
  url: string,
  publishableKey: string,
  email: string,
  password: string,
) {
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return client;
}

async function inviteMember(input: {
  owner: SupabaseClient;
  url: string;
  publishableKey: string;
  email: string;
  password: string;
  displayName: string;
  userId: string;
  grants: Array<{
    role_version_id: string;
    scope_type: string;
    scope_unit_id?: string;
  }>;
  unitId: string;
  jobFunctionId: string;
}) {
  const token = randomBytes(32).toString("base64url");
  await rpc(input.owner, "issue_organisation_member_invitation_grants", {
    invitation_recipient_type: "email",
    invitation_canonical_recipient: input.email,
    invitation_token_digest: invitationTokenDigest(token),
    invitation_expires_at: invitationExpiresAt(),
    offered_grants: input.grants,
    intended_display_name: input.displayName,
    intended_job_function_id: input.jobFunctionId,
    intended_organisational_unit_id: input.unitId,
  });

  const member = await signInClient(
    input.url,
    input.publishableKey,
    input.email,
    input.password,
  );
  await rpc(member, "accept_organisation_invitation", {
    invitation_token_digest: invitationTokenDigest(token),
  });
  return member;
}

async function provisionWorkplaceRoutingFixture(): Promise<WorkplaceRoutingFixture> {
  const { url, serviceRoleKey, publishableKey } = resolveSupabaseEnv();
  if (!url || !serviceRoleKey || !publishableKey) {
    throw new Error(
      "Supabase URL, publishable key, and service role key are required",
    );
  }

  const stamp = Date.now().toString(36);
  const organisationName = `Workplace Routing ${stamp}`;
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ownerPassword = "WorkplaceOwnerPassword123!";
  const ownerEmail = `workplace-owner-${stamp}@example.test`;
  const ownerUserId = await createAuthUser(admin, ownerEmail, ownerPassword);
  const organisationId = await rpc<string>(admin, "provision_organisation", {
    owner_user_id: ownerUserId,
    organisation_code: `workplace-${stamp}`.slice(0, 32),
    organisation_name: organisationName,
  });

  const owner = await signInClient(
    url,
    publishableKey,
    ownerEmail,
    ownerPassword,
  );
  await rpc(owner, "switch_organisation", {
    target_organisation_id: organisationId,
  });

  async function createUnit(code: string, name: string, parent: string | null) {
    return rpc<string>(owner, "create_organisation_unit", {
      target_organisation_id: organisationId,
      target_parent_unit_id: parent,
      unit_code: code,
      unit_name: name,
      unit_type: parent ? "area" : "site",
    });
  }

  const siteA = await createUnit("site-a", "Bodmin Bakery", null);
  const siteB = await createUnit("site-b", "Exeter Bakery", null);
  const siteC = await createUnit("site-c", "Closed Bakery Site", null);
  const auditArea = await createUnit("audit-area", publishedAuditArea, siteA);
  const hiddenArea = await createUnit("hidden-area", hiddenProgressArea, siteA);
  const siblingArea = await createUnit("sibling-area", siblingAuditArea, siteB);
  const closedArea = await createUnit("closed-area", closedAuditArea, siteC);

  const standardId = await rpc<string>(owner, "create_five_s_standard_draft", {
    target_display_name: publishedStandardName,
    target_description: "Published for workplace viewing",
    target_threshold_percent: 90,
  });
  const versionId = await singleId(owner, "five_s_standard_versions", {
    column: "standard_id",
    value: standardId,
  });
  const sectionId = await rpc<string>(owner, "add_five_s_section", {
    target_standard_version_id: versionId,
    target_title: "Sort",
    target_position: 1,
  });
  const questionId = await rpc<string>(owner, "add_five_s_question", {
    target_standard_version_id: versionId,
    target_section_id: sectionId,
    target_question_type: "yes_no",
    target_prompt: "Meets standard?",
    target_position: 1,
    target_is_required: true,
    target_allows_not_applicable: false,
    target_contributes_to_score: true,
    target_scoring_metadata: { type: "yes_no", yes_value: 100, no_value: 0 },
    target_weight: 1,
  });
  await rpc(owner, "set_five_s_standard_applicable_units", {
    target_standard_id: standardId,
    target_unit_ids: [auditArea, hiddenArea, siblingArea, closedArea],
  });
  await rpc(owner, "publish_five_s_standard_version", {
    target_standard_version_id: versionId,
  });

  const completedAuditId = await rpc<string>(owner, "start_five_s_audit", {
    target_standard_id: standardId,
    target_unit_id: auditArea,
  });
  await rpc(owner, "upsert_five_s_audit_answer", {
    target_audit_id: completedAuditId,
    target_question_id: questionId,
    target_is_not_applicable: false,
    target_text_value: "yes",
  });
  await rpc(owner, "complete_five_s_audit", {
    target_audit_id: completedAuditId,
  });

  const inProgressAuditId = await rpc<string>(owner, "start_five_s_audit", {
    target_standard_id: standardId,
    target_unit_id: hiddenArea,
  });
  const siblingAuditId = await rpc<string>(owner, "start_five_s_audit", {
    target_standard_id: standardId,
    target_unit_id: siblingArea,
  });
  await rpc(owner, "upsert_five_s_audit_answer", {
    target_audit_id: siblingAuditId,
    target_question_id: questionId,
    target_is_not_applicable: false,
    target_text_value: "yes",
  });
  await rpc(owner, "complete_five_s_audit", {
    target_audit_id: siblingAuditId,
  });
  const closedAuditId = await rpc<string>(owner, "start_five_s_audit", {
    target_standard_id: standardId,
    target_unit_id: closedArea,
  });
  await rpc(owner, "upsert_five_s_audit_answer", {
    target_audit_id: closedAuditId,
    target_question_id: questionId,
    target_is_not_applicable: false,
    target_text_value: "yes",
  });
  await rpc(owner, "complete_five_s_audit", { target_audit_id: closedAuditId });

  const draftStandardId = await rpc<string>(
    owner,
    "create_five_s_standard_draft",
    {
      target_display_name: draftStandardName,
      target_description: "Must stay hidden",
      target_threshold_percent: 90,
    },
  );

  const definitionId = await rpc<string>(
    owner,
    "create_gemba_definition_draft",
    {
      target_display_name: publishedGembaName,
      target_description: "Published walk",
    },
  );
  const definitionVersionId = await singleId(
    owner,
    "gemba_definition_versions",
    {
      column: "definition_id",
      value: definitionId,
    },
  );
  const gembaSectionId = await rpc<string>(owner, "add_gemba_section", {
    target_definition_version_id: definitionVersionId,
    target_title: "Safety",
    target_position: 1,
  });
  const gembaQuestionId = await rpc<string>(owner, "add_gemba_question", {
    target_definition_version_id: definitionVersionId,
    target_section_id: gembaSectionId,
    target_question_type: "short_text",
    target_prompt: "What is visible?",
    target_position: 1,
  });
  await rpc(owner, "set_gemba_definition_applicable_units", {
    target_definition_id: definitionId,
    target_unit_ids: [auditArea],
  });
  await rpc(owner, "publish_gemba_definition_version", {
    target_definition_version_id: definitionVersionId,
  });
  const walkId = await rpc<string>(owner, "start_gemba_walk", {
    target_definition_id: definitionId,
    target_unit_id: auditArea,
  });
  await rpc(owner, "upsert_gemba_walk_answer", {
    target_walk_id: walkId,
    target_question_id: gembaQuestionId,
    target_is_not_applicable: false,
    target_text_value: "Floor is clear",
  });
  await rpc(owner, "complete_gemba_walk", {
    target_walk_id: walkId,
    target_summary_notes: "Completed walk",
  });

  const programmeId = await rpc<string>(
    owner,
    "create_suggestion_programme_draft",
    {
      target_name: "Bakery ideas",
      target_code: `ideas-${stamp}`.slice(0, 40),
    },
  );
  const programmeVersionId = await singleId(
    owner,
    "suggestion_programme_versions",
    { column: "programme_id", value: programmeId },
  );
  await rpc(owner, "publish_suggestion_programme_version", {
    target_programme_version_id: programmeVersionId,
  });
  const categoryId = await rpc<string>(owner, "create_suggestion_category", {
    target_name: "Safety",
    target_code: `safety-${stamp}`.slice(0, 40),
  });
  const jobFunctionId = await rpc<string>(owner, "create_job_function", {
    target_name: "Operator",
    target_code: `operator-${stamp}`.slice(0, 40),
  });
  const organisations = await rpc<
    Array<{ organisation_id: string; membership_id: string }>
  >(owner, "list_my_eligible_organisations");
  const ownerMembershipId = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  )?.membership_id;
  if (!ownerMembershipId) throw new Error("Owner membership was not found");
  await rpc(owner, "assign_membership_job_function", {
    target_membership_id: ownerMembershipId,
    target_job_function_id: jobFunctionId,
    target_primary: true,
    target_organisational_unit_id: auditArea,
  });
  const sharedSuggestionId = await rpc<string>(
    owner,
    "create_suggestion_draft",
    {
      target_programme_version_id: programmeVersionId,
      target_category_id: categoryId,
      target_title: sharedSuggestionTitle,
      target_problem_or_opportunity: "Flour dust on the walkway",
      target_proposed_idea: "Sweep at the end of each batch",
      target_expected_benefit_summary: "Clearer floor",
      target_target_unit_id: auditArea,
    },
  );
  await rpc(owner, "submit_suggestion", {
    target_suggestion_id: sharedSuggestionId,
  });

  const offers = await rpc<{
    offers: Array<{ role_canonical_name: string; role_version_id: string }>;
  }>(owner, "get_delegatable_access_offers");
  const roleId = (name: string) => {
    const offer = offers.offers.find(
      (candidate) => candidate.role_canonical_name === name,
    );
    if (!offer) throw new Error(`${name} was not delegatable`);
    return offer.role_version_id;
  };

  const viewer = memberCredentials(`workplace-viewer-${stamp}`);
  viewer.userId = await createAuthUser(admin, viewer.email, viewer.password);
  const viewerClient = await inviteMember({
    owner,
    url,
    publishableKey,
    email: viewer.email,
    password: viewer.password,
    displayName: "Bodmin Viewer",
    userId: viewer.userId,
    jobFunctionId,
    unitId: auditArea,
    grants: [
      {
        role_version_id: roleId("workplace-viewer"),
        scope_type: "unit_subtree",
        scope_unit_id: siteA,
      },
      {
        role_version_id: roleId("suggestions-contributor"),
        scope_type: "unit_subtree",
        scope_unit_id: siteA,
      },
    ],
  });
  await rpc(viewerClient, "switch_organisation", {
    target_organisation_id: organisationId,
  });
  const viewerFeed = await rpc<{ records: Array<{ title: string }> }>(
    viewerClient,
    "get_workplace_feed",
    { target_module: "five_s", target_page: 1 },
  );
  const titles = viewerFeed.records.map((record) => record.title);
  if (!titles.includes(publishedStandardName)) {
    throw new Error(
      `Workplace feed missed the published standard: ${titles.join(", ")}`,
    );
  }
  if (
    titles.includes(draftStandardName) ||
    titles.includes(hiddenProgressArea)
  ) {
    throw new Error(
      `Workplace feed exposed a private record: ${titles.join(", ")}`,
    );
  }
  if (titles.includes(closedAuditArea)) {
    throw new Error("Workplace feed exposed another site");
  }

  const reader = memberCredentials(`workplace-reader-${stamp}`);
  reader.userId = await createAuthUser(admin, reader.email, reader.password);
  await inviteMember({
    owner,
    url,
    publishableKey,
    email: reader.email,
    password: reader.password,
    displayName: "Site Reader",
    userId: reader.userId,
    jobFunctionId,
    unitId: auditArea,
    grants: [
      {
        role_version_id: roleId("team-member"),
        scope_type: "unit_subtree",
        scope_unit_id: siteA,
      },
      {
        role_version_id: roleId("workplace-viewer"),
        scope_type: "unit_subtree",
        scope_unit_id: siteB,
      },
    ],
  });

  const contributor = memberCredentials(`workplace-contributor-${stamp}`);
  contributor.userId = await createAuthUser(
    admin,
    contributor.email,
    contributor.password,
  );
  await inviteMember({
    owner,
    url,
    publishableKey,
    email: contributor.email,
    password: contributor.password,
    displayName: "Suggestion Contributor",
    userId: contributor.userId,
    jobFunctionId,
    unitId: auditArea,
    grants: [
      {
        role_version_id: roleId("suggestions-contributor"),
        scope_type: "unit_subtree",
        scope_unit_id: siteA,
      },
    ],
  });

  return {
    organisationName,
    viewer,
    reader,
    contributor,
    draftStandardId,
    inProgressAuditId,
  };
}

function memberCredentials(prefix: string): MemberCredentials {
  return {
    email: `${prefix}@example.test`,
    password: "WorkplaceMemberPassword123!",
    userId: "",
  };
}

async function singleId(
  client: SupabaseClient,
  table: string,
  filter: { column: string; value: string },
) {
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq(filter.column, filter.value)
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) {
    throw error ?? new Error(`${table} row was not found`);
  }
  return data.id as string;
}

async function signInMember(
  page: Page,
  member: MemberCredentials,
  organisationName: string,
) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    /\/(platform|select-organisation|update-password|no-access)/,
    { timeout: 30_000 },
  );
  if (page.url().includes("/select-organisation")) {
    await page.getByRole("button", { name: organisationName }).click();
    await page.waitForURL(/\/platform/, { timeout: 30_000 });
  }
  await expect(page).toHaveURL(/\/platform/);
  await expect(page).not.toHaveURL(/\/update-password/);
}

let fixture: WorkplaceRoutingFixture;

test.describe("Workplace Viewer permission routing", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.skip(
    !hasSupabaseE2e,
    "Requires E2E_WITH_SUPABASE=1 and a running local Supabase stack",
  );

  test.beforeAll(async () => {
    fixture = await provisionWorkplaceRoutingFixture();
  });

  test("Workplace Viewer sees published 5S and Gemba without drafts or another site", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInMember(page, fixture.viewer, fixture.organisationName);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByTestId("platform-nav-five-s").last()).toBeVisible();
    await expect(page.getByTestId("platform-nav-gemba").last()).toBeVisible();
    await expect(
      page.getByTestId("platform-nav-suggestions").last(),
    ).toBeVisible();
    await page.getByTestId("platform-nav-five-s").last().click();

    await expect(page.getByTestId("workplace-read-only-module")).toBeVisible();
    await expect(
      page.getByRole("link", { name: publishedStandardName }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: publishedAuditArea }),
    ).toBeVisible();
    await expect(page.getByText("Score 100.00%")).toBeVisible();
    await expect(page.getByText("No 5S standards yet")).toHaveCount(0);
    await expect(page.getByText(draftStandardName)).toHaveCount(0);
    await expect(page.getByText(hiddenProgressArea)).toHaveCount(0);
    await expect(page.getByText(closedAuditArea)).toHaveCount(0);
    await expect(page.getByTestId("five-s-new-standard")).toHaveCount(0);

    await page.getByRole("link", { name: publishedStandardName }).click();
    await expect(page.getByTestId("workplace-read-only-record")).toBeVisible();
    await expect(page.getByText(publishedStandardName).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

    await page.goto(`/platform/5s/standards/${fixture.draftStandardId}`);
    await expect(
      page.getByTestId("workplace-record-unavailable"),
    ).toBeVisible();
    await page.goto(`/platform/workplace/five_s/${fixture.inProgressAuditId}`);
    await expect(
      page.getByTestId("workplace-record-unavailable"),
    ).toBeVisible();

    await page.goto("/platform/gemba");
    await expect(page.getByTestId("workplace-read-only-module")).toBeVisible();
    await expect(
      page.getByRole("link", { name: publishedGembaName }).first(),
    ).toBeVisible();
    await expect(page.getByText("Completed walk")).toBeVisible();
    await expect(page.getByText(publishedAuditArea).first()).toBeVisible();
    await expect(page.getByText("No Gemba definitions yet")).toHaveCount(0);
    await expect(page.getByTestId("gemba-new-definition")).toHaveCount(0);
  });

  test("Suggestions Contributor with Workplace Viewer submits and sees shared ideas", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInMember(page, fixture.viewer, fixture.organisationName);
    await page.goto("/platform/suggestions");
    await expect(
      page.getByTestId("suggestion-contributor-access"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Shared suggestions" }),
    ).toBeVisible();
    await expect(page.getByText(sharedSuggestionTitle)).toBeVisible();
    await expect(page.getByTestId("suggestions-open-queue-link")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("suggestions-programmes-link")).toHaveCount(
      0,
    );

    await page.getByTestId("suggestions-new-link").click();
    await expect(page.getByTestId("new-suggestion-form")).toBeVisible();
    await page.getByLabel("Short title (optional)").fill(ownSuggestionTitle);
    await page.getByLabel("What have you noticed?").fill("Stops are unmarked");
    await page
      .getByLabel("What would you change?")
      .fill("Mark the stop position");
    await page.getByTestId("suggestion-submit-button").click();
    await expect(page).toHaveURL(/\/platform\/suggestions\/[0-9a-f-]+/);
    await expect(page.getByText(ownSuggestionTitle)).toBeVisible();
    await page.reload();
    await expect(page.getByText(ownSuggestionTitle)).toBeVisible();

    await page.goto("/platform/suggestions");
    await expect(page.getByTestId("own-suggestions")).toContainText(
      ownSuggestionTitle,
    );
    await page
      .getByTestId("own-suggestions")
      .getByRole("link", { name: ownSuggestionTitle })
      .click();
    await expect(page.getByText(ownSuggestionTitle)).toBeVisible();
  });

  test("explicit site read keeps the module and Workplace Viewer adds the other site", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInMember(page, fixture.reader, fixture.organisationName);
    await page.goto("/platform/5s");
    await expect(page.getByTestId("five-s-overview-page")).toBeVisible();
    await expect(page.getByTestId("workplace-read-only-module")).toHaveCount(0);
    await expect(
      page.getByTestId("five-s-standard-list").getByRole("link", {
        name: publishedStandardName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("No 5S standards yet")).toHaveCount(0);
    await expect(page.getByTestId("workplace-shared-records")).toBeVisible();
    await expect(
      page.getByRole("link", { name: siblingAuditArea }),
    ).toBeVisible();
    await expect(page.getByText(closedAuditArea)).toHaveCount(0);
  });

  test("Suggestions Contributor without Workplace Viewer does not see the portfolio or a false 5S empty state", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInMember(page, fixture.contributor, fixture.organisationName);
    await expect(page.getByTestId("platform-nav-five-s")).toHaveCount(0);
    await page.goto("/platform/suggestions");
    await expect(
      page.getByTestId("suggestion-contributor-access"),
    ).toBeVisible();
    await expect(page.getByTestId("suggestions-new-link")).toBeVisible();
    await expect(page.getByTestId("own-suggestions")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Shared suggestions" }),
    ).toHaveCount(0);
    await expect(page.getByText(sharedSuggestionTitle)).toHaveCount(0);
    await expect(page.getByTestId("suggestions-open-queue-link")).toHaveCount(
      0,
    );
    await page.goto("/platform/5s");
    await expect(page.getByTestId("module-access-limited")).toBeVisible();
    await expect(page.getByText("No 5S standards yet")).toHaveCount(0);
    await expect(page.getByText(publishedStandardName)).toHaveCount(0);
    await expect(page.getByText(draftStandardName)).toHaveCount(0);
  });
});
