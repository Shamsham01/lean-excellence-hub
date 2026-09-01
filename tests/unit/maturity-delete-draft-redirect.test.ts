import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("maturity delete draft redirect", () => {
  const source = readFileSync(
    "src/app/(platform)/platform/maturity/models/[modelId]/page.tsx",
    "utf8",
  );

  const deleteDraftActionSource = (() => {
    const start = source.indexOf("async function deleteDraftAction");
    const end = source.indexOf("\n  return (", start);
    return source.slice(start, end);
  })();

  it("redirects to the framework list after a successful delete", () => {
    expect(deleteDraftActionSource).toContain("deleteDraftVersion");
    expect(deleteDraftActionSource).toContain(
      'redirect("/platform/maturity/models")',
    );
  });

  it("does not redirect when deleteDraftVersion returns an error", () => {
    expect(deleteDraftActionSource).toMatch(/if\s*\(\s*result\?\.error\s*\)/);
    expect(deleteDraftActionSource.indexOf("result?.error")).toBeLessThan(
      deleteDraftActionSource.indexOf("redirect("),
    );
  });
});
