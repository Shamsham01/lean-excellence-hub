import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PlatformSidebar desktop layout", () => {
  it("pins the desktop sidebar while main content scrolls", () => {
    const sidebar = readFileSync(
      "src/components/platform/platform-sidebar.tsx",
      "utf8",
    );
    const shell = readFileSync(
      "src/components/platform/platform-shell.tsx",
      "utf8",
    );

    expect(sidebar).toContain("lg:fixed");
    expect(sidebar).toContain("lg:left-0");
    expect(sidebar).toContain("lg:inset-y-0");
    expect(sidebar).toContain("lg:h-dvh");
    expect(sidebar).toContain("lg:max-h-dvh");
    expect(sidebar).toContain('data-testid="platform-desktop-sidebar"');
    expect(shell).toContain("lg:ml-[290px]");
  });
});
