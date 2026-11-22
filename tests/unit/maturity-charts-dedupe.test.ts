import { describe, expect, it } from "vitest";

import { dedupePillarScores } from "@/components/maturity/pillar-scores-dedupe";

describe("dedupePillarScores", () => {
  it("keeps one row per normalised name with the higher score", () => {
    const data = [
      { name: "Daily Management", score: 3.2 },
      { name: " Daily management ", score: 2.1 },
      { name: "Leadership", score: 4 },
    ];
    const rows = dedupePillarScores(data);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.name.includes("Daily Management"))?.score).toBe(
      3.2,
    );
  });
});
