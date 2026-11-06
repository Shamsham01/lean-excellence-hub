/** Vertical slack so a max-height dialog does not touch the screen edge. */
export const DIALOG_VIEWPORT_GUTTER_PX = 32;

export type DialogVisibleFrameInput = {
  visualHeight: number;
  visualOffsetTop: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  gutter?: number;
};

export type DialogVisibleFrame = {
  maxHeight: number;
  top: number;
};

/**
 * Centre a dialog in the visual viewport and cap its height so it stays
 * inside that viewport. `visualOffsetTop` follows the on-screen keyboard:
 * fixed positioning is relative to the layout viewport, while the visible
 * area moves within it.
 */
export function dialogVisibleFrame(
  input: DialogVisibleFrameInput,
): DialogVisibleFrame {
  const gutter = input.gutter ?? DIALOG_VIEWPORT_GUTTER_PX;
  const safeTop = finiteInset(input.safeAreaTop);
  const safeBottom = finiteInset(input.safeAreaBottom);
  const visualHeight = Math.max(0, input.visualHeight);
  const safeSpan = Math.max(0, visualHeight - safeTop - safeBottom);
  return {
    maxHeight: Math.max(0, safeSpan - gutter),
    top: input.visualOffsetTop + safeTop + safeSpan / 2,
  };
}

function finiteInset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}
