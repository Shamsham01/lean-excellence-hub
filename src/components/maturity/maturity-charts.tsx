"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

type PillarScore = {
  name: string;
  score: number;
};

export function MaturityRadarChart({ data }: { data: PillarScore[] }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label="Pillar maturity radar chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
      <table className="sr-only mt-4 w-full text-sm">
        <caption>Pillar scores</caption>
        <thead>
          <tr>
            <th>Pillar</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PillarScoreList({ data }: { data: PillarScore[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {data.map((pillar) => (
        <li
          key={pillar.name}
          className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2"
        >
          <span className="text-sm text-foreground">{pillar.name}</span>
          <span className="font-mono text-sm text-foreground tabular-nums">
            {pillar.score.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
