import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("Skills and training matrix scope (Spec B)", () => {
  it("skills matrix uses get_skills_matrix without legacy caps", () => {
    const source = readSource(
      "src/app/(platform)/platform/skills/matrix/page.tsx",
    );

    expect(source).toContain('rpc("get_skills_matrix"');
    expect(source).not.toContain(".limit(12)");
    expect(source).not.toContain("target_page_size: 100");
    expect(source).toContain("skills-matrix-summary");
    expect(source).toContain("skills-matrix-error");
    expect(source).toContain("Showing");
  });

  it("training matrix uses get_training_matrix without curriculum limit 1", () => {
    const source = readSource(
      "src/app/(platform)/platform/training/matrix/page.tsx",
    );

    expect(source).toContain('rpc("get_training_matrix"');
    expect(source).not.toContain(".limit(12)");
    expect(source).not.toContain("training_curriculum_versions");
    expect(source).not.toContain(".limit(1)");
    expect(source).toContain("training-matrix-summary");
    expect(source).toContain("training-matrix-error");
  });

  it("training matrix applies requirements per person", () => {
    const source = readSource("src/components/training/training-matrix.tsx");

    expect(source).toContain("membership_id");
    expect(source).toContain("mandatoryCells");
    expect(source).toContain("membershipId}:${courseId}");
  });
});
