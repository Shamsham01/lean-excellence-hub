import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/(auth)/update-password/actions", () => ({
  updatePassword: vi.fn(),
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getClaims: (...args: unknown[]) => getClaims(...args),
    },
  }),
}));

import UpdatePasswordPage from "@/app/(auth)/update-password/page";
import { AUTH_COPY } from "@/modules/identity/auth-copy";

async function renderUpdatePassword(searchParams: { error?: string } = {}) {
  const view = await UpdatePasswordPage({
    searchParams: Promise.resolve(searchParams),
  });
  render(view);
}

describe("update password page session guard", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    getClaims.mockReset();
  });

  it("hides the password form when there is no authenticated session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    await renderUpdatePassword();

    expect(screen.getByTestId("update-password-session")).toHaveTextContent(
      AUTH_COPY.updatePasswordSession,
    );
    expect(
      screen.queryByRole("button", { name: "Update password" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request another recovery email" }),
    ).toHaveAttribute("href", "/recover");
  });

  it("shows the form for an authenticated recovery or password-change session", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });

    await renderUpdatePassword({ error: "weak" });

    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("update-password-error")).toHaveTextContent(
      AUTH_COPY.updatePasswordWeak,
    );
  });
});
