import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppLink } from "@/components/ui/app-link";

const hardNavigate = vi.fn();

vi.mock("@/lib/navigation/navigate", () => ({
  hardNavigate: (...args: unknown[]) => hardNavigate(...args),
  navigateTo: (...args: unknown[]) => hardNavigate(...args),
}));

afterEach(() => {
  cleanup();
  hardNavigate.mockReset();
});

describe("AppLink", () => {
  it("renders a real href and leaves ordinary primary clicks to the browser", () => {
    render(<AppLink href="/platform/suggestions">Suggestions</AppLink>);

    const link = screen.getByRole("link", { name: "Suggestions" });
    expect(link).toHaveAttribute("href", "/platform/suggestions");
    expect(link.tagName).toBe("A");

    fireEvent.click(link);
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it("does not preventDefault on cmd/ctrl or middle clicks", () => {
    render(<AppLink href="/platform/actions">Actions</AppLink>);
    const link = screen.getByRole("link", { name: "Actions" });

    const ctrlClick = fireEvent.click(link, { ctrlKey: true, button: 0 });
    expect(ctrlClick).toBe(true);

    const middleClick = fireEvent.click(link, { button: 1 });
    expect(middleClick).toBe(true);
    expect(hardNavigate).not.toHaveBeenCalled();
  });

  it("uses replace navigation only when requested", () => {
    render(
      <AppLink href="/platform/suggestions" replace>
        Suggestions
      </AppLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Suggestions" }));
    expect(hardNavigate).toHaveBeenCalledWith("/platform/suggestions", true);
  });

  it("respects a caller that already cancelled the click", () => {
    render(
      <AppLink
        href="/platform/actions"
        replace
        onClick={(event) => event.preventDefault()}
      >
        Actions
      </AppLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Actions" }));
    expect(hardNavigate).not.toHaveBeenCalled();
  });
});
