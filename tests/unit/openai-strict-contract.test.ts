import { describe, expect, it } from "vitest";

import {
  assertNoUnsupportedOpenAiStrictKeywords,
  assertStrictJsonSchemaCompatible,
} from "@/platform/ai/providers/openai-transport";
import {
  OPERATIONAL_RETRIEVAL_READ_TOOLS,
  buildOperationalRetrievalOpenAiTools,
  parseOperationalRetrievalToolArgs,
} from "@/platform/ai/tools/operational-retrieval-schemas";
import { workspaceAssistantTools } from "@/platform/ai/web-search";
import { facilitatorEnvelopeJsonSchema } from "@/platform/ai/providers/openai-transport";
import { TRAINING_SETUP_BUILDER_JSON_SCHEMA } from "@/platform/ai/prompts/training-setup-builder";
import { SKILLS_SETUP_BUILDER_JSON_SCHEMA } from "@/platform/ai/prompts/skills-setup-builder";
import {
  PROBLEM_SOLVING_READ_TOOLS,
  PROBLEM_SOLVING_TOOLS,
  buildOpenAiTools,
  hypothesisFilterParametersSchema,
  parseToolArgs,
  searchRelatedCasesParametersSchema,
} from "@/platform/ai/tools/problem-solving-schemas";

function collectStrictFunctionTools(): Array<Record<string, unknown>> {
  return [
    ...buildOpenAiTools(),
    ...buildOperationalRetrievalOpenAiTools(),
    ...workspaceAssistantTools(false),
    ...workspaceAssistantTools(true).filter((tool) => tool.strict === true),
  ];
}

describe("OpenAI strict request contract", () => {
  const tools = buildOpenAiTools();

  it("validates the facilitator_envelope response schema", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible(facilitatorEnvelopeJsonSchema),
    ).not.toThrow();
  });

  it("validates module setup builder envelopes (skills, training)", () => {
    expect(() =>
      assertStrictJsonSchemaCompatible(
        SKILLS_SETUP_BUILDER_JSON_SCHEMA,
        "skills_setup_builder",
      ),
    ).not.toThrow();
    expect(() =>
      assertStrictJsonSchemaCompatible(
        TRAINING_SETUP_BUILDER_JSON_SCHEMA,
        "training_setup_builder",
      ),
    ).not.toThrow();
  });

  it("validates every strict function tool parameter schema", () => {
    expect(tools).toHaveLength(PROBLEM_SOLVING_TOOLS.length);

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

  it("covers all 20 problem-solving read and write tools", () => {
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).toEqual([...PROBLEM_SOLVING_TOOLS]);
    expect(tools.some((tool) => tool.type === "web_search")).toBe(false);
  });

  it("validates every LeanAI strict function tool for provider compatibility", () => {
    const strictTools = collectStrictFunctionTools();
    expect(strictTools.length).toBeGreaterThan(PROBLEM_SOLVING_TOOLS.length);

    for (const tool of strictTools) {
      expect(tool.strict).toBe(true);
      expect(tool.type).toBe("function");
      expect(() =>
        assertStrictJsonSchemaCompatible(
          tool.parameters,
          `tool:${String(tool.name)}`,
        ),
      ).not.toThrow();
      expect(() =>
        assertNoUnsupportedOpenAiStrictKeywords(
          tool.parameters,
          `tool:${String(tool.name)}`,
        ),
      ).not.toThrow();
    }
  });
});

describe("operational retrieval strict tool schema", () => {
  it("requires nullable limit and domains for search transport", () => {
    const tool = buildOperationalRetrievalOpenAiTools().find(
      (entry) => entry.name === "search_operational_knowledge",
    );
    expect(tool?.parameters).toMatchObject({
      required: ["query", "limit", "domains"],
      additionalProperties: false,
    });
    expect(
      parseOperationalRetrievalToolArgs("search_operational_knowledge", {
        query: "packaging defect",
        limit: null,
        domains: null,
      }),
    ).toEqual({ query: "packaging defect" });
  });

  it("keeps record_id as plain string transport without format", () => {
    const tool = buildOperationalRetrievalOpenAiTools().find(
      (entry) => entry.name === "get_operational_record_context",
    );
    expect(
      (tool?.parameters as { properties: Record<string, unknown> }).properties
        .record_id,
    ).toEqual({
      type: "string",
      description: "UUID of the operational record.",
    });
    expect(OPERATIONAL_RETRIEVAL_READ_TOOLS).toHaveLength(2);
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
      (PROBLEM_SOLVING_READ_TOOLS as readonly string[]).includes(
        String(tool.name),
      ) &&
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
        parseToolArgs(tool.name as (typeof PROBLEM_SOLVING_TOOLS)[number], {}),
      ).toEqual({});
    }
  });
});
