export function answerProgressPercent(answered: number, total: number): number {
  if (total <= 0) {
    return 100;
  }
  if (answered >= total) {
    return 100;
  }
  return Math.floor((answered / total) * 100);
}
