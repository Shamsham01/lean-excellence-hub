import { describe, expect, it } from "vitest";

import {
  proposalPayloadSchemas,
  safeValidateProposalPayload,
  sanitizeEnvelopeProposals,
  validateProposalPayload,
} from "@/platform/ai/proposals/contracts";
import {
  createEmptyProposalsTransport,
  flattenValidatedProposalsFromTransport,
  normalizeProposalsTransport,
  proposalsTransportJsonSchema,
} from "@/platform/ai/proposals/proposal-transport";
import { assertStrictJsonSchemaCompatible } from "@/platform/ai/providers/openai-transport";
import type { AiProposalType } from "@/platform/ai/types";

const SESSION_ID = "00000000-0000-4000-8000-000000000099";
const HYPOTHESIS_ID = "00000000-0000-4000-8000-000000000001";

function transportWith(
  overrides: Partial<ReturnType<typeof createEmptyProposalsTransport>>,
) {
  return {
    ...createEmptyProposalsTransport(),
    ...overrides,
  };
}

describe("proposal transport strict schema", () => {
  it("is strict-compatible for all typed proposal buckets", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible(
        proposalsTransportJsonSchema,
        "proposals",
      ),
    ).not.toThrow();
  });

  it("requires every proposal bucket key", () => {
    expect(proposalsTransportJsonSchema.required).toEqual([
      "current_condition_items",
      "hypotheses",
      "hypothesis_tests",
      "containments",
      "countermeasures",
      "universal_actions",
      "effectiveness_checks",
      "sustainment_items",
      "session_questions",
      "session_summaries",
      "lessons_learned",
    ]);
  });
});

describe("proposal contracts for all 11 types", () => {
  const cases: Array<{
    type: AiProposalType;
    validTransportItem: Record<string, unknown>;
    validPayload: Record<string, unknown>;
    bucket: keyof ReturnType<typeof createEmptyProposalsTransport>;
  }> = [
    {
      type: "current_condition_item",
      bucket: "current_condition_items",
      validTransportItem: {
        category: "measured_fact",
        statement: "Hot-running defect rate exceeds baseline.",
        explanation: "Records the measured gap.",
      },
      validPayload: {
        category: "measured_fact",
        statement: "Hot-running defect rate exceeds baseline.",
      },
    },
    {
      type: "hypothesis",
      bucket: "hypotheses",
      validTransportItem: {
        statement: "Thermal expansion shifts seal alignment.",
        category: "technical",
        rationale: "Defect rate rises after sustained hot runs.",
        parent_hypothesis_id: null,
        explanation: "Testable technical hypothesis.",
      },
      validPayload: {
        statement: "Thermal expansion shifts seal alignment.",
        category: "technical",
        rationale: "Defect rate rises after sustained hot runs.",
      },
    },
    {
      type: "hypothesis_test",
      bucket: "hypothesis_tests",
      validTransportItem: {
        hypothesis_id: HYPOTHESIS_ID,
        test_question: "Does ppm increase under hot runs?",
        expected_result: "Higher ppm during hot runs.",
        method: null,
        explanation: "Controlled hot-running comparison.",
      },
      validPayload: {
        hypothesis_id: HYPOTHESIS_ID,
        test_question: "Does ppm increase under hot runs?",
        expected_result: "Higher ppm during hot runs.",
      },
    },
    {
      type: "containment",
      bucket: "containments",
      validTransportItem: {
        description: "Quarantine the last three hot-running batches.",
        rationale: "Prevent suspect product reaching customers.",
        explanation: "Short-term containment.",
      },
      validPayload: {
        description: "Quarantine the last three hot-running batches.",
        rationale: "Prevent suspect product reaching customers.",
      },
    },
    {
      type: "countermeasure",
      bucket: "countermeasures",
      validTransportItem: {
        title: "Install thermal shielding",
        description: "Shield seals from sustained heat.",
        rationale: "Reduce thermal drift during hot runs.",
        hypothesis_ids: [],
        explanation: "Countermeasure tied to thermal hypothesis.",
      },
      validPayload: {
        title: "Install thermal shielding",
        description: "Shield seals from sustained heat.",
        rationale: "Reduce thermal drift during hot runs.",
      },
    },
    {
      type: "universal_action",
      bucket: "universal_actions",
      validTransportItem: {
        title: "Inspect seal alignment after hot runs",
        description: null,
        context_role: "sustainment",
        explanation: "Sustain the countermeasure.",
      },
      validPayload: {
        title: "Inspect seal alignment after hot runs",
        context_role: "sustainment",
      },
    },
    {
      type: "effectiveness_check",
      bucket: "effectiveness_checks",
      validTransportItem: {
        criterion: "Hot-running ppm below 120",
        baseline_description: "Current ppm is 240.",
        target_description: "Target ppm is below 120.",
        explanation: "Verify countermeasure effect.",
      },
      validPayload: {
        criterion: "Hot-running ppm below 120",
        baseline_description: "Current ppm is 240.",
        target_description: "Target ppm is below 120.",
      },
    },
    {
      type: "sustainment_item",
      bucket: "sustainment_items",
      validTransportItem: {
        what: "Daily hot-run seal inspection",
        check_method: "Visual checklist at shift end",
        explanation: "Sustain the improvement.",
      },
      validPayload: {
        what: "Daily hot-run seal inspection",
        check_method: "Visual checklist at shift end",
      },
    },
    {
      type: "session_question",
      bucket: "session_questions",
      validTransportItem: {
        session_id: SESSION_ID,
        body: "What baseline ppm should we compare against?",
        explanation: "Clarify measurement baseline.",
      },
      validPayload: {
        session_id: SESSION_ID,
        body: "What baseline ppm should we compare against?",
      },
    },
    {
      type: "session_summary",
      bucket: "session_summaries",
      validTransportItem: {
        session_id: SESSION_ID,
        body: "Team agreed to test hot-running hypothesis first.",
        explanation: "Capture session outcome.",
      },
      validPayload: {
        session_id: SESSION_ID,
        body: "Team agreed to test hot-running hypothesis first.",
      },
    },
    {
      type: "lessons_learned",
      bucket: "lessons_learned",
      validTransportItem: {
        what_happened:
          "Hot-running defects were initially blamed on operators.",
        what_learned: "Thermal drift was the dominant factor.",
        standardise: null,
        apply_elsewhere: null,
        notes: null,
        explanation: "Capture learning for reuse.",
      },
      validPayload: {
        what_happened:
          "Hot-running defects were initially blamed on operators.",
        what_learned: "Thermal drift was the dominant factor.",
      },
    },
  ];

  it.each(cases)(
    "accepts valid strict transport for $type",
    ({ type, validTransportItem, validPayload, bucket }) => {
      const proposals = flattenValidatedProposalsFromTransport(
        transportWith({
          [bucket]: [validTransportItem],
        }),
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0]?.proposal_type).toBe(type);
      expect(proposals[0]?.payload).toEqual(validPayload);
      expect(validateProposalPayload(type, proposals[0]?.payload)).toEqual(
        validPayload,
      );
    },
  );

  it.each(cases)(
    "rejects missing required fields for $type before persistence",
    ({ type, bucket, validTransportItem }) => {
      const broken = { ...validTransportItem };
      if (type === "hypothesis") {
        delete broken.statement;
      } else if (type === "containment") {
        delete broken.description;
      } else if (type === "current_condition_item") {
        delete broken.statement;
      } else {
        return;
      }

      const proposals = flattenValidatedProposalsFromTransport(
        transportWith({
          [bucket]: [broken],
        }),
      );

      expect(proposals).toHaveLength(0);
      expect(safeValidateProposalPayload(type, broken).success).toBe(false);
    },
  );
});

describe("current condition category domain constraints", () => {
  it("rejects invalid categories before persistence", () => {
    expect(
      safeValidateProposalPayload("current_condition_item", {
        category: "performance",
        statement: "Hot-running defect rate is 2.4x the cold-start baseline.",
      }).success,
    ).toBe(false);

    const proposals = flattenValidatedProposalsFromTransport(
      transportWith({
        current_condition_items: [
          {
            category: "performance",
            statement:
              "Hot-running defect rate is 2.4x the cold-start baseline.",
            explanation: "Invalid category must be dropped.",
          } as never,
        ],
      }),
    );

    expect(proposals).toHaveLength(0);
  });

  it("accepts measured_fact for a measured observation", () => {
    const payload = validateProposalPayload("current_condition_item", {
      category: "measured_fact",
      statement: "Hot-running defect rate is 2.4x the cold-start baseline.",
    });

    expect(payload.category).toBe("measured_fact");

    const proposals = flattenValidatedProposalsFromTransport(
      transportWith({
        current_condition_items: [
          {
            category: "measured_fact",
            statement:
              "Hot-running defect rate is 2.4x the cold-start baseline.",
            explanation: "Records the measured gap.",
          },
        ],
      }),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.payload).toEqual(payload);
  });
});

describe("proposal transport regression cases", () => {
  it("rejects hypothesis payloads with workflow-only fields", () => {
    const proposals = flattenValidatedProposalsFromTransport(
      transportWith({
        hypotheses: [
          {
            statement: "Operator rushing causes defects.",
            category: "technical",
            rationale: null,
            parent_hypothesis_id: null,
            explanation: "Invalid workflow fields should be rejected.",
            type: "technical",
            status: "unverified",
            evidence_required: ["hot run data"],
          } as never,
        ],
      }),
    );

    expect(proposals).toHaveLength(0);
    expect(
      safeValidateProposalPayload("hypothesis", {
        statement: "Operator rushing causes defects.",
        type: "technical",
        status: "unverified",
        evidence_required: ["hot run data"],
      }).success,
    ).toBe(false);
  });

  it("rejects containment payloads with unsupported action fields", () => {
    const proposals = flattenValidatedProposalsFromTransport(
      transportWith({
        containments: [
          {
            description: "Quarantine suspect batches.",
            rationale: null,
            explanation: "Invalid action fields should be rejected.",
            due: "2026-09-01",
            owner: "supervisor",
            action: "hold",
            status: "open",
            verification: "pending",
          } as never,
        ],
      }),
    );

    expect(proposals).toHaveLength(0);
    expect(
      safeValidateProposalPayload("containment", {
        due: "2026-09-01",
        owner: "supervisor",
        action: "hold",
        status: "open",
        verification: "pending",
      }).success,
    ).toBe(false);
  });

  it("accepts valid hypothesis and containment payloads for acceptance", () => {
    const hypothesis = validateProposalPayload("hypothesis", {
      statement: "Thermal expansion shifts seal alignment.",
      category: "technical",
      rationale: "Defect rate rises after sustained hot runs.",
    });
    const containment = validateProposalPayload("containment", {
      description: "Quarantine the last three hot-running batches.",
      rationale: "Prevent suspect product reaching customers.",
    });

    expect(hypothesis.statement).toContain("Thermal expansion");
    expect(containment.description).toContain("Quarantine");
  });
});

describe("sanitizeEnvelopeProposals", () => {
  it("drops invalid proposals from fake/internal envelopes", () => {
    const sanitized = sanitizeEnvelopeProposals([
      {
        proposal_type: "hypothesis",
        payload: {
          statement: "Valid hypothesis.",
          category: "technical",
        },
        explanation: "Valid.",
      },
      {
        proposal_type: "hypothesis",
        payload: {
          statement: "Invalid hypothesis.",
          status: "unverified",
        },
        explanation: "Invalid.",
      },
    ]);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.payload).toEqual({
      statement: "Valid hypothesis.",
      category: "technical",
    });
  });
});

describe("shared schema authority", () => {
  it("uses the same schemas for transport normalization and acceptance", () => {
    const payload = {
      statement: "Thermal expansion shifts seal alignment.",
      category: "technical",
    };

    const transportResult = normalizeProposalsTransport(
      transportWith({
        hypotheses: [
          {
            ...payload,
            rationale: null,
            parent_hypothesis_id: null,
            explanation: "Shared schema check.",
          },
        ],
      }),
    );

    expect(transportResult[0]?.payload).toEqual(payload);
    expect(proposalPayloadSchemas.hypothesis.parse(payload)).toEqual(payload);
  });
});
