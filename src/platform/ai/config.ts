import "server-only";

import { z } from "zod";

const aiEnvironmentSchema = z.object({
  AI_ENABLED: z.enum(["0", "1"]).optional(),
  AI_PROVIDER: z.enum(["openai", "fake"]).optional(),
  AI_ALLOW_FAKE_PROVIDER: z.enum(["0", "1"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL_DEFAULT: z.string().optional(),
  AI_MODEL_REASONING: z.string().optional(),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
  AI_MAX_TOOL_CALLS: z.coerce.number().int().positive().optional(),
  AI_RUN_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
});

export type AiEnvironment = z.infer<typeof aiEnvironmentSchema>;

export function parseAiEnvironment(
  environment: Record<string, string | undefined>,
): AiEnvironment {
  return aiEnvironmentSchema.parse(environment);
}

export function getAiEnvironment(): AiEnvironment {
  return parseAiEnvironment({
    AI_ENABLED: process.env.AI_ENABLED,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_ALLOW_FAKE_PROVIDER: process.env.AI_ALLOW_FAKE_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_MODEL_DEFAULT: process.env.AI_MODEL_DEFAULT,
    AI_MODEL_REASONING: process.env.AI_MODEL_REASONING,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS,
    AI_MAX_TOOL_CALLS: process.env.AI_MAX_TOOL_CALLS,
    AI_RUN_TIMEOUT_MS: process.env.AI_RUN_TIMEOUT_MS,
  });
}

export const AI_DEFAULTS = {
  model: "gpt-4.1-mini",
  maxOutputTokens: 2048,
  maxToolCalls: 8,
  runTimeoutMs: 45_000,
} as const;

export function isApplicationAiProviderAvailable(): boolean {
  const env = getAiEnvironment();
  if (env.AI_ENABLED !== "1") return false;

  const provider = env.AI_PROVIDER ?? "openai";
  if (provider === "fake") {
    if (process.env.NODE_ENV === "production") return false;
    return env.AI_ALLOW_FAKE_PROVIDER === "1";
  }

  return Boolean(env.OPENAI_API_KEY?.trim());
}
