import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { TooltipProvider } from "@/components/ui/tooltip";

function renderAvatar(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("PlatformMemberAvatar", () => {
  it("does not show UN initials for unassigned work", () => {
    renderAvatar(<PlatformMemberAvatar displayName="Unassigned" unassigned />);
    expect(screen.queryByText("UN")).toBeNull();
    expect(screen.getByLabelText("Unassigned")).toBeTruthy();
  });

  it("renders a profile image when avatarUrl is provided", () => {
    renderAvatar(
      <PlatformMemberAvatar
        displayName="Pat Brown"
        avatarUrl="https://example.test/avatar.png"
      />,
    );
    expect(screen.getByLabelText("Pat Brown")).toBeTruthy();
    const img = document.querySelector(
      'img[src="https://example.test/avatar.png"]',
    );
    expect(img).toBeTruthy();
  });
});
