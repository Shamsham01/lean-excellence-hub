import { describe, expect, it } from "vitest";

import { assertStrictJsonSchemaCompatible } from "@/platform/ai/providers/openai-transport";
import { facilitatorEnvelopeJsonSchema } from "@/platform/ai/providers/openai-transport";
import {
  PROBLEM_SOLVING_READ_TOOLS,
  buildOpenAiTools,
  hypothesisFilterParametersSchema,
  parseToolArgs,
  searchRelatedCasesParametersSchema,
} from "@/platform/ai/tools/problem-solving-schemas";

describe("OpenAI strict request contract", () => {
  const tools = buildOpenAiTools();

  it("validates the facilitator_envelope response schema", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible(facilitatorEnvelopeJsonSchema),
    ).not.toThrow();
  });

  it("validates every strict function tool parameter schema", () => {
    expect(tools).toHaveLength(PROBLEM_SOLVING_READ_TOOLS.length);

    for (const tool of tools) {
      expect(tool.strict).toBe(true);
      expect(() =>
        assertStrictJsonSchemaCompatible(
          tool.parameters,
          `tool:${String(tool.name)}`,
        ),
      ).not.toThrow();
    }
  });

  it("covers all 13 problem-solving read tools", () => {
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).toEqual([...PROBLEM_SOLVING_READ_TOOLS]);
  });
});

describe("get_hypotheses strict tool schema", () => {
  it("requires status with nullable string transport", () => {
    expect(hypothesisFilterParametersSchema.required).toEqual(["status"]);
    expect(hypothesisFilterParametersSchema.properties.status).toEqual({
      type: ["string", "null"],
    });
    expect(hypothesisFilterParametersSchema.additionalProperties).toBe(false);
  });

  it("maps null status to no filter for domain parsing", () => {
    expect(parseToolArgs("get_hypotheses", { status: null })).toEqual({});
    expect(parseToolArgs("get_hypotheses", { status: "active" })).toEqual({
      status: "active",
    });
  });
});

describe("search_related_problem_solving_cases strict tool schema", () => {
  it("requires limit with nullable integer transport and bounds", () => {
    expect(searchRelatedCasesParametersSchema.required).toEqual(["limit"]);
    expect(searchRelatedCasesParametersSchema.properties.limit).toEqual({
      type: ["integer", "null"],
      minimum: 1,
      maximum: 20,
    });
    expect(searchRelatedCasesParametersSchema.additionalProperties).toBe(false);
  });

  it("maps null limit to default domain semantics", () => {
    expect(
      parseToolArgs("search_related_problem_solving_cases", { limit: null }),
    ).toEqual({});
    expect(
      parseToolArgs("search_related_problem_solving_cases", { limit: 10 }),
    ).toEqual({ limit: 10 });
  });

  it("rejects out-of-range limits during domain parsing", () => {
    expect(() =>
      parseToolArgs("search_related_problem_solving_cases", { limit: 0 }),
    ).toThrow();
    expect(() =>
      parseToolArgs("search_related_problem_solving_cases", { limit: 21 }),
    ).toThrow();
  });
});

describe("empty strict tool parameter schemas", () => {
  const emptyTools = buildOpenAiTools().filter(
    (tool) =>
      tool.name !== "get_hypotheses" &&
      tool.name !== "search_related_problem_solving_cases",
  );

  it("uses closed empty objects for parameterless tools", () => {
    for (const tool of emptyTools) {
      expect(tool.parameters).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      });
    }
  });

  it("parses empty transport args for parameterless tools", () => {
    for (const tool of emptyTools) {
      expect(
        parseToolArgs(
          tool.name as (typeof PROBLEM_SOLVING_READ_TOOLS)[number],
          {},
        ),
      ).toEqual({});
    }
  });
});
