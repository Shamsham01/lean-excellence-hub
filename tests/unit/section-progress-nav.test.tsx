import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectionProgressNav } from "@/components/ui/section-progress-nav";

describe("SectionProgressNav", () => {
  it("exposes completion state and selects sections", () => {
    const onSelect = vi.fn();
    render(
      <SectionProgressNav
        ariaLabel="Sections"
        layout="stack"
        testId="section-nav"
        testIdPrefix="section"
        activeId="b"
        onSelect={onSelect}
        items={[
          {
            id: "a",
            label: "Alpha",
            completion: "complete",
            detail: "2/2",
          },
          {
            id: "b",
            label: "Beta",
            completion: "partial",
            detail: "1/2",
          },
        ]}
      />,
    );

    const complete = screen.getByTestId("section-a");
    expect(complete).toHaveAttribute("data-completion-state", "complete");
    expect(complete).toHaveAttribute("aria-label", "Alpha, completed, 2/2");

    const active = screen.getByTestId("section-b");
    expect(active).toHaveAttribute("data-active", "true");
    expect(active).toHaveAttribute("aria-current", "step");

    fireEvent.click(complete);
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
