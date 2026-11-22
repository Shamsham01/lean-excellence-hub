import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
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

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { unoptimized: _unoptimized, priority: _priority, ...rest } = props;
    void _unoptimized;
    void _priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as Record<string, string>)} />;
  },
}));

import { EarlyAccessPage } from "@/components/marketing/early-access-page";
import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
} from "@/lib/marketing/demo-booking";

describe("early-access page", () => {
  afterEach(() => cleanup());

  it("renders the form with a free number-of-sites field and a demo alternative", () => {
    render(<EarlyAccessPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Get free access." }),
    ).toBeVisible();
    const sites = screen.getByLabelText("Number of sites");
    expect(sites).toHaveAttribute("type", "number");
    expect(sites).toHaveAttribute("min", "1");
    expect(sites).toHaveAttribute("placeholder", "e.g. 3");
    expect(document.querySelector("select[name=sites]")).toBeNull();
    expect(
      screen.getByRole("button", { name: GET_FREE_ACCESS_CTA }),
    ).toBeVisible();
    const aside = screen.getByRole("complementary");
    expect(
      within(aside).getByRole("link", { name: DEMO_BOOKING_CTA }),
    ).toHaveAttribute("href", "/demo");
    expect(document.body.textContent).not.toMatch(
      /Harbourfield|before we go live|£|\$\d/,
    );
  });
});
