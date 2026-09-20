import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("maturity official result navigation", () => {
  const source = readFileSync(
    "src/app/(platform)/platform/maturity/results/[id]/page.tsx",
    "utf8",
  );

  it("uses AppLink for Back to overview", () => {
    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('href="/platform/maturity"');
    expect(source).toContain('data-testid="maturity-result-back-link"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });
});
