#!/usr/bin/env node
/**
 * Docs tooling: rasterise agent SVG avatars to 512×512 PNG.
 * Run from repo root: node agents/avatars/export-png.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(dir)).filter((f) => f.endsWith(".svg"));

for (const file of files) {
  const svgPath = join(dir, file);
  const pngPath = join(dir, file.replace(/\.svg$/, ".png"));
  const svg = await readFile(svgPath);
  const png = await sharp(svg, { density: 300 })
    .resize(512, 512)
    .png()
    .toBuffer();
  await writeFile(pngPath, png);
  console.log(`Wrote ${pngPath}`);
}
