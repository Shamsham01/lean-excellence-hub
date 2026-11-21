#!/usr/bin/env node
/**
 * Writes the intrinsic size of every landing capture in public/marketing/v6
 * to src/components/marketing/v6/capture-manifest.json, read from the WebP
 * files themselves. Runs before `next build`, so dropping in a recaptured
 * <slot>-<theme>.webp/.avif pair needs no code change.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const dir = path.join(root, "public/marketing/v6");
const out = path.join(
  root,
  "src/components/marketing/v6/capture-manifest.json",
);

export function webpSize(buf) {
  if (
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error("not a WebP file");
  }
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 ") {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
  }
  throw new Error(`unknown WebP chunk ${chunk}`);
}

// The light file sets a slot's size. A dark file of a different size (a
// phone crop whose themes could not share one box) is recorded as `dark`.
const sizes = {};
for (const file of fs.readdirSync(dir).sort()) {
  const match = /^(.+)-(light|dark)\.webp$/.exec(file);
  if (!match) {
    continue;
  }
  const [, slot, theme] = match;
  sizes[slot] ??= {};
  sizes[slot][theme] = webpSize(fs.readFileSync(path.join(dir, file)));
}
const manifest = {};
for (const [slot, { light, dark }] of Object.entries(sizes)) {
  if (!light || !dark) {
    throw new Error(`${slot}: needs both a light and a dark file`);
  }
  manifest[slot] =
    light.width === dark.width && light.height === dark.height
      ? light
      : { ...light, dark };
}

const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== json) {
  fs.writeFileSync(out, json);
  console.log(
    `capture manifest: ${Object.keys(manifest).length} slots written`,
  );
}
