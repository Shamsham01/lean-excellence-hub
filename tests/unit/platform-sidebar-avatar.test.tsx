import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlatformSidebarFooter } from "@/components/platform/platform-sidebar-footer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/platform",
}));

describe("PlatformSidebarFooter avatar", () => {
  it("shows initials placeholder when no profile photo is uploaded", () => {
    render(
      <PlatformSidebarFooter
        member={{
          displayName: "Priya Rahman",
          avatarUrl: null,
          roleLabel: "Admin",
        }}
        showSettings
      />,
    );

    const avatar = screen.getByTestId("platform-sidebar-avatar");
    expect(avatar).toHaveTextContent("PR");
  });
});
