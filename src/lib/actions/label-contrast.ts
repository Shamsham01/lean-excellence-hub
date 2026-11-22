function parseHexChannel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(index, index + 2), 16);
}

function relativeLuminance(hexColor: string): number | null {
  const hex = hexColor.replace("#", "").trim();
  if (hex.length !== 6) return null;
  const r = parseHexChannel(hex, 0) / 255;
  const g = parseHexChannel(hex, 2) / 255;
  const b = parseHexChannel(hex, 4) / 255;
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Picks black or white chip text (~4.58:1 min); black when L > 0.179. */
export function labelChipTextClass(
  hexColor: string,
): "text-white" | "text-black" {
  const luminance = relativeLuminance(hexColor);
  if (luminance == null) return "text-white";
  return luminance > 0.179 ? "text-black" : "text-white";
}
