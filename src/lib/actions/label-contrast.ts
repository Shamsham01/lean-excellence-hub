function parseHexChannel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(index, index + 2), 16);
}

/** Relative luminance for sRGB hex (#RRGGBB); picks black or white for ~4.5:1 text. */
export function labelChipTextClass(
  hexColor: string,
): "text-white" | "text-black" {
  const hex = hexColor.replace("#", "").trim();
  if (hex.length !== 6) return "text-white";
  const r = parseHexChannel(hex, 0) / 255;
  const g = parseHexChannel(hex, 2) / 255;
  const b = parseHexChannel(hex, 4) / 255;
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.4 ? "text-black" : "text-white";
}
