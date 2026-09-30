/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const prepareFoundingSignupBinding = vi.fn();
const signUp = vi.fn();
const resolveApplicationOrigin = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/platform/application-origin", () => ({
  resolveApplicationOrigin: (...args: unknown[]) =>
    resolveApplicationOrigin(...args),
}));

vi.mock("@/platform/supabase/secret", () => ({
  prepareFoundingSignupBinding: (...args: unknown[]) =>
    prepareFoundingSignupBinding(...args),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      signUp: (...args: unknown[]) => signUp(...args),
    },
  }),
}));

import { createFoundingAccount } from "@/app/(auth)/signup/actions";

const VALID_PASSWORD = "Strong-Password-2026!";

function signupForm(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", VALID_PASSWORD);
  formData.set("confirmPassword", VALID_PASSWORD);
  return formData;
}

async function collectRedirect(formData: FormData) {
  try {
    await createFoundingAccount(formData);
    throw new Error("expected a redirect");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) {
      return error.message.slice("REDIRECT:".length);
    }
    throw error;
  }
}

describe("createFoundingAccount anti-enumeration redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareFoundingSignupBinding.mockResolvedValue({
      data: "binding-id",
      error: null,
    });
    resolveApplicationOrigin.mockReturnValue({
      ok: true,
      origin: "http://127.0.0.1:3000",
    });
  });

  it("sends a brand-new identity to the same check-email path", async () => {
    signUp.mockResolvedValue({
      data: {
        user: {
          identities: [{ identity_id: "new-identity" }],
        },
      },
      error: null,
    });

    await expect(
      collectRedirect(signupForm("new-founder@example.test")),
    ).resolves.toBe("/signup?status=check-email");

    expect(prepareFoundingSignupBinding).toHaveBeenCalledWith(
      "new-founder@example.test",
    );
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new-founder@example.test",
        options: expect.objectContaining({
          emailRedirectTo: "http://127.0.0.1:3000/auth/confirm",
          data: { founding_signup_binding: "binding-id" },
        }),
      }),
    );
  });

  it("does not disclose an existing confirmed identity when Auth returns no error", async () => {
    signUp.mockResolvedValue({
      data: {
        user: {
          identities: [],
        },
      },
      error: null,
    });

    await expect(
      collectRedirect(signupForm("Existing.Founder@example.test")),
    ).resolves.toBe("/signup?status=check-email");

    expect(prepareFoundingSignupBinding).toHaveBeenCalledWith(
      "existing.founder@example.test",
    );
    expect(redirect).not.toHaveBeenCalledWith("/signup?error=signup");
    expect(redirect.mock.calls.map(([path]) => path)).not.toContain(
      "/signup?error=exists",
    );
  });

  it("keeps signup failures generic instead of reporting that an email exists", async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });

    await expect(
      collectRedirect(signupForm("existing-founder@example.test")),
    ).resolves.toBe("/signup?error=signup");
  });
});
