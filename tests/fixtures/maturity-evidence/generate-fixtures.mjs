import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
mkdirSync(directory, { recursive: true });

// 1x1 PNG (valid image/jpeg substitute uses PNG magic bytes)
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
writeFileSync(join(directory, "sample.png"), Buffer.from(pngBase64, "base64"));

writeFileSync(
  join(directory, "sample.txt"),
  "CookieWorks MAT0 evidence fixture — plain text document.",
);
