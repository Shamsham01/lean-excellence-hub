import "server-only";

import { getAiEnvironment } from "@/platform/ai/config";
import { OpenAIResponsesProvider } from "@/platform/ai/providers/openai-responses-core";

export { facilitatorEnvelopeJsonSchema } from "@/platform/ai/providers/openai-transport";
export { OpenAIResponsesProvider } from "@/platform/ai/providers/openai-responses-core";

export function createOpenAIProvider(): OpenAIResponsesProvider {
  const env = getAiEnvironment();
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAIResponsesProvider(apiKey);
}
