import { describe, expect, it } from "vitest";

import { parseTrainingBuilderEnvelope } from "@/modules/training/ai-builder/proposal";
import {
  TRAINING_SETUP_BUILDER_JSON_SCHEMA,
  hashTrainingSetupBuilderJsonSchema,
} from "@/platform/ai/prompts/training-setup-builder";
import { assertStrictJsonSchemaCompatible } from "@/platform/ai/providers/openai-transport";

describe("Training builder envelope contract", () => {
  it("is strict-compatible", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible(TRAINING_SETUP_BUILDER_JSON_SCHEMA),
    ).not.toThrow();
    expect(hashTrainingSetupBuilderJsonSchema()).toHaveLength(64);
  });

  it("parses a minimal discovery envelope", () => {
    const parsed = parseTrainingBuilderEnvelope({
      message: "One more detail will help.",
      phase: "discovery",
      understanding: {
        operation: "Packaging",
        audience: null,
        delivery: null,
        compliance: null,
        curriculum: null,
      },
      questions: [],
      change_summary: [],
      proposal: null,
    });
    expect(parsed.ok).toBe(true);
  });
});
