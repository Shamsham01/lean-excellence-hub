#!/usr/bin/env node
/** One-time / regen helper for abstract agent avatars. */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const S = 512;

function svg(name, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="${name} agent mark">
  <rect width="${S}" height="${S}" fill="#0a0a0a"/>
${body}
</svg>`;
}

const agents = {
  atlas: svg(
    "ATLAS",
    `
  <circle cx="256" cy="256" r="200" fill="none" stroke="#C9A227" stroke-width="3" opacity="0.35"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#C9A227" stroke-width="2" opacity="0.55"/>
  <path d="M256 56 L256 456 M56 256 L456 256" stroke="#0B1F3A" stroke-width="48" stroke-linecap="round"/>
  <path d="M256 96 L376 256 L256 416 L136 256 Z" fill="#0B1F3A" stroke="#C9A227" stroke-width="4"/>
  <circle cx="256" cy="256" r="28" fill="#C9A227"/>
`,
  ),
  forge: svg(
    "FORGE",
    `
  <polygon points="256,72 416,184 416,328 256,440 96,328 96,184" fill="#5C6778" stroke="#B87333" stroke-width="6"/>
  <polygon points="256,120 368,200 368,312 256,392 144,312 144,200" fill="none" stroke="#B87333" stroke-width="3"/>
  <line x1="256" y1="120" x2="256" y2="392" stroke="#B87333" stroke-width="2" opacity="0.6"/>
  <line x1="144" y1="200" x2="368" y2="312" stroke="#B87333" stroke-width="2" opacity="0.4"/>
  <line x1="368" y1="200" x2="144" y2="312" stroke="#B87333" stroke-width="2" opacity="0.4"/>
`,
  ),
  nexus: svg(
    "NEXUS",
    `
  <g stroke="#38BDF8" stroke-width="2" opacity="0.5">
    <line x1="120" y1="180" x2="392" y2="220"/><line x1="140" y1="320" x2="380" y2="140"/>
    <line x1="256" y1="80" x2="256" y2="432"/><line x1="80" y1="256" x2="432" y2="256"/>
  </g>
  <circle cx="256" cy="256" r="12" fill="#2563EB"/>
  <circle cx="140" cy="180" r="18" fill="#2563EB"/><circle cx="372" cy="200" r="14" fill="#38BDF8"/>
  <circle cx="180" cy="340" r="16" fill="#2563EB"/><circle cx="360" cy="320" r="20" fill="#38BDF8"/>
  <circle cx="256" cy="120" r="10" fill="#38BDF8"/><circle cx="256" cy="390" r="10" fill="#38BDF8"/>
`,
  ),
  sentinel: svg(
    "SENTINEL",
    `
  <path d="M256 64 L420 160 V280 C420 360 256 448 256 448 C256 448 92 360 92 280 V160 Z" fill="#0F172A" stroke="#059669" stroke-width="5"/>
  <path d="M256 120 L360 190 V270 C360 320 256 380 256 380 C256 380 152 320 152 270 V190 Z" fill="none" stroke="#059669" stroke-width="3"/>
  <path d="M200 240 L240 280 L320 200" fill="none" stroke="#34D399" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
`,
  ),
  pulse: svg(
    "PULSE",
    `
  <rect x="64" y="240" width="32" height="160" rx="8" fill="#F59E0B"/>
  <rect x="112" y="200" width="32" height="200" rx="8" fill="#FBBF24"/>
  <rect x="160" y="160" width="32" height="240" rx="8" fill="#F59E0B"/>
  <rect x="208" y="120" width="32" height="280" rx="8" fill="#FDE68A"/>
  <rect x="256" y="180" width="32" height="220" rx="8" fill="#F59E0B"/>
  <rect x="304" y="140" width="32" height="260" rx="8" fill="#FBBF24"/>
  <rect x="352" y="200" width="32" height="200" rx="8" fill="#F59E0B"/>
  <rect x="400" y="220" width="32" height="180" rx="8" fill="#1C1917" stroke="#F59E0B" stroke-width="2"/>
  <line x1="64" y1="256" x2="448" y2="256" stroke="#1C1917" stroke-width="4"/>
`,
  ),
  verify: svg(
    "VERIFY",
    `
  <rect x="96" y="96" width="320" height="320" rx="48" fill="#0D9488" opacity="0.25"/>
  <circle cx="256" cy="256" r="160" fill="none" stroke="#5EEAD4" stroke-width="8"/>
  <path d="M170 256 L230 316 L350 196" fill="none" stroke="#5EEAD4" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
`,
  ),
  kaizen: svg(
    "KAIZEN",
    `
  <circle cx="256" cy="256" r="168" fill="none" stroke="#16A34A" stroke-width="10"/>
  <path d="M256 88 A168 168 0 1 1 180 360" fill="none" stroke="#84CC16" stroke-width="14" stroke-linecap="round"/>
  <polygon points="256,140 296,220 376,220 312,272 336,352 256,304 176,352 200,272 136,220 216,220" fill="#16A34A" opacity="0.85"/>
`,
  ),
  pixel: svg(
    "PIXEL",
    `
  <g fill="#7C3AED">
    <rect x="128" y="128" width="64" height="64"/><rect x="192" y="128" width="64" height="64" fill="#C4B5FD"/>
    <rect x="256" y="128" width="64" height="64"/><rect x="320" y="128" width="64" height="64" fill="#C4B5FD"/>
    <rect x="128" y="192" width="64" height="64" fill="#C4B5FD"/><rect x="192" y="192" width="64" height="64"/>
    <rect x="256" y="192" width="64" height="64" fill="#C4B5FD"/><rect x="320" y="192" width="64" height="64"/>
    <rect x="128" y="256" width="64" height="64"/><rect x="192" y="256" width="64" height="64" fill="#C4B5FD"/>
    <rect x="256" y="256" width="64" height="64"/><rect x="320" y="256" width="64" height="64"/>
    <rect x="128" y="320" width="64" height="64" fill="#C4B5FD"/><rect x="192" y="320" width="64" height="64"/>
    <rect x="256" y="320" width="64" height="64" fill="#C4B5FD"/><rect x="320" y="320" width="64" height="64"/>
  </g>
`,
  ),
  talent: svg(
    "TALENT",
    `
  <circle cx="256" cy="200" r="48" fill="#14B8A6"/>
  <circle cx="160" cy="320" r="40" fill="#0F766E"/>
  <circle cx="352" cy="320" r="40" fill="#0F766E"/>
  <circle cx="256" cy="360" r="36" fill="#5EEAD4"/>
  <line x1="256" y1="248" x2="256" y2="324" stroke="#14B8A6" stroke-width="6"/>
  <line x1="220" y1="230" x2="176" y2="290" stroke="#14B8A6" stroke-width="5"/>
  <line x1="292" y1="230" x2="336" y2="290" stroke="#14B8A6" stroke-width="5"/>
  <line x1="190" y1="340" x2="230" y2="340" stroke="#0F766E" stroke-width="4"/>
  <line x1="282" y1="340" x2="322" y2="340" stroke="#0F766E" stroke-width="4"/>
`,
  ),
  connect: svg(
    "CONNECT",
    `
  <circle cx="120" cy="256" r="36" fill="#06B6D4"/>
  <circle cx="256" cy="120" r="36" fill="#0284C7"/>
  <circle cx="392" cy="256" r="36" fill="#06B6D4"/>
  <circle cx="256" cy="392" r="36" fill="#0284C7"/>
  <circle cx="256" cy="256" r="44" fill="#0284C7" stroke="#06B6D4" stroke-width="6"/>
  <line x1="150" y1="256" x2="212" y2="256" stroke="#06B6D4" stroke-width="8"/>
  <line x1="300" y1="256" x2="362" y2="256" stroke="#06B6D4" stroke-width="8"/>
  <line x1="256" y1="150" x2="256" y2="212" stroke="#0284C7" stroke-width="8"/>
  <line x1="256" y1="300" x2="256" y2="362" stroke="#0284C7" stroke-width="8"/>
`,
  ),
  launch: svg(
    "LAUNCH",
    `
  <polygon points="256,80 320,360 256,320 192,360" fill="#EAB308"/>
  <rect x="232" y="320" width="48" height="120" rx="8" fill="#CA8A04"/>
  <path d="M180 400 Q256 440 332 400" fill="none" stroke="#FDE047" stroke-width="12" stroke-linecap="round"/>
  <circle cx="256" cy="200" r="24" fill="#FDE047" opacity="0.9"/>
`,
  ),
};

for (const [slug, content] of Object.entries(agents)) {
  await writeFile(join(dir, `${slug}.svg`), content.trim() + "\n");
  console.log(`Wrote ${slug}.svg`);
}
