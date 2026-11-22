export type PillarScoreRow = {
  name: string;
  score: number;
};

/**
 * Collapse duplicate pillar labels (case/whitespace) and keep the higher score
 * so radar and list stay aligned.
 */
export function dedupePillarScores(data: PillarScoreRow[]): PillarScoreRow[] {
  const byName = new Map<string, PillarScoreRow>();
  for (const row of data) {
    const key = row.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing || row.score > existing.score) {
      byName.set(key, row);
    }
  }
  return [...byName.values()];
}
