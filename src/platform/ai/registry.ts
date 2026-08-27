import "server-only";

import { getAiEnvironment } from "@/platform/ai/config";
import { FakeAIProvider } from "@/platform/ai/providers/fake";
import { createOpenAIProvider } from "@/platform/ai/providers/openai-responses";
import type { AIProvider } from "@/platform/ai/types";

export function resolveAIProvider(): AIProvider {
  const env = getAiEnvironment();
  const provider = env.AI_PROVIDER ?? "openai";

  if (provider === "fake") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Fake AI provider is not permitted in production");
    }
    if (env.AI_ALLOW_FAKE_PROVIDER !== "1") {
      throw new Error(
        "Fake AI provider is not permitted without AI_ALLOW_FAKE_PROVIDER=1",
      );
    }
    return new FakeAIProvider();
  }

  if (provider === "openai") {
    return createOpenAIProvider();
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}
