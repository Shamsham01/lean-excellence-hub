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

vi.mock("@/app/(auth)/recover/actions", () => ({
  requestRecovery: vi.fn(),
}));

import RecoverPage from "@/app/(auth)/recover/page";
import { AUTH_COPY } from "@/modules/identity/auth-copy";

async function renderRecover(searchParams: { sent?: string; error?: string }) {
  const view = await RecoverPage({
    searchParams: Promise.resolve(searchParams),
  });
  render(view);
}

describe("recover page UX", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the sent state anti-enumeration-safe", async () => {
    await renderRecover({ sent: "true" });

    expect(screen.getByTestId("recover-sent")).toHaveTextContent(
      AUTH_COPY.recoverSent,
    );
    expect(screen.queryByText(/your account exists/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/email already registered/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("explains expired recovery links and offers another request", async () => {
    await renderRecover({ error: "expired" });

    expect(screen.getByTestId("recover-expired")).toHaveTextContent(
      AUTH_COPY.recoverExpired,
    );
    expect(
      screen.getByRole("button", { name: "Request another recovery email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unable to sign in with those credentials."),
    ).not.toBeInTheDocument();
  });
});
