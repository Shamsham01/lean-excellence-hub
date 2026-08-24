import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parsePublicEnvironment, parseServerEnvironment } from "@/platform/env";

describe("environment validation", () => {
  it("accepts valid publishable Supabase configuration", () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_example",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_example",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    });
  });

  it("rejects missing public configuration", () => {
    expect(() => parsePublicEnvironment({})).toThrow(ZodError);
  });

  it("returns only explicitly validated server values", () => {
    expect(
      parseServerEnvironment({
        APP_ORIGIN: "http://127.0.0.1:3000",
        AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
        NODE_ENV: "test",
        SUPABASE_SECRET_KEY: "must-not-cross-the-boundary",
      }),
    ).toEqual({
      APP_ORIGIN: "http://127.0.0.1:3000",
      AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
      NODE_ENV: "test",
      SUPABASE_SECRET_KEY: "must-not-cross-the-boundary",
    });
  });
});
