import { describe, expect, it } from "vitest";

import { parseSkillsBuilderEnvelope } from "@/modules/skills/ai-builder/proposal";
import {
  hashSkillsSetupBuilderJsonSchema,
  SKILLS_SETUP_BUILDER_JSON_SCHEMA,
} from "@/platform/ai/prompts/skills-setup-builder";
import { parseStructuredOpenAiResponse } from "@/platform/ai/providers/openai-response-parser";
import { SKILLS_SETUP_BUILDER_FORMAT_NAME } from "@/platform/ai/prompts/skills-setup-builder";

describe("Skills builder envelope contract", () => {
  const validDiscovery = {
    message: "Thanks — one more detail will help.",
    phase: "discovery" as const,
    understanding: {
      operation: "Bakery deck oven",
      scale: null,
      roles: null,
      evidence: null,
      applicability: null,
    },
    questions: [],
    change_summary: [],
    proposal: null,
  };

  it("accepts provider-like discovery answers with sparse understanding and empty questions", () => {
    const parsed = parseSkillsBuilderEnvelope({
      message: validDiscovery.message,
      phase: "discovery",
      understanding: {
        operation: "Bakery deck oven",
      },
      questions: [],
      changeSummary: [],
      proposal: null,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.phase).toBe("discovery");
      expect(parsed.envelope.questions).toEqual([]);
      expect(parsed.envelope.proposalStatus).toBe("none");
    }
  });

  it("maps camelCase suggestedAnswers onto the stored contract", () => {
    const parsed = parseSkillsBuilderEnvelope({
      ...validDiscovery,
      questions: [
        {
          question: "Which roles should demonstrate the skills?",
          suggestedAnswers: ["Oven Operator", "Team Leader"],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.questions[0]?.suggestedAnswers).toEqual([
        "Oven Operator",
        "Team Leader",
      ]);
    }
  });

  it("returns safe parse issue codes instead of a generic failure", () => {
    const parsed = parseSkillsBuilderEnvelope({
      message: "Broken",
      phase: "proposal",
      understanding: validDiscovery.understanding,
      questions: [],
      change_summary: [],
      proposal: "not-an-object",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues.some((code) => code.includes("proposal"))).toBe(
        true,
      );
      expect(parsed.issues[0]).toMatch(/@/);
    }
  });

  it("round-trips json_schema output through the OpenAI parser and Skills adapter", () => {
    const raw = JSON.stringify(validDiscovery);
    const response = parseStructuredOpenAiResponse(
      {
        id: "resp-skills-contract",
        status: "completed",
        output_text: raw,
        usage: { input_tokens: 10, output_tokens: 20 },
      },
      {
        provider: "openai",
        model: "gpt-6.1-terra",
        maxOutputTokens: 4000,
        formatName: SKILLS_SETUP_BUILDER_FORMAT_NAME,
      },
    );
    const parsed = parseSkillsBuilderEnvelope(response.parsedJson);
    expect(parsed.ok).toBe(true);
    expect(hashSkillsSetupBuilderJsonSchema()).toHaveLength(64);
    expect(SKILLS_SETUP_BUILDER_JSON_SCHEMA.required).toContain("proposal");
  });
});
