// VERIFY draft for PR #392 (Spec B unit): static guards on the migration and
// the matrix pages that pgTAP cannot see (pre-check ordering, no silent
// deletes, no residual caps, pagination links).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function migration(): string {
  const dir = "supabase/migrations";
  const file = readdirSync(dir)
    .sort()
    .reverse()
    .find((name) => name.endsWith("_skills_training_unit_scoped_requirements.sql"));
  if (!file) throw new Error("Spec B migration not found");
  return readFileSync(join(dir, file), "utf8");
}

describe("Spec B migration guards", () => {
  const sql = migration();

  it("runs the duplicate pre-check before creating either unique index", () => {
    const precheck = sql.indexOf("duplicate scoped requirement keys exist");
    expect(precheck).toBeGreaterThan(-1);
    expect(precheck).toBeLessThan(
      sql.indexOf("skill_requirements_scope_unique_idx"),
    );
    expect(precheck).toBeLessThan(
      sql.indexOf("training_requirements_scope_unique_idx"),
    );
  });

  it("the pre-check fails with 23505 and never deletes rows", () => {
    expect(sql).toMatch(/duplicate scoped requirement keys exist[\s\S]{0,120}errcode = '23505'/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(skill|training)_requirements/i);
  });

  it("both indexes are NULLS NOT DISTINCT and tenant-leading", () => {
    for (const name of [
      "skill_requirements_scope_unique_idx",
      "training_requirements_scope_unique_idx",
    ]) {
      const start = sql.indexOf(`create unique index if not exists ${name}`);
      expect(start).toBeGreaterThan(-1);
      const body = sql.slice(start, sql.indexOf(";", start));
      expect(body).toMatch(/\(\s*organisation_id,/);
      expect(body).toMatch(/nulls not distinct/);
    }
  });

  it("training precheck groups by the same columns as the training index", () => {
    expect(sql).toMatch(
      /training_row\.organisation_id,\s*training_row\.curriculum_version_id,\s*training_row\.course_id,\s*training_row\.job_function_id,\s*training_row\.applies_to_all_members,\s*training_row\.organisational_unit_id\s*having count\(\*\) > 1/,
    );
  });

  it("guards Postgres 17 for NULLS NOT DISTINCT", () => {
    expect(sql).toContain("server_version_num");
    expect(sql).toContain("170000");
  });

  it("uses the published-curriculum helper for the training matrix and compliance", () => {
    const matches = sql.match(/private\.get_published_training_curriculum_version_id\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("clamps page size to the documented hard cap of 100", () => {
    const clamps = sql.match(/least\(greatest\(coalesce\(target_page_size, 50\), 1\), 100\)/g) ?? [];
    expect(clamps.length).toBe(2);
  });
});

describe("matrix pages", () => {
  for (const [label, path, prefix] of [
    ["skills", "src/app/(platform)/platform/skills/matrix/page.tsx", "/platform/skills/matrix?page="],
    ["training", "src/app/(platform)/platform/training/matrix/page.tsx", "/platform/training/matrix?page="],
  ] as const) {
    it(`${label} matrix page paginates people and has no column cap`, () => {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/\.limit\(\s*12\s*\)/);
      expect(source).not.toContain("get_people_directory");
      expect(source).toContain(prefix);
      expect(source).toMatch(/target_page_size:\s*50/);
      expect(source).toContain(`${label}-matrix-error`);
    });
  }

  it("training matrix component no longer references a global required set", () => {
    const source = readFileSync("src/components/training/training-matrix.tsx", "utf8");
    expect(source).not.toContain("requiredCourseIds");
  });
});
