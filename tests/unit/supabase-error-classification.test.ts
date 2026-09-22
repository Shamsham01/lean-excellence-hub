/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  classifyPermissionProbeResult,
  classifySupabaseError,
  isSupabaseAuthSessionFailure,
  isSupabaseInfrastructureError,
  isSupabaseNotFound,
  isSupabasePermissionDenial,
} from "@/platform/supabase/error-classification";

describe("supabase error classification", () => {
  it("treats 42501 as explicit database authorization denial", () => {
    expect(classifySupabaseError({ code: "42501" })).toBe(
      "authorization_denial",
    );
    expect(isSupabasePermissionDenial({ code: "42501" })).toBe(true);
    expect(isSupabaseInfrastructureError({ code: "42501" })).toBe(false);
  });

  it("treats PGRST301 as auth/session failure rather than permission denial", () => {
    expect(classifySupabaseError({ code: "PGRST301" })).toBe(
      "auth_session_failure",
    );
    expect(isSupabaseAuthSessionFailure({ code: "PGRST301" })).toBe(true);
    expect(isSupabasePermissionDenial({ code: "PGRST301" })).toBe(false);
    expect(isSupabaseInfrastructureError({ code: "PGRST301" })).toBe(false);
  });

  it("treats P0002 as not-found", () => {
    expect(classifySupabaseError({ code: "P0002" })).toBe("not_found");
    expect(isSupabaseNotFound({ code: "P0002" })).toBe(true);
    expect(isSupabasePermissionDenial({ code: "P0002" })).toBe(false);
  });

  it("treats transport and database failures as infrastructure", () => {
    expect(classifySupabaseError({ code: "57014" })).toBe("infrastructure");
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

  it("does not guess unknown error codes into permission denial", () => {
    expect(classifySupabaseError({ code: "XX000" })).toBe("infrastructure");
    expect(isSupabasePermissionDenial({ code: "XX000" })).toBe(false);
  });

  it("classifies permission probe RPC outcomes by category", () => {
    expect(
      classifyPermissionProbeResult({
        data: null,
        error: { code: "42501" },
      }),
    ).toEqual({ ok: false, outcome: "denied" });

    expect(
      classifyPermissionProbeResult({
        data: null,
        error: { code: "PGRST301", message: "JWT expired" },
      }),
    ).toEqual({
      ok: false,
      outcome: "auth_failure",
      error: { code: "PGRST301", message: "JWT expired" },
    });

    expect(
      classifyPermissionProbeResult({
        data: null,
        error: { code: "P0002", message: "resource not found" },
      }),
    ).toEqual({
      ok: false,
      outcome: "not_found",
      error: { code: "P0002", message: "resource not found" },
    });

    expect(
      classifyPermissionProbeResult({
        data: null,
        error: { code: "57014", message: "canceling statement" },
      }),
    ).toEqual({
      ok: false,
      outcome: "infrastructure",
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
