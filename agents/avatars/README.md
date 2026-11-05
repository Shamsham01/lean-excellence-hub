# Agent avatars

| Agent | Palette | Motif |
| --- | --- | --- |
| ATLAS | Navy `#0B1F3A`, gold `#C9A227` | Command arcs / compass segments |
| FORGE | Copper `#B87333`, steel `#5C6778` | Faceted geometry |
| NEXUS | Electric blue `#2563EB`, cyan `#38BDF8` | Neural nodes |
| SENTINEL | Emerald `#059669`, slate `#0F172A` | Shield lattice |
| PULSE | Amber `#F59E0B`, charcoal `#1C1917` | Waveform bars |
| VERIFY | Teal `#0D9488`, mint `#5EEAD4` | Check geometry |
| KAIZEN | Green `#16A34A`, lime `#84CC16` | Improvement cycle |
| PIXEL | Violet `#7C3AED`, lavender `#C4B5FD` | Pixel grid |
| TALENT | Turquoise `#14B8A6`, deep `#0F766E` | Connected nodes |
| CONNECT | Cyan `#06B6D4`, blue `#0284C7` | Path network |
| LAUNCH | Gold `#EAB308`, rocket trail `#FDE047` | Ascending vectors |

## PNG export

SVG is the source of truth. PNG is optional for slides or dashboards.

From the repository root:

```bash
node agents/avatars/export-png.mjs
```

The script uses [sharp](https://sharp.pixelplumbing.com/) to rasterise each `agents/avatars/*.svg` to a matching `*.png` at 512×512.

If `sharp` is missing: `npm ci` (or `npm install`) in the repo root first.

Alternative (ImageMagick, if installed):

```bash
for f in agents/avatars/*.svg; do
  convert -background none -density 300 "$f" "${f%.svg}.png"
done
```
