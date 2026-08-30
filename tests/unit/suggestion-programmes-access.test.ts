import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("suggestion programmes page access", () => {
  it("requires suggestions.programmes.manage permission before loading data", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/app/(platform)/platform/suggestions/programmes/page.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("suggestions.programmes.manage");
    expect(source).toContain(
      "Programme management is not available for your role.",
    );
  });
});
