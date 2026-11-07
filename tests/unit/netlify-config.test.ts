import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("netlify.toml", () => {
  it("uses the Next.js runtime instead of a static SPA publish directory", () => {
    const source = readFileSync("netlify.toml", "utf8");
    expect(source).toContain("@netlify/plugin-nextjs");
    expect(source).toContain('command = "npm run build"');
    expect(source).not.toMatch(/publish\s*=\s*["']\.next["']/);
    expect(source).not.toMatch(/to\s*=\s*["']\/index\.html["']/);
  });
});
