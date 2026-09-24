import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readComponent(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("shared platform shell mobile layout", () => {
  it("constrains mobile chrome so organisation context truncates instead of overflowing", () => {
    const mobile = readComponent(
      "src/components/platform/mobile-platform-navigation.tsx",
    );

    expect(mobile).toContain("sticky top-0 z-40");
    expect(mobile).toContain('data-testid="platform-mobile-chrome"');
    expect(mobile).toContain("min-w-0 flex-1 truncate");
  });

  it("keeps the platform shell root and main workspace within the viewport width", () => {
    const shell = readComponent("src/components/platform/platform-shell.tsx");

    expect(shell).toContain("min-h-dvh min-w-0 flex-col");
    expect(shell).toContain("lg:h-dvh lg:flex-row lg:overflow-hidden");
    expect(shell).toContain(
      "min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:overflow-y-auto",
    );
  });

  it("allows page header actions to wrap on narrow viewports", () => {
    const header = readComponent("src/components/platform/page-header.tsx");

    expect(header).toContain("w-full min-w-0 flex-wrap");
    expect(header).toContain("sm:w-auto");
    expect(header).toContain("[&>*]:min-w-0");
  });
});

describe("shared Tabs mobile layout", () => {
  it("uses a width-constrained horizontally scrollable tab list", () => {
    const tabs = readComponent("src/components/ui/tabs.tsx");

    expect(tabs).toContain("tabs-scroll");
    expect(tabs).toContain("overflow-x-auto");
    expect(tabs).toContain("overscroll-x-contain");
    expect(tabs).toContain("shrink-0");
    expect(tabs).toContain("scrollIntoView");
    expect(tabs).not.toContain("scrollbar-width:none");
    expect(tabs).not.toContain("[&::-webkit-scrollbar]:hidden");
    expect(tabs).not.toContain("inline-flex h-10");
  });
});
