import { describe, expect, it } from "vitest";

import { parseFiveSBuilderEnvelope } from "@/modules/5s/ai-builder/proposal";
import {
  LEH_WORKPLACE_5S_STANDARD,
  buildFiveSQuickStartDefinition,
  fiveSTemplateCounts,
  validateFiveSQuickStartTemplate,
} from "@/modules/5s/templates";
import { parseGembaBuilderEnvelope } from "@/modules/gemba/ai-builder/proposal";
import {
  LEH_OPERATIONAL_GEMBA_WALK,
  buildGembaQuickStartDefinition,
  gembaTemplateCounts,
  validateGembaQuickStartTemplate,
} from "@/modules/gemba/templates";
import { assistantPageDefinitionFor } from "@/modules/leanai-context/assistant/product-pages";
import { parseAssistantRoute } from "@/modules/leanai-context/assistant/route-map";
import {
  configurationNameWarning,
  findExactConfigurationNameMatch,
} from "@/modules/module-setup/name-match";
import { moduleSetupReadiness } from "@/modules/module-setup/readiness";

describe("module setup templates", () => {
  it("keeps the 5S starting point compact and valid", () => {
    expect(validateFiveSQuickStartTemplate(LEH_WORKPLACE_5S_STANDARD)).toEqual(
      [],
    );
    const counts = fiveSTemplateCounts(LEH_WORKPLACE_5S_STANDARD);
    expect(counts.categories).toBe(5);
    expect(counts.questions).toBeGreaterThanOrEqual(15);
    expect(counts.questions).toBeLessThanOrEqual(25);
    const definition = buildFiveSQuickStartDefinition(
      LEH_WORKPLACE_5S_STANDARD,
      80,
    );
    expect(definition.key).toBe("leh-workplace-5s-standard");
    expect(definition.thresholdPercent).toBe(80);
    expect(definition.categories[0]?.name).toBe("Sort");
  });

  it("keeps the Gemba starting point observational and valid", () => {
    expect(validateGembaQuickStartTemplate(LEH_OPERATIONAL_GEMBA_WALK)).toEqual(
      [],
    );
    const counts = gembaTemplateCounts(LEH_OPERATIONAL_GEMBA_WALK);
    expect(counts.sections).toBe(6);
    expect(counts.prompts).toBe(12);
    const definition = buildGembaQuickStartDefinition(
      LEH_OPERATIONAL_GEMBA_WALK,
    );
    expect(definition.key).toBe("leh-operational-gemba-walk");
    expect(definition.expectedDurationMinutes).toBe(45);
    expect(definition.sections.map((section) => section.name)).toEqual([
      "Safety",
      "People",
      "Quality",
      "Flow / Delivery",
      "Standards",
      "Improvement",
    ]);
  });
});

describe("module setup assistant routes", () => {
  it("keeps authoring routes generic and gives setup its own facts", () => {
    expect(parseAssistantRoute("/platform/5s/standards").workflow).toBe(
      "five_s",
    );
    expect(parseAssistantRoute("/platform/gemba/definitions").workflow).toBe(
      "gemba",
    );
    const fiveS = assistantPageDefinitionFor(
      parseAssistantRoute("/platform/5s/setup/leanai"),
    );
    expect(fiveS.workflow).toBe("five_s_builder");
    expect(fiveS.facts.join(" ")).toMatch(/must not publish/i);
    expect(fiveS.facts.join(" ")).toMatch(/applicability/i);
    const gemba = assistantPageDefinitionFor(
      parseAssistantRoute("/platform/gemba/setup/quick-start"),
    );
    expect(gemba.workflow).toBe("gemba_quick_start");
    expect(gemba.facts.join(" ")).toMatch(/draft/i);
  });
});

describe("module setup name matching", () => {
  it("warns only on a deterministic name match", () => {
    expect(
      findExactConfigurationNameMatch("Packing  5S Standard", [
        "Warehouse 5S",
        "packing 5s standard",
      ]),
    ).toBe("packing 5s standard");
    expect(
      findExactConfigurationNameMatch("Packing area standard", [
        "Packing 5S Standard",
      ]),
    ).toBeNull();
    expect(
      configurationNameWarning({
        noun: "5S standard",
        existingName: "Packing 5S Standard",
      }),
    ).toContain("Packing 5S Standard");
  });

  it("treats the first configuration differently from a later one", () => {
    expect(moduleSetupReadiness(0).entry).toBe("first");
    expect(moduleSetupReadiness(2).entry).toBe("additional");
  });
});

describe("module setup proposal validation", () => {
  it("accepts a bounded 5S proposal and rejects an empty category", () => {
    const valid = parseFiveSBuilderEnvelope({
      message: "Review this draft.",
      phase: "proposal",
      understanding: {
        environment: "Packing",
        purpose: "See the workplace.",
        audit_style: null,
        depth: null,
        evidence: null,
        scoring: null,
        terminology: null,
      },
      questions: [],
      change_summary: [],
      proposal: {
        name: "Packing 5S Standard",
        description: "A short standard for the packing area.",
        threshold_percent: 80,
        categories: [
          {
            name: "Sort",
            description: "Keep what is needed.",
            questions: [
              {
                prompt: "Are unused items removed?",
                question_type: "yes_no",
                guidance: null,
              },
            ],
          },
        ],
      },
    });
    expect(valid.ok).toBe(true);
    if (valid.ok && valid.envelope.proposal) {
      expect(valid.envelope.proposalStatus).toBe("valid");
      expect(
        valid.envelope.proposal.categories[0]?.questions[0]?.questionType,
      ).toBe("yes_no");
    }

    const invalid = parseFiveSBuilderEnvelope({
      message: "This cannot be saved.",
      phase: "proposal",
      understanding: {
        environment: null,
        purpose: null,
        audit_style: null,
        depth: null,
        evidence: null,
        scoring: null,
        terminology: null,
      },
      questions: [],
      change_summary: [],
      proposal: {
        name: "Incomplete standard",
        description: "Missing questions.",
        threshold_percent: 80,
        categories: [{ name: "Sort", description: null, questions: [] }],
      },
    });
    expect(invalid.ok).toBe(true);
    if (invalid.ok) {
      expect(invalid.envelope.proposalStatus).toBe("invalid");
      expect(invalid.envelope.proposal).toBeNull();
    }
  });

  it("accepts a bounded Gemba proposal and rejects a compliance-sized empty section", () => {
    const valid = parseGembaBuilderEnvelope({
      message: "Review these prompts.",
      phase: "proposal",
      understanding: {
        purpose: "See the work.",
        environment: null,
        focus: null,
        audience: null,
        depth: null,
        terminology: null,
      },
      questions: [],
      change_summary: [],
      proposal: {
        name: "Operational Gemba Walk",
        description: "A short walk about what is visible today.",
        sections: [
          {
            name: "Flow",
            description: "Where work waits.",
            prompts: [
              {
                prompt: "Where is flow being interrupted?",
                guidance: null,
              },
            ],
          },
        ],
      },
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.envelope.proposalStatus).toBe("valid");
    }

    const broken = parseGembaBuilderEnvelope({
      message: "Unstructured",
      phase: "proposal",
    });
    expect(broken.ok).toBe(false);
  });
});
