import { PILLARS, SCORE_MAX } from "./content";

const SIZE = 480;
const CENTRE = SIZE / 2;
const RADIUS = 150;
const LABEL_GAP = 22;

function point(index: number, value: number) {
  const angle = ((-90 + index * 72) * Math.PI) / 180;
  const r = (value / SCORE_MAX) * RADIUS;
  return [CENTRE + r * Math.cos(angle), CENTRE + r * Math.sin(angle)] as const;
}

function ring(level: number) {
  return PILLARS.map((_, i) => point(i, level).join(",")).join(" ");
}

/** Split a pillar name over at most two balanced lines. */
function labelLines(name: string): string[] {
  const words = name.split(" ");
  if (words.length < 3) {
    return [name];
  }
  let best = [name];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [a, b];
    }
  }
  return best;
}

/**
 * Pillar maturity radar drawn in code (art direction §6.5): a regular
 * pentagon, five level rings, real values and an accessible table.
 */
export function MaturityRadar() {
  const polygon = PILLARS.map((p, i) => point(i, p.score).join(",")).join(" ");

  return (
    <div className="v6-radar">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Pillar maturity radar"
        className="v6-radar-svg"
      >
        <g className="v6-radar-grid">
          {[1, 2, 3, 4, 5].map((level) => (
            <polygon key={level} points={ring(level)} />
          ))}
          {PILLARS.map((p, i) => {
            const [x, y] = point(i, SCORE_MAX);
            return <line key={p.name} x1={CENTRE} y1={CENTRE} x2={x} y2={y} />;
          })}
        </g>
        <g
          className="v6-radar-shape"
          style={{ transformOrigin: `${CENTRE}px ${CENTRE}px` }}
        >
          <polygon points={polygon} className="v6-radar-area" />
          {PILLARS.map((p, i) => {
            const [x, y] = point(i, p.score);
            return (
              <circle
                key={p.name}
                cx={x}
                cy={y}
                r={4}
                className="v6-radar-dot"
              />
            );
          })}
        </g>
        <g className="v6-radar-labels" aria-hidden="true">
          {PILLARS.map((p, i) => {
            const angle = -90 + i * 72;
            const rad = (angle * Math.PI) / 180;
            const r = RADIUS + LABEL_GAP;
            const x = CENTRE + r * Math.cos(rad);
            const y = CENTRE + r * Math.sin(rad);
            const cos = Math.cos(rad);
            const anchor =
              Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
            const lines = labelLines(p.name);
            const top = i === 0;
            const bottom = Math.sin(rad) > 0.5;
            const dy0 = top
              ? -(lines.length - 1) * 17 - 4
              : bottom
                ? 14
                : -((lines.length - 1) * 17) / 2 + 5;
            return (
              <text key={p.name} x={x} y={y} textAnchor={anchor}>
                {lines.map((line, li) => (
                  <tspan key={line} x={x} dy={li === 0 ? dy0 : 17}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </g>
      </svg>
      <table className="sr-only">
        <caption>Pillar maturity scores out of 5</caption>
        <tbody>
          {PILLARS.map((p) => (
            <tr key={p.name}>
              <th scope="row">{p.name}</th>
              <td>{p.score.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
