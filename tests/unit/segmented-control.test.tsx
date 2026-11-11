import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "@/components/ui/segmented-control";

describe("SegmentedControl", () => {
  afterEach(() => {
    cleanup();
  });

  it("centres segment labels and uses equal flex segments", () => {
    render(
      <SegmentedControl
        aria-label="Test range"
        value="7"
        onChange={vi.fn()}
        options={[
          { value: "7", label: "7 days" },
          { value: "30", label: "30 days" },
          { value: "90", label: "90 days" },
        ]}
      />,
    );

    const segment = screen.getByRole("radio", { name: "30 days" });
    expect(segment.className).toContain("items-center");
    expect(segment.className).toContain("justify-center");
    expect(segment.className).toContain("min-h-11");
    expect(segment.className).toContain("flex-1");
  });

  it("fires onChange when a segment is selected", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Test range"
        value="7"
        onChange={onChange}
        options={[
          { value: "7", label: "7 days" },
          { value: "30", label: "30 days" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "30 days" }));
    expect(onChange).toHaveBeenCalledWith("30");
  });
});
