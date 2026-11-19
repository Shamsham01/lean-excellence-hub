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
    const sizes = manifest as Record<string, { width: number; height: number }>;
    const webps = readdirSync(dir).filter((f) =>
      /-(light|dark)\.webp$/.test(f),
    );
    expect(webps.length).toBeGreaterThan(0);
    for (const file of webps) {
      const slot = file.replace(/-(light|dark)\.webp$/, "");
      const size = webpSize(readFileSync(path.join(dir, file))) as {
        width: number;
        height: number;
      };
      expect(sizes[slot], file).toEqual(size);
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

  it("keeps only bento tiles whose capture fits a cell (≤3:1)", () => {
    for (const tile of BENTO_ROWS.flat()) {
      expect(tile.slot.width / tile.slot.height, tile.id).toBeLessThanOrEqual(
        3,
      );
    }
    expect(BENTO_ROWS.flat().map((tile) => tile.id)).not.toContain(
      "projects-benefits",
    );
  });
});
