import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PlatformSidebar desktop layout", () => {
  it("pins the desktop sidebar while main content scrolls", () => {
    const source = readFileSync(
      "src/components/platform/platform-sidebar.tsx",
      "utf8",
    );

    expect(source).toContain("lg:sticky");
    expect(source).toContain("lg:top-0");
    expect(source).toContain("lg:self-start");
  });
});
