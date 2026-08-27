import { describe, expect, it } from "vitest";

import { createEmptyProposalsTransport } from "@/platform/ai/proposals/proposal-transport";
import {
  addToAllowlist,
  createSourceAllowlist,
  filterAllowedSourceRefs,
} from "@/platform/ai/source-allowlist";
import {
  assertStrictJsonSchemaCompatible,
  facilitatorEnvelopeJsonSchema,
  normalizeTransportEnvelope,
  type OpenAiFacilitatorEnvelopeTransport,
} from "@/platform/ai/providers/openai-transport";

describe("facilitatorEnvelopeJsonSchema", () => {
  it("is strict-compatible for OpenAI Structured Outputs", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible(facilitatorEnvelopeJsonSchema),
    ).not.toThrow();
  });

  it("requires observation support_level in the root schema", () => {
    const observationItem = (
      facilitatorEnvelopeJsonSchema.properties.observations as unknown as {
        items: {
          required: readonly string[];
          properties: Record<string, unknown>;
        };
      }
    ).items;

    expect(observationItem.required).toContain("support_level");
    expect(observationItem.required).toEqual(
      expect.arrayContaining(Object.keys(observationItem.properties)),
    );
    expect(observationItem.required).toHaveLength(
      Object.keys(observationItem.properties).length,
    );
  });

  it("uses closed source reference transport objects", () => {
    const sourceRefItem = (
      facilitatorEnvelopeJsonSchema.properties.source_refs as unknown as {
        items: {
          required: readonly string[];
          properties: Record<string, unknown>;
          additionalProperties: boolean;
        };
      }
    ).items;

    expect(sourceRefItem.required).toEqual(
      expect.arrayContaining(["label", "ref_type", "ref_id"]),
    );
    expect(sourceRefItem.required).toHaveLength(
      Object.keys(sourceRefItem.properties).length,
    );
    expect(sourceRefItem.additionalProperties).toBe(false);
    expect(sourceRefItem.properties).not.toHaveProperty("ref");
  });

  it("uses typed proposal buckets instead of free-form payload_json", () => {
    const proposalsSchema = facilitatorEnvelopeJsonSchema.properties
      .proposals as unknown as {
      type: string;
      required: readonly string[];
      properties: Record<string, unknown>;
      additionalProperties: boolean;
    };

    expect(proposalsSchema.type).toBe("object");
    expect(proposalsSchema.additionalProperties).toBe(false);
    expect(proposalsSchema.required).toEqual(
      expect.arrayContaining([
        "hypotheses",
        "containments",
        "current_condition_items",
      ]),
    );
    expect(proposalsSchema.properties).not.toHaveProperty("payload_json");
  });
});

describe("normalizeTransportEnvelope", () => {
  const baseTransport: OpenAiFacilitatorEnvelopeTransport = {
    message: "Lean AI response",
    observations: [
      {
        text: "Measured defect rate is recorded.",
        support_level: "well_supported",
      },
      {
        text: "Operator pacing is an assumption.",
        support_level: "insufficient_evidence",
      },
    ],
    questions: ["What evidence exists?"],
    warnings: ["Do not close the case yet."],
    source_refs: [],
    proposals: createEmptyProposalsTransport(),
  };

  it("preserves required observation support levels", () => {
    const envelope = normalizeTransportEnvelope(baseTransport);

    expect(envelope.observations).toEqual([
      {
        text: "Measured defect rate is recorded.",
        support_level: "well_supported",
      },
      {
        text: "Operator pacing is an assumption.",
        support_level: "insufficient_evidence",
      },
    ]);
  });

  it("maps transport source refs into typed internal refs", () => {
    const envelope = normalizeTransportEnvelope({
      ...baseTransport,
      source_refs: [
        {
          label: "Hypothesis A",
          ref_type: "hypothesis_id",
          ref_id: "abc-123",
        },
      ],
    });

    expect(envelope.source_refs).toEqual([
      {
        label: "Hypothesis A",
        ref: { hypothesis_id: "abc-123" },
      },
    ]);
  });

  it("keeps allowlist filtering intact after source ref normalisation", () => {
    const envelope = normalizeTransportEnvelope({
      ...baseTransport,
      source_refs: [
        {
          label: "Allowed",
          ref_type: "hypothesis_id",
          ref_id: "abc-123",
        },
        {
          label: "Invented",
          ref_type: "hypothesis_id",
          ref_id: "not-allowed",
        },
      ],
    });

    const allowlist = createSourceAllowlist();
    addToAllowlist(allowlist, { hypothesis_id: "abc-123" });

    const filtered = filterAllowedSourceRefs(allowlist, envelope.source_refs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.label).toBe("Allowed");
  });

  it("flattens valid typed proposal transport into internal proposals", () => {
    const envelope = normalizeTransportEnvelope({
      ...baseTransport,
      proposals: {
        ...createEmptyProposalsTransport(),
        hypothesis_tests: [
          {
            hypothesis_id: "00000000-0000-4000-8000-000000000001",
            test_question: "Does ppm increase under hot runs?",
            expected_result: "Higher ppm during hot runs.",
            method: null,
            explanation: "A hot-running test would isolate thermal drift.",
          },
        ],
      },
    });

    expect(envelope.proposals).toHaveLength(1);
    expect(envelope.proposals[0]?.proposal_type).toBe("hypothesis_test");
    expect(envelope.proposals[0]?.payload).toEqual({
      hypothesis_id: "00000000-0000-4000-8000-000000000001",
      test_question: "Does ppm increase under hot runs?",
      expected_result: "Higher ppm during hot runs.",
    });
  });

  it("discards invalid proposal transport before persistence", () => {
    const envelope = normalizeTransportEnvelope({
      ...baseTransport,
      proposals: {
        ...createEmptyProposalsTransport(),
        hypotheses: [
          {
            statement: "Invalid hypothesis.",
            category: null,
            rationale: null,
            parent_hypothesis_id: null,
            explanation:
              "Missing required statement min length is fine but extra fields fail.",
            type: "technical",
            status: "unverified",
            evidence_required: ["data"],
          } as never,
        ],
      },
    });

    expect(envelope.proposals).toEqual([]);
  });
});

describe("assertStrictJsonSchemaCompatible", () => {
  it("detects missing required properties", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible({
        type: "object",
        properties: {
          text: { type: "string" },
          support_level: { type: "string" },
        },
        required: ["text"],
        additionalProperties: false,
      }),
    ).toThrow(/missing "support_level"/);
  });

  it("detects free-form object payloads", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible({
        type: "object",
        properties: {
          payload: {
            type: "object",
            properties: {
              field: { type: "string" },
            },
            required: ["field"],
            additionalProperties: true,
          },
        },
        required: ["payload"],
        additionalProperties: false,
      }),
    ).toThrow(/additionalProperties must be false/);
  });
});
