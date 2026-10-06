/** Scroll-progress helpers for the public homepage. Pure and reversible. */

export function clampProgress(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value === 0 ? 0 : value;
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin = 0,
  outMax = 1,
) {
  const span = inMax - inMin;

  if (span === 0) {
    return outMin;
  }

  const t = clampProgress((value - inMin) / span);
  return outMin + (outMax - outMin) * t;
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function easeOutCubic(amount: number) {
  const t = clampProgress(amount);
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(amount: number) {
  const t = clampProgress(amount);

  if (t < 0.5) {
    return 4 * t * t * t;
  }

  return 1 - (-2 * t + 2) ** 3 / 2;
}

/** A short settle used for the connected-loop cascade. Ends at rest. */
export function easeKnock(amount: number) {
  const t = clampProgress(amount);

  if (t === 0 || t === 1) {
    return t;
  }

  const settled = 1 - (1 - t) ** 3;
  return settled + Math.sin(t * Math.PI) * 0.045;
}

/**
 * Progress of a tall scene whose stage sticks while the section scrolls.
 * `top` is the section's viewport top. 0 is the first frame, 1 the last.
 */
export function sceneProgress(top: number, height: number, viewport: number) {
  const scrollable = height - viewport;

  if (scrollable <= 0) {
    return 1;
  }

  return clampProgress(-top / scrollable);
}
