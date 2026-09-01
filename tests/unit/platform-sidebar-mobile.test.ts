import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readComponent(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("platform sidebar layout", () => {
  it("uses independently scrollable navigation with fixed header and footer zones", () => {
    const navigation = readComponent(
      "src/components/platform/platform-navigation.tsx",
    );
    const sidebar = readComponent(
      "src/components/platform/platform-sidebar.tsx",
    );
    const header = readComponent(
      "src/components/platform/platform-sidebar-header.tsx",
    );
    const footer = readComponent(
      "src/components/platform/platform-sidebar-footer.tsx",
    );

    expect(navigation).toContain("sidebar-scroll");
    expect(navigation).toContain("overflow-y-auto");
    expect(navigation).toContain('aria-label="Platform"');
    expect(header).toContain("shrink-0");
    expect(footer).toContain("shrink-0");
    expect(sidebar).toContain("h-dvh");
    expect(sidebar).toContain("w-56");
  });

  it("uses a single navigation configuration module", () => {
    const navigationModule = readComponent(
      "src/modules/platform-shell/navigation.ts",
    );
    const sidebar = readComponent(
      "src/components/platform/platform-sidebar.tsx",
    );
    const mobile = readComponent(
      "src/components/platform/mobile-platform-navigation.tsx",
    );

    expect(navigationModule).toContain("platformNavigation");
    expect(navigationModule).toContain("groupPlatformNavigation");
    expect(sidebar).not.toContain("platformNavigation:");
    expect(mobile).toContain("PlatformNavigation");
  });
});
