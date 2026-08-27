/**
 * Opt-in live OpenAI smoke for eval fixtures.
 * Requires OPENAI_API_KEY and AI_ENABLED=1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAiEnvironment } from "../src/platform/ai/config";
import { createOpenAIProvider } from "../src/platform/ai/providers/openai-responses";
import { buildSystemPrompt } from "../src/platform/ai/prompts/problem-solving-facilitator";
import { buildOpenAiTools } from "../src/platform/ai/tools/problem-solving-schemas";

const fixturePath = join(
  process.cwd(),
  "tests/evals/problem-solving/challenge-assumptions.json",
);

async function main(): Promise<void> {
  const env = getAiEnvironment();
  if (!env.AI_ENABLED) {
    throw new Error("Set AI_ENABLED=1 for live eval smoke.");
  }
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required for live eval smoke.");
  }

  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    userMessage: string;
  };

  const provider = createOpenAIProvider();
  const systemPrompt = buildSystemPrompt("challenge", null);

  const response = await provider.createResponse({
    model: env.AI_MODEL_DEFAULT ?? "gpt-4.1-mini",
    systemPrompt,
    messages: [{ role: "user", content: fixture.userMessage }],
    tools: buildOpenAiTools(),
    maxOutputTokens: 800,
    timeoutMs: 45_000,
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
