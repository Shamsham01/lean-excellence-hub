import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  generateSkillCatalogCode,
  resolveSkillCatalogCreateCode,
} from "@/modules/skills/catalog-code";
import { toSkillsAuthoringError } from "@/modules/skills/errors";
import {
  nextSkillsSetupHref,
  skillsFrameworkIsUnconfigured,
  skillsSetupStepNeeds,
} from "@/modules/skills/setup-path";
import {
  createProficiencyScaleSchema,
  proficiencyScalePublishIssues,
} from "@/modules/skills/validation";

describe("skill catalogue codes", () => {
  it("suggests stable codes from skill names", () => {
    expect(generateSkillCatalogCode("Forklift Operation")).toBe(
      "forklift-operation",
    );
    expect(generateSkillCatalogCode("Changeover")).toBe("changeover");
    expect(generateSkillCatalogCode("Food Safety Level 2")).toBe(
      "food-safety-level-2",
    );
  });

  it("rejects an invalid custom code before the RPC", () => {
    const result = resolveSkillCatalogCreateCode({
      name: "Machine Setup",
      noun: "skill",
      existingCodes: [],
      customCode: "Machine Setup",
    });

    expect(result.ok).toBe(false);
  });

  it("keeps a taken code from being reused", () => {
    const result = resolveSkillCatalogCreateCode({
      name: "Machine Setup",
      noun: "skill",
      existingCodes: ["machine-setup"],
    });

    expect(result).toEqual({ ok: true, code: "machine-setup-2" });
  });
});

describe("skills setup path", () => {
  const empty = {
    publishedScaleCount: 0,
    draftScaleId: null,
    activeSkillCount: 0,
    publishedStandardCount: 0,
    draftStandardId: null,
  };

  it("starts an empty organisation at proficiency scale setup", () => {
    expect(skillsFrameworkIsUnconfigured(empty)).toBe(true);
    expect(nextSkillsSetupHref(empty)).toBe("/platform/skills/scales/new");
    expect(skillsSetupStepNeeds(nextSkillsSetupHref(empty))).toBe("catalog");
  });

  it("continues a draft scale before creating skills", () => {
    const href = nextSkillsSetupHref({
      ...empty,
      draftScaleId: "scale-1",
    });

    expect(href).toBe("/platform/skills/scales/scale-1");
  });

  it("moves to the catalogue after a scale is published", () => {
    expect(
      nextSkillsSetupHref({
        ...empty,
        publishedScaleCount: 1,
      }),
    ).toBe("/platform/skills/catalog?new=1");
  });

  it("moves to requirements after skills exist", () => {
    expect(
      nextSkillsSetupHref({
        ...empty,
        publishedScaleCount: 1,
        activeSkillCount: 2,
      }),
    ).toBe("/platform/skills/standards/new");
    expect(skillsSetupStepNeeds("/platform/skills/standards/new")).toBe(
      "requirements",
    );
  });

  it("opens the matrix once a standard is published", () => {
    expect(
      nextSkillsSetupHref({
        publishedScaleCount: 1,
        draftScaleId: null,
        activeSkillCount: 2,
        publishedStandardCount: 1,
        draftStandardId: null,
      }),
    ).toBe("/platform/skills/matrix");
  });
});

describe("proficiency scale readiness", () => {
  it("requires two uniquely ordered labelled levels", () => {
    expect(
      proficiencyScalePublishIssues({
        name: "Operational proficiency",
        levels: [{ order: 1, label: "Awareness" }],
      }),
    ).toContain("Add at least two proficiency levels before publishing.");

    expect(
      proficiencyScalePublishIssues({
        name: "Operational proficiency",
        levels: [
          { order: 1, label: "Awareness" },
          { order: 1, label: "Competent" },
        ],
      }),
    ).toContain("Each level needs a unique order.");

    expect(
      proficiencyScalePublishIssues({
        name: "Operational proficiency",
        levels: [
          { order: 1, label: "Awareness" },
          { order: 2, label: "   " },
        ],
      }),
    ).toContain("Every level needs a label.");

    expect(
      proficiencyScalePublishIssues({
        name: "Operational proficiency",
        levels: [
          { order: 1, label: "Awareness" },
          { order: 2, label: "Competent" },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects a draft whose levels share an order", () => {
    const parsed = createProficiencyScaleSchema.safeParse({
      name: "Operational proficiency",
      levels: [
        { order: 1, label: "Awareness" },
        { order: 1, label: "Competent" },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("skills authoring errors", () => {
  it("hides raw database errors", () => {
    expect(
      toSkillsAuthoringError(
        {
          code: "42501",
          message: "skill creation is not authorised",
        },
        "fallback",
      ),
    ).toBe("You are not authorised to manage the skills catalogue.");

    expect(
      toSkillsAuthoringError(
        {
          code: "42501",
          message: "skill requirement creation is not authorised",
        },
        "fallback",
      ),
    ).toBe("You are not authorised to manage capability requirements.");

    expect(
      toSkillsAuthoringError(
        {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "skills_organisation_id_code_key"',
        },
        "fallback",
      ),
    ).toBe("That code is already in use. Choose a different code.");

    expect(
      toSkillsAuthoringError(
        {
          code: "P0002",
          message: "draft scale version not found",
        },
        "fallback",
      ),
    ).toBe("That draft is no longer available. Reload and try again.");

    expect(
      toSkillsAuthoringError(
        {
          code: "22023",
          message:
            "target proficiency level is incompatible with scale version",
        },
        "fallback",
      ),
    ).toBe(
      "The required level does not belong to the published proficiency scale.",
    );

    expect(
      toSkillsAuthoringError(
        {
          code: "22023",
          message: "proficiency scale needs at least two levels",
        },
        "fallback",
      ),
    ).toBe("Add at least two proficiency levels before publishing.");

    expect(
      toSkillsAuthoringError(
        {
          code: "22023",
          message: "skill is not active",
        },
        "fallback",
      ),
    ).toBe("Choose an active skill.");

    expect(
      toSkillsAuthoringError(
        {
          code: "P0002",
          message: "draft capability set version not found",
        },
        "fallback",
      ),
    ).toBe("That draft is no longer available. Reload and try again.");

    expect(
      toSkillsAuthoringError({ message: "relation skills" }, "fallback"),
    ).toBe("fallback");
  });
});

describe("skills authoring actions", () => {
  it("calls the existing domain RPCs and checks permissions in the action", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/skills/actions.ts",
      "utf8",
    );

    expect(source).toContain("SKILLS_PERMISSIONS.catalogManage");
    expect(source).toContain("SKILLS_PERMISSIONS.requirementsManage");
    expect(source).toContain("create_skill_proficiency_scale_draft");
    expect(source).toContain("add_skill_proficiency_level");
    expect(source).toContain("publish_skill_proficiency_scale_version");
    expect(source).toContain("create_skill");
    expect(source).toContain("create_skill_capability_set_draft");
    expect(source).toContain("add_skill_requirement");
    expect(source).toContain("publish_skill_capability_set_version");
    expect(source).not.toContain('.from("skills").insert');
    expect(source).not.toContain('.from("skill_proficiency_levels").insert');
    expect(source).not.toContain('.from("skill_requirements").insert');
  });
});
