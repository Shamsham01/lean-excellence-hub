import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/components/marketing/v6/capture-manifest.json";
import { CAPTURES } from "@/components/marketing/v6/assets";
import { BENTO_ROWS } from "@/components/marketing/v6/content";
// @ts-expect-error -- plain ESM build script without type declarations
import { webpSize } from "../../scripts/marketing-capture-manifest.mjs";

const dir = path.join(process.cwd(), "public/marketing/v6");

describe("landing capture manifest", () => {
  it("matches the intrinsic size of every capture file", () => {
    type Size = { width: number; height: number };
    const sizes = manifest as Record<string, Size & { dark?: Size }>;
    const webps = readdirSync(dir).filter((f) =>
      /-(light|dark)\.webp$/.test(f),
    );
    expect(webps.length).toBeGreaterThan(0);
    for (const file of webps) {
      const slot = file.replace(/-(light|dark)\.webp$/, "");
      const size = webpSize(readFileSync(path.join(dir, file))) as Size;
      const entry = sizes[slot];
      const expected =
        file.endsWith("-dark.webp") && entry?.dark
          ? entry.dark
          : { width: entry?.width, height: entry?.height };
      expect(expected, file).toEqual(size);
    }
  });

  it("ships a light and a dark AVIF + WebP for every slot in use", () => {
    for (const capture of Object.values(CAPTURES)) {
      for (const theme of ["light", "dark"]) {
        for (const ext of ["avif", "webp"]) {
          const file = path.join(
            process.cwd(),
            "public",
            `${capture.base}-${theme}.${ext}`,
          );
          expect(existsSync(file), file).toBe(true);
        }
      }
    }
  });

  it("lays the bento out as Gemba | 5S, then Suggestions | Training & Skills", () => {
    expect(BENTO_ROWS.map((row) => row.map((tile) => tile.id))).toEqual([
      ["gemba", "five-s"],
      ["suggestions", "training-skills"],
    ]);
    expect(manifest).not.toHaveProperty("tile-pps");
  });

  it("gives every bento tile a phone capture or no capture at all (r2 N1)", () => {
    for (const tile of BENTO_ROWS.flat()) {
      if (tile.slot) {
        // 390 px @2x phone captures only; never a desktop capture.
        expect(tile.slot.width, tile.id).toBeLessThanOrEqual(800);
        expect(tile.slot.base, tile.id).toMatch(/-m$/);
      }
    }
  });
});
