// VERIFY draft for PR #392 (Spec B e2e): two-site CookieWorks tenant with
// >12 required skills and >50 people. Proves: no 12-column cap, people
// pagination (page size 50), site-scoped skill/training requirements with a
// Bodmin tighten override, wrong job function => Not Required, latest
// curriculum version only, and Bodmin manager cannot see Exeter.
//
// Does NOT use tests/e2e/helpers/skills-setup-records.ts (no skill
// validations are recorded), so it is independent of the
// record_skill_validation method fix tracked for #391.
import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { QA_USERS } from "../../scripts/qa-tenant/constants";
import { loginAsCookieWorksPersona } from "./helpers/cookieworks-auth";
import {
  createPublishableClient,
  queryDatabase,
} from "./helpers/workforce-provisioning";

const hasSupabaseE2e = process.env.E2E_WITH_SUPABASE === "1";
const run = Date.now().toString(36);
const SKILL_COUNT = 14;
const BODMIN_PEOPLE = 30;
const EXETER_PEOPLE = 25;
const skillName = (n: number) =>
  `Matrix skill ${String(n).padStart(2, "0")} ${run}`;
const bodminSkill = `Bodmin-only matrix skill ${run}`;
const exeterSkill = `Exeter-only matrix skill ${run}`;
const bodminPerson = (n: number) =>
  `Matrix Bodmin ${String(n).padStart(2, "0")} ${run}`;
const exeterPerson = (n: number) =>
  `Matrix Exeter ${String(n).padStart(2, "0")} ${run}`;
const course = {
  all: `Matrix induction ${run}`,
  bodmin: `Bodmin packing hygiene ${run}`,
  wrongJob: `Supervisor briefing ${run}`,
  old: `Superseded course ${run}`,
  latest: `Latest curriculum course ${run}`,
};

type Ids = {
  organisationId: string;
  units: Record<string, string>;
  operatorJf: string;
  supervisorJf: string;
  skills: Record<string, string>;
};
const ids = {} as Ids;

function resetCookieWorksFoundation() {
  execSync("npm run qa:cookie:reset", {
    cwd: join(fileURLToPath(new URL(".", import.meta.url)), "../.."),
    env: { ...process.env, LEANHUB_ALLOW_QA_TENANT: "1" },
    stdio: "pipe",
  });
}

async function signIn(persona: keyof typeof QA_USERS): Promise<SupabaseClient> {
  const client = createPublishableClient();
  const { error } = await client.auth.signInWithPassword({
    email: QA_USERS[persona].email,
    password: QA_USERS[persona].password,
  });
  if (error) throw error;
  const { error: switchError } = await client.rpc("switch_organisation", {
    target_organisation_id: ids.organisationId,
  });
  if (switchError) throw switchError;
  return client;
}

async function rpc<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.code} ${error.message}`);
  return data as T;
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Inserts active, enrolled members directly (local DB only). */
function seedMembers(names: string[]): string[] {
  const values = names.map((name) => `(gen_random_uuid(), ${sqlString(name)})`).join(",");
  const rows = queryDatabase<{ membership_id: string }>(`
    with people(user_id, display_name) as (values ${values}),
    users as (
      insert into auth.users (id, email, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
      select user_id, 'matrix-' || user_id || '@example.test', now(), now(), now(),
        '{}'::jsonb, '{}'::jsonb, false, false
      from people
      returning id
    )
    insert into public.organisation_memberships
      (organisation_id, user_id, display_name, status, activated_at)
    select ${sqlString(ids.organisationId)}::uuid, people.user_id, people.display_name, 'active', now()
    from people join users on users.id = people.user_id
    returning id as membership_id;
  `);
  queryDatabase(`
    update private.identity_controls
    set status = 'active', enrolment_status = 'complete', enrolment_completed_at = now()
    where user_id in (
      select user_id from public.organisation_memberships
      where id in (${rows.map((row) => sqlString(row.membership_id)).join(",")})
    )
    returning user_id;
  `);
  return rows.map((row) => row.membership_id);
}

async function seed() {
  const [org] = queryDatabase<{ id: string }>(`
    select organisation.id from public.organisations organisation
    join public.organisation_memberships membership on membership.organisation_id = organisation.id
    join auth.users users on users.id = membership.user_id
    where users.email = ${sqlString(QA_USERS.admin.email)} limit 1;
  `);
  ids.organisationId = org.id;
  const units = queryDatabase<{ id: string; code: string }>(`
    select id, code from public.organisation_units
    where organisation_id = ${sqlString(org.id)}::uuid;
  `);
  ids.units = Object.fromEntries(units.map((unit) => [unit.code, unit.id]));
  const bodminSite = ids.units["bodmin-cookie-factory"];
  const bodminPacking = ids.units["packing"];
  const exeterSite = ids.units["exeter-cookie-factory"];
  const exeterPacking = ids.units["exeter-packing"];
  expect([bodminSite, bodminPacking, exeterSite, exeterPacking]).not.toContain(undefined);

  const admin = await signIn("admin");
  ids.operatorJf = await rpc<string>(admin, "create_job_function", {
    target_name: `Matrix Operator ${run}`,
    target_code: `matrix-operator-${run}`,
  });
  ids.supervisorJf = await rpc<string>(admin, "create_job_function", {
    target_name: `Matrix Supervisor ${run}`,
    target_code: `matrix-supervisor-${run}`,
  });

  // Skills: scale 1..3, 14 org-wide + Bodmin-only + Exeter-only.
  const scaleId = await rpc<string>(admin, "create_skill_proficiency_scale_draft", {
    target_name: `Matrix scale ${run}`,
  });
  const [{ id: scale }] = queryDatabase<{ id: string }>(`
    select id from public.skill_proficiency_scale_versions
    where scale_id = ${sqlString(scaleId)}::uuid and version_number = 1;
  `);
  const levels: string[] = [];
  for (const [order, label] of [[1, "Aware"], [2, "Capable"], [3, "Expert"]] as const) {
    levels.push(
      await rpc<string>(admin, "add_skill_proficiency_level", {
        target_scale_version_id: scale,
        target_order_value: order,
        target_label: label,
      }),
    );
  }
  await rpc(admin, "publish_skill_proficiency_scale_version", {
    target_scale_version_id: scale,
  });
  ids.skills = {};
  const names = [
    ...Array.from({ length: SKILL_COUNT }, (_, i) => skillName(i + 1)),
    bodminSkill,
    exeterSkill,
  ];
  for (const [index, name] of names.entries()) {
    ids.skills[name] = await rpc<string>(admin, "create_skill", {
      target_name: name,
      target_code: `matrix-skill-${index + 1}-${run}`,
    });
  }
  const setId = await rpc<string>(admin, "create_skill_capability_set_draft", {
    target_name: `Matrix capability set ${run}`,
    target_code: `matrix-set-${run}`,
  });
  const [{ id: set }] = queryDatabase<{ id: string }>(`
    select id from public.skill_capability_set_versions
    where capability_set_id = ${sqlString(setId)}::uuid and version_number = 1;
  `);
  const addSkill = (name: string, level: number, unit?: string) =>
    rpc(admin, "add_skill_requirement", {
      target_capability_set_version_id: set,
      target_skill_id: ids.skills[name],
      target_job_function_id: ids.operatorJf,
      target_proficiency_scale_version_id: scale,
      target_target_proficiency_level_id: levels[level - 1],
      ...(unit ? { target_organisational_unit_id: unit } : {}),
    });
  for (let n = 1; n <= SKILL_COUNT; n += 1) await addSkill(skillName(n), 2);
  await addSkill(skillName(1), 3, bodminSite); // tighten at Bodmin
  await addSkill(bodminSkill, 1, bodminSite);
  await addSkill(exeterSkill, 1, exeterSite);
  await rpc(admin, "publish_skill_capability_set_version", {
    target_capability_set_version_id: set,
  });

  // Training: v1 includes the old course; v2 (latest) drops it, adds latest.
  const courses: Record<string, string> = {};
  for (const [key, name] of Object.entries(course)) {
    // create_training_course_draft returns the course id. ASSUMPTION (as in
    // the pgTAP draft): an unpublished draft course can be required by a
    // curriculum; publish its version here if add_training_requirement rejects.
    courses[key] = await rpc<string>(admin, "create_training_course_draft", {
      target_name: name,
      target_code: `matrix-${key}-${run}`,
    });
  }
  const curriculumId = await rpc<string>(admin, "create_training_curriculum_draft", {
    target_name: `Matrix curriculum ${run}`,
    target_code: `matrix-curriculum-${run}`,
  });
  const [{ id: curriculum }] = queryDatabase<{ id: string }>(`
    select id from public.training_curriculum_versions
    where curriculum_id = ${sqlString(curriculumId)}::uuid and version_number = 1;
  `);
  const addTraining = (
    version: string,
    key: keyof typeof course,
    options: { jf?: string; unit?: string; all?: boolean },
  ) =>
    rpc(admin, "add_training_requirement", {
      target_curriculum_version_id: version,
      target_course_id: courses[key],
      target_job_function_id: options.jf ?? null,
      target_organisational_unit_id: options.unit ?? null,
      target_applies_to_all_members: options.all ?? false,
      target_mandatory: true,
    });
  await addTraining(curriculum, "all", { all: true });
  await addTraining(curriculum, "bodmin", { jf: ids.operatorJf, unit: bodminSite });
  await addTraining(curriculum, "wrongJob", { jf: ids.supervisorJf });
  await addTraining(curriculum, "old", { all: true });
  await rpc(admin, "publish_training_curriculum_version", {
    target_curriculum_version_id: curriculum,
  });
  const successor = await rpc<string>(admin, "create_training_curriculum_successor_version", {
    target_curriculum_id: curriculumId,
  });
  const [{ id: oldRow }] = queryDatabase<{ id: string }>(`
    select id from public.training_requirements
    where curriculum_version_id = ${sqlString(successor)}::uuid and course_id = ${sqlString(courses.old)}::uuid;
  `);
  await rpc(admin, "remove_training_requirement", { target_requirement_id: oldRow });
  await addTraining(successor, "latest", { all: true });
  await rpc(admin, "publish_training_curriculum_version", {
    target_curriculum_version_id: successor,
  });

  // People: 30 Bodmin operators, 25 Exeter operators (=> >50 in org).
  // RISK: seat / site-capacity enforcement may reject 55 extra members.
  const bodmin = seedMembers(Array.from({ length: BODMIN_PEOPLE }, (_, i) => bodminPerson(i + 1)));
  const exeter = seedMembers(Array.from({ length: EXETER_PEOPLE }, (_, i) => exeterPerson(i + 1)));
  for (const [list, unit] of [[bodmin, bodminPacking], [exeter, exeterPacking]] as const) {
    for (const membershipId of list) {
      await rpc(admin, "assign_membership_job_function", {
        target_membership_id: membershipId,
        target_job_function_id: ids.operatorJf,
        target_primary: true,
        target_organisational_unit_id: unit,
      });
    }
  }
  await admin.auth.signOut();
}

async function namesOnPage(page: Page, prefix: string): Promise<string[]> {
  const texts = await page.getByText(new RegExp(`^${prefix}`)).allTextContents();
  return [...new Set(texts.map((text) => text.trim()))];
}

test.describe("Spec B: two-site skills/training matrix", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);
  test.skip(!hasSupabaseE2e, "Requires E2E_WITH_SUPABASE=1 and CookieWorks QA tenant");

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    resetCookieWorksFoundation();
    await seed();
  });

  test("admin skills matrix: >12 skill columns and people pagination", async ({ page }) => {
    const admin = await signIn("admin");
    const first = await rpc<{ total_people: number; skills: unknown[] }>(
      admin,
      "get_skills_matrix",
      { target_page: 1, target_page_size: 50 },
    );
    expect(first.total_people).toBeGreaterThan(50);

    await loginAsCookieWorksPersona(page, "admin");
    await page.goto("/platform/skills/matrix");
    await expect(page.getByTestId("skills-matrix-summary")).toContainText(
      `Showing 50 of ${first.total_people}`,
    );
    for (let n = 1; n <= SKILL_COUNT; n += 1) {
      await expect(page.getByRole("link", { name: skillName(n) }).first()).toBeVisible();
    }
    const pagination = page.getByTestId("skills-matrix-pagination");
    await expect(pagination).toContainText(
      `Page 1 of ${Math.ceil(first.total_people / 50)}`,
    );
    const pageOne = await namesOnPage(page, "Matrix (Bodmin|Exeter)");
    await pagination.getByRole("link", { name: /next/i }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(pagination).toContainText("Page 2 of");
    const pageTwo = await namesOnPage(page, "Matrix (Bodmin|Exeter)");
    expect(pageTwo.length).toBeGreaterThan(0);
    expect(pageOne.filter((name) => pageTwo.includes(name))).toEqual([]);
    await admin.auth.signOut();
  });

  test("site override: Bodmin person targets level 3, Exeter person level 2", async () => {
    const admin = await signIn("admin");
    const target = ids.skills[skillName(1)];
    const seen: Record<string, number> = {};
    for (let p = 1; p <= 3; p += 1) {
      const data = await rpc<{
        people: { membership_id: string; display_name: string }[];
        gaps: {
          membership_id: string;
          skill_id: string;
          gap: { target_order: number; effective_below_org: boolean };
        }[];
      }>(admin, "get_skills_matrix", { target_page: p, target_page_size: 50 });
      for (const gap of data.gaps.filter((g) => g.skill_id === target)) {
        const person = data.people.find((x) => x.membership_id === gap.membership_id);
        if (person) seen[person.display_name] = gap.gap?.target_order;
      }
    }
    expect(seen[bodminPerson(1)]).toBe(3);
    expect(seen[exeterPerson(1)]).toBe(2);
    await admin.auth.signOut();
  });

  test("Bodmin production manager never sees Exeter people or Exeter-only skill", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "productionManager");
    await page.goto("/platform/skills/matrix");
    await expect(page.getByTestId("skills-matrix-summary")).toBeVisible();
    await expect(page.getByText(bodminPerson(1))).toBeVisible();
    await expect(page.getByText(/^Matrix Exeter/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: bodminSkill })).toBeVisible();
    await expect(page.getByRole("link", { name: exeterSkill })).toHaveCount(0);
    await expect(page.getByRole("link", { name: skillName(SKILL_COUNT) })).toBeVisible();

    const manager = await signIn("productionManager");
    const { error } = await manager.rpc("get_skills_matrix", {
      target_page: 1,
      target_page_size: 50,
      target_unit_id: ids.units["exeter-cookie-factory"],
    });
    expect(error?.code).toBe("42501");
    const { error: trainingError } = await manager.rpc("get_training_matrix", {
      target_page: 1,
      target_page_size: 50,
      target_unit_id: ids.units["exeter-cookie-factory"],
    });
    expect(trainingError?.code).toBe("42501");
    await manager.auth.signOut();
  });

  test("training matrix: latest curriculum, site scope, wrong job function", async ({ page }) => {
    await loginAsCookieWorksPersona(page, "productionManager");
    await page.goto("/platform/training/matrix");
    await expect(page.getByTestId("training-matrix-summary")).toBeVisible();
    await expect(page.getByText(course.latest).first()).toBeVisible();
    await expect(page.getByText(course.old)).toHaveCount(0);
    await expect(
      page.getByLabel(`${bodminPerson(1)} — ${course.bodmin}: Required`),
    ).toBeVisible();
    await expect(
      page.getByLabel(`${bodminPerson(1)} — ${course.all}: Required`),
    ).toBeVisible();
    // wrongJob applies to supervisors only; nobody on this page qualifies.
    await expect(page.getByText(course.wrongJob)).toHaveCount(0);
    await expect(page.getByText(/^Matrix Exeter/)).toHaveCount(0);

    // Admin: Exeter operator is Not Required for the Bodmin-scoped course.
    await loginAsCookieWorksPersona(page, "admin");
    let found = false;
    for (let p = 1; p <= 3 && !found; p += 1) {
      await page.goto(`/platform/training/matrix?page=${p}`);
      const cell = page.getByLabel(`${exeterPerson(1)} — ${course.bodmin}: Not Required`);
      found = (await cell.count()) > 0;
    }
    expect(found).toBe(true);
    await expect(page.getByTestId("training-matrix-pagination")).toBeVisible();
  });
});
