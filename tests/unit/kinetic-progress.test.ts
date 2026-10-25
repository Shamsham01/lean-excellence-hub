import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("editorial homepage motion", () => {
  const css = readFileSync(
    "src/components/marketing/editorial/home.css",
    "utf8",
  );
  const source = readFileSync(
    "src/components/marketing/editorial/home.tsx",
    "utf8",
  );

  it("scrolls as a normal document instead of scrubbing pinned scenes", () => {
    expect(css).not.toMatch(/scroll-timeline|animation-timeline|lenis|gsap/i);
    expect(css).not.toMatch(/height:\s*\d+vh/);
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(source).not.toContain("data-kinetic");
    expect(source).not.toContain("KineticRoot");
    expect(source).toContain('href="#platform"');
    expect(source).toContain('href="/signup"');
  });

  it("opts into short entrance motion and removes it for reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/animation: none/);
    expect(css).toContain("@keyframes editorial-rise");
  });
});
