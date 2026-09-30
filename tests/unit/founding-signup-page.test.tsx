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

vi.mock("@/app/(auth)/signup/actions", () => ({
  createFoundingAccount: vi.fn(),
}));

import FoundingSignupPage from "@/app/(auth)/signup/page";

const DISCLOSURE_COPY = [
  /email already exists/i,
  /already registered/i,
  /account already exists/i,
  /this email is taken/i,
];

const DEFINITE_DELIVERY_COPY = [
  /we've sent you a confirmation email/i,
  /we sent a confirmation email/i,
  /confirm your address to finish creating your organisation account/i,
];

async function renderSignup(searchParams: { status?: string; error?: string }) {
  const view = await FoundingSignupPage({
    searchParams: Promise.resolve(searchParams),
  });
  render(view);
}

describe("founding signup page UX", () => {
  afterEach(() => {
    cleanup();
  });

  it("describes founder account creation, not organisation creation", async () => {
    await renderSignup({});

    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /organisation setup follows after you confirm your email/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /joining an existing organisation still requires an invitation/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("founding-signup-form")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Create your organisation" }),
    ).not.toBeInTheDocument();
  });

  it("keeps check-email copy anti-enumeration-safe and offers sign-in recovery actions", async () => {
    await renderSignup({ status: "check-email" });

    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /if this is a new account, we've sent a confirmation link\. if you already have an account, sign in or reset your password\./i,
      ),
    ).toBeInTheDocument();

    const panel = screen.getByTestId("founding-signup-check-email");
    expect(panel.querySelector('a[href="/login"]')?.textContent).toMatch(
      /sign in/i,
    );
    expect(panel.querySelector('a[href="/recover"]')?.textContent).toMatch(
      /forgot password/i,
    );
    expect(panel.querySelector('a[href="/signup"]')?.textContent).toMatch(
      /use a different email/i,
    );

    for (const pattern of DISCLOSURE_COPY) {
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();
    }
    for (const pattern of DEFINITE_DELIVERY_COPY) {
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();
    }
    expect(
      screen.queryByTestId("founding-signup-form"),
    ).not.toBeInTheDocument();
  });
});
