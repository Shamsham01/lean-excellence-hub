import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("platform sidebar mobile scroll", () => {
  it("uses independently scrollable navigation in the mobile drawer", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/platform/platform-sidebar.tsx"),
      "utf8",
    );

    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("min-h-0");
    expect(source).toContain("overflow-hidden");
  });
});
