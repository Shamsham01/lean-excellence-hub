export type TrendDelta = {
  current: number;
  previous: number;
  percent: number | null;
  direction: "up" | "down" | "flat";
};

export function comparePeriods(current: number, previous: number): TrendDelta {
  if (previous === 0) {
    if (current === 0) {
      return { current, previous, percent: 0, direction: "flat" };
    }
    return { current, previous, percent: null, direction: "up" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    current,
    previous,
    percent,
    direction: percent > 0 ? "up" : percent < 0 ? "down" : ("flat" as const),
  };
}

export function bucketDailyCounts(
  timestamps: string[],
  range: { start: string; end: string; days: number },
): Array<{ label: string; value: number }> {
  const bucketCount = Math.min(range.days, 14);
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const step = (endMs - startMs) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: bucketCount <= 7 ? `Day ${index + 1}` : `Wk ${index + 1}`,
    value: 0,
  }));

  for (const ts of timestamps) {
    const ms = new Date(ts).getTime();
    if (ms < startMs || ms > endMs) continue;
    const index = Math.min(bucketCount - 1, Math.floor((ms - startMs) / step));
    buckets[index]!.value += 1;
  }

  return buckets;
}
