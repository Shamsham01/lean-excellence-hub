import type React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";

describe("PlatformMemberAvatar", () => {
  it("does not show UN initials for unassigned work", () => {
    render(<PlatformMemberAvatar displayName="Unassigned" unassigned />);
    expect(screen.queryByText("UN")).toBeNull();
    expect(screen.getByRole("img", { name: "Unassigned" })).toBeTruthy();
  });

  it("falls back to initials when the image fails to load", () => {
    render(
      <PlatformMemberAvatar
        displayName="Pat Brown"
        avatarUrl="https://example.test/broken.png"
      />,
    );
    const img = screen.getByRole("img", { name: "Pat Brown" });
    fireEvent.error(img);
    expect(screen.getByRole("img", { name: "Pat Brown" })).toHaveTextContent(
      "PB",
    );
  });
});
