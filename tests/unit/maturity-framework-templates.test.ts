import { describe, expect, it } from "vitest";

import {
  LEH_OE_STANDARD_EXPECTED_COUNTS,
  LEH_OPERATIONAL_EXCELLENCE_STANDARD,
  LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
  assertLehOperationalExcellenceCompleteness,
  buildMaturityQuickStartDefinition,
  cloneMaturityFrameworkTemplate,
  derivedCriterionPosition,
  derivedLevelNumber,
  derivedPillarPosition,
  derivedQuestionPositionInPillar,
  getMaturityFrameworkTemplate,
  listMaturityFrameworkTemplates,
  maturityTemplateCounts,
  requireCanonicalMaturityTemplate,
  validateMaturityFrameworkTemplate,
  type MaturityFrameworkTemplate,
} from "@/modules/maturity/templates";

function malformedTemplate(
  overrides: Partial<MaturityFrameworkTemplate>,
): MaturityFrameworkTemplate {
  return {
    ...LEH_OPERATIONAL_EXCELLENCE_STANDARD,
    ...overrides,
  };
}

describe("LEH Operational Excellence Quick Start template", () => {
  const template = requireCanonicalMaturityTemplate(
    LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
  );
  const counts = maturityTemplateCounts(template);

  it("is listed in the built-in catalogue with a stable key", () => {
    const catalogue = listMaturityFrameworkTemplates();
    expect(catalogue.map((entry) => entry.key)).toEqual([
      LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
    ]);
    expect(
      getMaturityFrameworkTemplate(LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY),
    ).toBe(LEH_OPERATIONAL_EXCELLENCE_STANDARD);
    expect(template.key).toBe("leh-operational-excellence-standard");
    expect(template.name).toBe("LEH Operational Excellence Standard");
    expect(template.assessmentScopes).toEqual(["site"]);
  });

  it("contains exactly five levels numbered 1..5 from array order", () => {
    expect(counts.levels).toBe(5);
    expect(
      template.levels.map((level, index) => derivedLevelNumber(index)),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(template.levels.map((level) => level.name)).toEqual([
      "Initial",
      "Developing",
      "Defined",
      "Embedded",
      "Excellence",
    ]);
    template.levels.forEach((level, index) => {
      expect(level.colorToken).toBe(`maturity-${index + 1}`);
      expect(level.description.trim().length).toBeGreaterThan(0);
      expect(level.guidance.trim().length).toBeGreaterThan(0);
    });
  });

  it("contains five pillars, 30 criteria and 60 scored questions", () => {
    expect(counts.pillars).toBe(LEH_OE_STANDARD_EXPECTED_COUNTS.pillars);
    expect(counts.criteria).toBe(LEH_OE_STANDARD_EXPECTED_COUNTS.criteria);
    expect(counts.scoredQuestions).toBe(
      LEH_OE_STANDARD_EXPECTED_COUNTS.scoredQuestions,
    );
    expect(template.pillars.map((pillar) => pillar.name)).toEqual([
      "Operations",
      "Health & Safety",
      "Quality & Technical",
      "Engineering & Asset Reliability",
      "People & Leadership",
    ]);
  });

  it("gives each criterion exactly two questions with names, descriptions and guidance", () => {
    template.pillars.forEach((pillar, pillarIndex) => {
      expect(derivedPillarPosition(pillarIndex)).toBe(pillarIndex + 1);
      expect(pillar.criteria).toHaveLength(6);
      pillar.criteria.forEach((criterion, criterionIndex) => {
        expect(derivedCriterionPosition(criterionIndex)).toBe(
          criterionIndex + 1,
        );
        expect(criterion.name.trim().length).toBeGreaterThan(0);
        expect(criterion.description.trim().length).toBeGreaterThan(0);
        expect(criterion.guidance.trim().length).toBeGreaterThan(0);
        expect(criterion.questions).toHaveLength(2);
        criterion.questions.forEach((question, questionIndex) => {
          expect(question.prompt.trim().length).toBeGreaterThan(0);
          expect(
            derivedQuestionPositionInPillar(criterionIndex, questionIndex, 2),
          ).toBe(criterionIndex * 2 + questionIndex + 1);
        });
      });
    });
  });

  it("derives question positions deterministically from array order within a pillar", () => {
    const operations = template.pillars[0];
    expect(operations).toBeDefined();
    const positions = operations!.criteria.flatMap(
      (criterion, criterionIndex) =>
        criterion.questions.map((_, questionIndex) =>
          derivedQuestionPositionInPillar(criterionIndex, questionIndex, 2),
        ),
    );
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("passes built-in completeness validation", () => {
    expect(validateMaturityFrameworkTemplate(template)).toEqual([]);
    expect(assertLehOperationalExcellenceCompleteness(template)).toEqual([]);
  });

  it("keeps the built-in template independent from a customer copy payload", () => {
    const originalName = template.name;
    const originalPrompt =
      template.pillars[0]?.criteria[0]?.questions[0]?.prompt;
    const copy = cloneMaturityFrameworkTemplate(template);
    const payload = buildMaturityQuickStartDefinition(copy);

    copy.name = "Customer edited copy";
    copy.pillars[0]!.criteria[0]!.name = "Edited criterion";
    copy.pillars[0]!.criteria[0]!.questions[0]!.prompt = "Edited prompt";
    payload.name = "Payload mutation";
    payload.pillars[0]!.criteria[0]!.questions[0]!.prompt = "Payload prompt";

    expect(LEH_OPERATIONAL_EXCELLENCE_STANDARD.name).toBe(originalName);
    expect(
      LEH_OPERATIONAL_EXCELLENCE_STANDARD.pillars[0]?.criteria[0]?.questions[0]
        ?.prompt,
    ).toBe(originalPrompt);
    expect(getMaturityFrameworkTemplate(template.key)?.name).toBe(originalName);
    expect(payload.key).toBe(LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY);
    expect(payload.assessmentScopes).toEqual(["site"]);
  });
});

describe("maturity framework template validation", () => {
  it("rejects empty keys, names, prompts and criteria without questions", () => {
    const issues = validateMaturityFrameworkTemplate(
      malformedTemplate({
        key: "  ",
        name: "",
        description: "",
        assessmentScopes: [],
        levels: [
          {
            name: "",
            colorToken: "",
            description: "",
            guidance: "",
          },
        ],
        pillars: [
          {
            name: "",
            criteria: [
              {
                name: "",
                description: "",
                guidance: "",
                questions: [{ prompt: "   " }],
              },
              {
                name: "Orphan",
                description: "Has no questions.",
                guidance: "Should fail.",
                questions: [],
              },
            ],
          },
        ],
      }),
    );

    expect(
      issues.map((entry) => `${entry.path}:${entry.message}`).join("\n"),
    ).toMatch(/key/i);
    expect(issues.some((entry) => entry.path === "name")).toBe(true);
    expect(issues.some((entry) => entry.path === "assessmentScopes")).toBe(
      true,
    );
    expect(issues.some((entry) => entry.path === "levels[0].name")).toBe(true);
    expect(issues.some((entry) => entry.path === "pillars[0].name")).toBe(true);
    expect(
      issues.some((entry) => entry.path === "pillars[0].criteria[1].questions"),
    ).toBe(true);
    expect(
      issues.some(
        (entry) =>
          entry.path.endsWith("questions[0].prompt") &&
          /prompt/i.test(entry.message),
      ),
    ).toBe(true);
  });

  it("rejects duplicate level numbers, duplicate pillar names and invalid scopes", () => {
    const issues = validateMaturityFrameworkTemplate(
      malformedTemplate({
        assessmentScopes: ["site", "site", "organisation" as never],
        levels: [
          {
            name: "Initial",
            colorToken: "maturity-1",
            description: "One",
            guidance: "One",
          },
          {
            name: "Initial",
            colorToken: "maturity-1",
            description: "Two",
            guidance: "Two",
          },
        ],
        pillars: [
          {
            name: "Operations",
            criteria: LEH_OPERATIONAL_EXCELLENCE_STANDARD.pillars[0]!.criteria,
          },
          {
            name: "Operations",
            criteria: LEH_OPERATIONAL_EXCELLENCE_STANDARD.pillars[1]!.criteria,
          },
        ],
      }),
    );

    expect(issues.some((entry) => entry.path === "assessmentScopes")).toBe(
      true,
    );
    expect(issues.some((entry) => entry.path === "levels")).toBe(true);
    expect(issues.some((entry) => entry.path === "pillars")).toBe(true);
    expect(
      issues.some(
        (entry) =>
          entry.path === "levels[1].colorToken" &&
          entry.message.includes("maturity-2"),
      ),
    ).toBe(true);
  });

  it("rejects malformed level ordering when colour tokens skip array position", () => {
    const issues = validateMaturityFrameworkTemplate(
      malformedTemplate({
        levels: [
          {
            name: "Excellence",
            colorToken: "maturity-5",
            description: "Wrong order",
            guidance: "Wrong order",
          },
          ...LEH_OPERATIONAL_EXCELLENCE_STANDARD.levels.slice(1),
        ],
      }),
    );

    expect(
      issues.some(
        (entry) =>
          entry.path === "levels[0].colorToken" &&
          entry.message.includes("maturity-1"),
      ),
    ).toBe(true);
  });

  it("fails completeness checks when the Operational Excellence template is truncated", () => {
    const truncated = cloneMaturityFrameworkTemplate(
      LEH_OPERATIONAL_EXCELLENCE_STANDARD,
    );
    truncated.pillars = truncated.pillars.slice(0, 1);
    const issues = assertLehOperationalExcellenceCompleteness(truncated);
    expect(issues.some((entry) => entry.path === "pillars")).toBe(true);
    expect(issues.some((entry) => entry.path === "criteria")).toBe(true);
    expect(issues.some((entry) => entry.path === "questions")).toBe(true);
  });
});
