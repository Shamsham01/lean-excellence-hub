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
  /** A smaller derivative `<base>-<theme>-<w>w.*` exists for each width. */
  widths?: readonly number[] | undefined;
};

const SIZES: Record<string, { width: number; height: number }> = manifest;

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
  tileGemba: v6(
    "tile-gemba",
    "A completed Gemba walk summary with observations and answers.",
  ),
  tile5s: v6(
    "tile-5s",
    "A 5S audit section with question scores and a linked action.",
  ),
  tileSuggestions: v6(
    "tile-suggestions",
    "An implemented improvement idea with what was noticed, the proposed change and the expected benefit.",
  ),
  tileActions: v6(
    "tile-actions",
    "The actions list grouped by due date with owners and status.",
  ),
  tileTraining: v6(
    "tile-training",
    "The training catalogue with published courses.",
  ),
  tileSkills: v6(
    "tile-training-skills",
    "The skills catalogue with categories for each skill.",
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
  leanaiFrag: v6Optional(
    "leanai-panel-frag",
    "The LeanAI panel facilitating the current problem-solving stage.",
  ),
};

export type CaptureKey = keyof typeof CAPTURES;
