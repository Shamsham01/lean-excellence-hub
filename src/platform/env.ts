import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
});

const serverEnvironmentSchema = z.object({
  APP_ORIGIN: z
    .url("APP_ORIGIN must be a URL")
    .default("http://127.0.0.1:3000"),
  AUTH_RATE_LIMIT_PEPPER: z
    .string()
    .min(32, "AUTH_RATE_LIMIT_PEPPER must be at least 32 characters"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
  TRUSTED_PROXY_IP_HEADER: z
    .enum(["cf-connecting-ip", "fly-client-ip", "x-real-ip"])
    .optional(),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parsePublicEnvironment(
  environment: Record<string, string | undefined>,
): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function getPublicEnvironment(): PublicEnvironment {
  return parsePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

export function getServerEnvironment(): ServerEnvironment {
  return parseServerEnvironment({
    APP_ORIGIN: process.env.APP_ORIGIN,
    AUTH_RATE_LIMIT_PEPPER: process.env.AUTH_RATE_LIMIT_PEPPER,
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    TRUSTED_PROXY_IP_HEADER: process.env.TRUSTED_PROXY_IP_HEADER,
  });
}
