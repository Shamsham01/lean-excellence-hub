/**
 * Opt-in live OpenAI smoke for eval fixtures.
 * Requires OPENAI_API_KEY and AI_ENABLED=1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { prepareWorkflowModelCall } from "../src/platform/ai/model-compatibility";
import { OpenAIResponsesProvider } from "../src/platform/ai/providers/openai-responses-core";
import { buildSystemPrompt } from "../src/platform/ai/prompts/problem-solving-facilitator";
import { buildOpenAiTools } from "../src/platform/ai/tools/problem-solving-schemas";

const fixturePath = join(
  process.cwd(),
  "tests/evals/problem-solving/challenge-assumptions.json",
);

async function main(): Promise<void> {
  if (process.env.AI_ENABLED !== "1") {
    throw new Error("Set AI_ENABLED=1 for live eval smoke.");
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for live eval smoke.");
  }

  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    userMessage: string;
  };

  const provider = new OpenAIResponsesProvider(apiKey);
  const systemPrompt = buildSystemPrompt("challenge", null);
  const prepared = prepareWorkflowModelCall({
    workflow: "problem_solving_challenge",
    model: process.env.AI_MODEL_DEFAULT?.trim() || "gpt-6.1-sol",
    environment: {},
  });

  const response = await provider.createResponse({
    model: prepared.model,
    systemPrompt,
    messages: [{ role: "user", content: fixture.userMessage }],
    tools: buildOpenAiTools(),
    maxOutputTokens: prepared.maxOutputTokens,
    timeoutMs: 45_000,
    reasoningEffort: prepared.reasoningEffort,
  });

  if (!response.structuredOutput?.message) {
    throw new Error("Live eval did not return a structured envelope.");
  }

  console.log("eval:ai:live ok");
  console.log(response.structuredOutput.message.slice(0, 200));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
