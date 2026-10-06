import { describe, expect, it } from "vitest";

import {
  RECOVERY_FAILURE_PATH,
  RECOVERY_SUCCESS_PATH,
  recoveryForwardSearchParams,
  resolveRecoveryCallbackIntent,
} from "@/modules/identity/recovery-callback";

describe("recovery callback intent", () => {
  it("accepts the custom TokenHash recovery form", () => {
    expect(
      resolveRecoveryCallbackIntent({
        tokenHash: "abc123tokenhash",
        type: "recovery",
        code: null,
      }),
    ).toEqual({ kind: "verify_otp", tokenHash: "abc123tokenhash" });
  });

  it("accepts a PKCE code on the dedicated recovery route", () => {
    expect(
      resolveRecoveryCallbackIntent({
        tokenHash: null,
        type: null,
        code: "pkce-code",
      }),
    ).toEqual({ kind: "exchange_code", code: "pkce-code" });
  });

  it("rejects signup, invite, and magiclink types", () => {
    for (const type of ["signup", "invite", "magiclink", "email_change"]) {
      expect(
        resolveRecoveryCallbackIntent({
          tokenHash: "abc123tokenhash",
          type,
          code: null,
        }),
      ).toEqual({ kind: "invalid" });
    }
  });

  it("rejects token_hash without an explicit recovery type", () => {
    expect(
      resolveRecoveryCallbackIntent({
        tokenHash: "abc123tokenhash",
        type: null,
        code: null,
      }),
    ).toEqual({ kind: "invalid" });
  });

  it("ignores next and only forwards recovery callback parameters", () => {
    const forwarded = recoveryForwardSearchParams(
      new URLSearchParams({
        token_hash: "abc123tokenhash",
        type: "recovery",
        next: "https://evil.example/phish",
        code: "",
      }),
    );

    expect(forwarded.get("token_hash")).toBe("abc123tokenhash");
    expect(forwarded.get("type")).toBe("recovery");
    expect(forwarded.get("next")).toBeNull();
    expect(RECOVERY_FAILURE_PATH).toBe("/recover?error=expired");
    expect(RECOVERY_SUCCESS_PATH).toBe("/update-password");
  });
});
