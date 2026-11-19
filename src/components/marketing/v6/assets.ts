/**
 * v6 asset map (art direction §5.3). Every slot has a light and a dark file
 * in `public/marketing/v6/<slot>-<theme>.{avif,webp}`. Swapping in a
 * recapture is a file drop: sizes are read from the files before each build.
 */
import manifest from "./capture-manifest.json";

export type CaptureSlot = {
  /** Path under /public without the theme suffix and extension. */
  base: string;
  width: number;
  height: number;
  alt: string;
  /** Set when the dark file has a different size from the light one. */
  dark?: { width: number; height: number } | undefined;
  /** A smaller derivative `<base>-<theme>-<w>w.*` exists for each width. */
  widths?: readonly number[] | undefined;
};

type Size = { width: number; height: number };
const SIZES: Record<string, Size & { dark?: Size }> = manifest;

/** Intrinsic sizes come from the files (scripts/marketing-capture-manifest.mjs). */
const v6 = (
  slot: string,
  alt: string,
  widths?: readonly number[],
): CaptureSlot => {
  const size = SIZES[slot];
  if (!size) {
    throw new Error(`Missing landing capture: ${slot}`);
  }
  return {
    base: `/marketing/v6/${slot}`,
    width: size.width,
    height: size.height,
    dark: size.dark,
    alt,
    widths,
  };
};

export const CAPTURES = {
  heroPlanner: v6(
    "hero-planner",
    "The actions planner board with open, in-progress and completed actions.",
  ),
  heroPhone: v6(
    "hero-phone",
    "A Gemba walk on a phone with its summary, an issue observation and the recorded answer.",
  ),
  stepObserve: v6(
    "step-observe",
    "A completed Gemba walk with its summary, observations and answers.",
  ),
  stepSolve: v6(
    "step-solve",
    "A problem-solving case with its provisional why chain and fishbone analysis.",
  ),
  stepImprove: v6(
    "step-improve",
    "An improvement project charter with its problem statement, objective, baseline and target.",
  ),
  stepLearn: v6(
    "step-learn",
    "A published training course with its duration, validity, objectives and evidence requirements.",
  ),
  stepSolveM: v6(
    "step-solve-m",
    "A provisional why chain on a problem-solving case.",
  ),
  stepObserveM: v6(
    "step-observe-m",
    "A completed Gemba walk on a phone with its summary and observations.",
  ),
  actionDetailM: v6(
    "action-detail-m",
    "An action on a phone with owner, due date, linked source and status.",
  ),
  stepImproveM: v6(
    "step-improve-m",
    "An improvement project charter on a phone with its problem statement and objective.",
  ),
  stepLearnM: v6(
    "step-learn-m",
    "A published training course on a phone with its objectives.",
  ),
  tileActionsM: v6(
    "tile-actions-m",
    "The actions list on a phone, grouped by due date with owners and status.",
  ),
  actionDetail: v6(
    "action-detail",
    "An action opened over the actions list, with owner, due date, linked source and status.",
  ),
} as const satisfies Record<string, CaptureSlot>;

/**
 * Slots that are optional until their exports land. A missing file means the
 * layout renders without that layer; no placeholder is shown.
 */
const v6Optional = (slot: string, alt: string): CaptureSlot | null =>
  SIZES[slot] ? v6(slot, alt) : null;

export const OPTIONAL_CAPTURES = {
  leanaiProposals: v6Optional(
    "leanai-proposals",
    "Pending LeanAI proposals a person can accept, edit or reject.",
  ),
  heroKpi: v6Optional(
    "hero-kpi",
    "Operational analytics tiles for open actions, overdue actions and problem solving.",
  ),
  /** ATELIER r2: the actions list for the Act step, 2400x1500 from the top. */
  stepActList: v6Optional(
    "step-act-list",
    "The actions list grouped by due date with owners and status.",
  ),
  /** ATELIER r3 M3: the Act step's phone crop (~430 CSS @2x, open items
   * first); falls back to tile-actions-m until it lands. */
  stepActListM: v6Optional(
    "step-act-list-m",
    "Open actions on a phone, each with an owner, a due date and a status.",
  ),
  /** 390 px phone crop of the LeanAI proposals, shown alone below 768. */
  leanaiProposalsM: v6Optional(
    "leanai-proposals-m",
    "Pending LeanAI proposals on a phone, to accept, edit or reject.",
  ),
  tileGembaM: v6Optional(
    "tile-gemba-m",
    "A completed Gemba walk summary on a phone with observations and answers.",
  ),
  tile5sM: v6Optional(
    "tile-5s-m",
    "A 5S audit section on a phone with question scores and a linked action.",
  ),
  tileSuggestionsM: v6Optional(
    "tile-suggestions-m",
    "An implemented improvement idea on a phone with what was noticed and the proposed change.",
  ),
  tileTrainingM: v6Optional(
    "tile-training-m",
    "The training catalogue on a phone with published courses.",
  ),
  leanaiFrag: v6Optional(
    "leanai-panel-frag",
    "The LeanAI panel facilitating the current problem-solving stage.",
  ),
};

export type CaptureKey = keyof typeof CAPTURES;
