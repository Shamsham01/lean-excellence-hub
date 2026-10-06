import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/modules/identity/invitation-lifecycle", () => ({
  loadInvitationLifecycle: vi.fn(),
}));

import LoginPage from "@/app/(auth)/login/page";
import { AUTH_COPY } from "@/modules/identity/auth-copy";

async function renderLogin(searchParams: { error?: string; next?: string }) {
  const view = await LoginPage({
    searchParams: Promise.resolve(searchParams),
  });
  render(view);
}

describe("login page error UX", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses a neutral failed-login message with a reset password action", async () => {
    await renderLogin({ error: "invalid" });

    expect(screen.getByTestId("login-error")).toHaveTextContent(
      AUTH_COPY.loginInvalid,
    );
    expect(
      screen.queryByText("Unable to sign in with those credentials."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/this account exists/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no account found/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Reset password" }),
    ).toHaveAttribute("href", "/recover");
    expect(
      screen.getByRole("link", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Workforce sign in" }),
    ).toBeInTheDocument();
  });

  it("does not present recovery failures as invalid credentials", async () => {
    await renderLogin({ error: "confirm" });

    expect(screen.getByTestId("login-error")).toHaveTextContent(
      AUTH_COPY.loginConfirm,
    );
    expect(
      screen.queryByText("Unable to sign in with those credentials."),
    ).not.toBeInTheDocument();
  });
});
