import { describe, expect, it, vi } from "vitest";

import {
  createConfirmedInvitationAuthUserWithDeps,
  type InvitationSignupAuthDeps,
} from "@/platform/supabase/invitation-signup-auth-pipeline";

const baseInput = {
  email: "pipeline-invitee@example.test",
  password: "PipelineInvitee123!",
  invitationSignupBindingId: "00000000-0000-4000-8000-000000000101",
  invitationToken: "a".repeat(43),
  inboxProof: "bbbbbbbbbbbbbbbb",
};

function success<T>(data: T) {
  return Promise.resolve({ data, error: null });
}

function buildDeps(
  overrides: Partial<InvitationSignupAuthDeps> = {},
): InvitationSignupAuthDeps {
  return {
    authorizeInvitationSignup: vi.fn(() => success(true)),
    finaliseInvitationSignup: vi.fn(() => success(true)),
    redeemInvitationInboxProof: vi.fn(() => success(true)),
    clearInvitationSignupBindingAuthUser: vi.fn(() => success(true)),
    createAuthUser: vi.fn(() =>
      Promise.resolve({ userId: "00000000-0000-4000-8000-000000000201" }),
    ),
    deleteAuthUser: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe("createConfirmedInvitationAuthUserWithDeps", () => {
  it("does not redeem when Auth createUser rejects, then succeeds on retry with same proof", async () => {
    let createAttempts = 0;
    const deps = buildDeps({
      createAuthUser: vi.fn(async () => {
        createAttempts += 1;
        if (createAttempts === 1) {
          return { error: new Error("GoTrue rejected signup") };
        }
        return { userId: "00000000-0000-4000-8000-000000000201" };
      }),
    });

    const first = await createConfirmedInvitationAuthUserWithDeps(
      baseInput,
      deps,
    );
    expect(first.error?.message).toBeTruthy();
    expect(deps.redeemInvitationInboxProof).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();

    const second = await createConfirmedInvitationAuthUserWithDeps(
      baseInput,
      deps,
    );
    expect(second.userId).toBe("00000000-0000-4000-8000-000000000201");
    expect(deps.redeemInvitationInboxProof).toHaveBeenCalledTimes(1);
    expect(deps.createAuthUser).toHaveBeenCalledTimes(2);
  });

  it("deletes only the newly created Auth user when finalise fails after createUser", async () => {
    const deps = buildDeps({
      finaliseInvitationSignup: vi.fn(() => success(false)),
    });

    const result = await createConfirmedInvitationAuthUserWithDeps(
      baseInput,
      deps,
    );
    expect(result.error?.message).toMatch(/no longer available/i);
    expect(deps.deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000201",
    );
    expect(deps.clearInvitationSignupBindingAuthUser).toHaveBeenCalledTimes(1);
    expect(deps.redeemInvitationInboxProof).not.toHaveBeenCalled();
  });

  it("rolls back Auth user and binding when redeem fails after finalise", async () => {
    const deps = buildDeps({
      redeemInvitationInboxProof: vi.fn(() => success(false)),
    });

    const result = await createConfirmedInvitationAuthUserWithDeps(
      baseInput,
      deps,
    );
    expect(result.error?.message).toMatch(/already been used/i);
    expect(deps.deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(deps.clearInvitationSignupBindingAuthUser).toHaveBeenCalledTimes(1);
    expect(deps.finaliseInvitationSignup).toHaveBeenCalledTimes(1);
  });

  it("skips Auth and redeem when authorize fails", async () => {
    const deps = buildDeps({
      authorizeInvitationSignup: vi.fn(() => success(false)),
    });

    const result = await createConfirmedInvitationAuthUserWithDeps(
      baseInput,
      deps,
    );
    expect(result.error?.message).toMatch(/organisation invitation/i);
    expect(deps.createAuthUser).not.toHaveBeenCalled();
    expect(deps.redeemInvitationInboxProof).not.toHaveBeenCalled();
  });
});
