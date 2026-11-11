import { describe, expect, it } from "vitest";

import { labelChipTextClass } from "@/lib/actions/label-contrast";

describe("labelChipTextClass", () => {
  it("picks black text on light label colours", () => {
    expect(labelChipTextClass("#F5F5F5")).toBe("text-black");
    expect(labelChipTextClass("#FFFF00")).toBe("text-black");
  });

  it("picks white text on dark label colours", () => {
    expect(labelChipTextClass("#0058FD")).toBe("text-white");
    expect(labelChipTextClass("#1a1a1a")).toBe("text-white");
  });
});
