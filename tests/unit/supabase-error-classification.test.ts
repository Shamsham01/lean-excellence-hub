/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  classifyPermissionProbeResult,
  isSupabaseInfrastructureError,
  isSupabasePermissionDenial,
} from "@/platform/supabase/error-classification";

describe("supabase error classification", () => {
  it("treats permission denial codes as legitimate deny", () => {
    expect(isSupabasePermissionDenial({ code: "42501" })).toBe(true);
    expect(isSupabasePermissionDenial({ code: "PGRST301" })).toBe(true);
    expect(isSupabaseInfrastructureError({ code: "42501" })).toBe(false);
  });

  it("treats transport and database failures as infrastructure", () => {
    expect(isSupabaseInfrastructureError({ code: "57014" })).toBe(true);
    expect(isSupabaseInfrastructureError(new TypeError("fetch failed"))).toBe(
      true,
    );
    expect(
      isSupabaseInfrastructureError({
        message: "connection reset by peer",
      }),
    ).toBe(true);
  });

  it("classifies permission probe RPC errors as deny or infra", () => {
    expect(
      classifyPermissionProbeResult({
        data: null,
        error: { code: "42501" },
      }),
    ).toEqual({ ok: false, denied: true });

    expect(
      classifyPermissionProbeResult({
        data: null,
        error: { code: "57014", message: "canceling statement" },
      }),
    ).toEqual({
      ok: false,
      denied: false,
      error: { code: "57014", message: "canceling statement" },
    });

    expect(
      classifyPermissionProbeResult({
        data: false,
        error: null,
      }),
    ).toEqual({ ok: true, data: false });
  });
});
