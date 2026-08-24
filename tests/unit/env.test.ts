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
        NODE_ENV: "test",
        SUPABASE_SECRET_KEY: "must-not-cross-the-boundary",
      }),
    ).toEqual({ NODE_ENV: "test" });
  });
});
