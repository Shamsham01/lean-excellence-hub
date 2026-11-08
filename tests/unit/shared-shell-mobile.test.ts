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

    expect(mobile).toContain("sticky top-0 z-50");
    expect(mobile).toContain("platform-mobile-command-trigger");
    expect(mobile).toContain('data-testid="platform-mobile-chrome"');
    expect(mobile).toContain("min-w-0 flex-1 truncate");
    expect(mobile).toContain('aria-label="Platform"');
    expect(mobile).toContain('role="navigation"');
  });

  it("keeps the platform shell root and main workspace within the viewport width", () => {
    const shell = readComponent("src/components/platform/platform-shell.tsx");

    expect(shell).toContain("h-dvh max-h-dvh min-w-0 flex-col overflow-hidden");
    expect(shell).toContain("lg:flex-row");
    // Main column locks vertical overflow; nested platform-main-viewport scrolls.
    expect(shell).toContain('data-testid="platform-main"');
    expect(shell).toContain(
      "min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden",
    );
    expect(shell).toContain("platform-main-viewport");
    expect(shell).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain",
    );
    expect(shell).toContain("platform-main-inner");
    expect(shell).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background lg:ml-[290px]",
    );
    expect(shell).toContain("MobilePlatformNavigation");
    expect(shell).toContain("PlatformTopbar");
  });

  it("enables touch pan-y on the mobile main viewport scroller", () => {
    const globals = readComponent("src/app/globals.css");

    expect(globals).toContain(".platform-main-viewport");
    expect(globals).toContain("touch-action: pan-y");
    expect(globals).toContain("-webkit-overflow-scrolling: touch");
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
