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
  heroDashboard: v6(
    "hero-dashboard",
    "The platform home with items needing attention and operational analytics.",
  ),
  heroDashboardKpi: v6(
    "hero-dashboard-kpi",
    "Operational analytics tiles for open actions, overdue actions and problem solving.",
  ),
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
  stepAct: v6(
    "step-act",
    "The actions planner as a board with open, in-progress and completed actions.",
  ),
  stepSolve: v6(
    "step-solve",
    "A problem-solving case at root cause analysis with LeanAI proposals to accept, edit or reject.",
  ),
  stepImprove: v6(
    "step-improve",
    "An improvement project charter with its problem statement, objective, baseline and target.",
  ),
  stepLearn: v6(
    "step-learn",
    "A published training course with its duration, validity, objectives and evidence requirements.",
  ),
  stepObserveM: v6(
    "step-observe-m",
    "A Gemba walk on a phone with its summary and an issue observation.",
  ),
  stepActM: v6(
    "step-act-m",
    "Open actions on the planner board with owners and due dates.",
  ),
  stepSolveM: v6(
    "step-solve-m",
    "Cause analysis with a pending LeanAI proposal to accept, edit or reject.",
  ),
  stepImproveM: v6(
    "step-improve-m",
    "A project charter with its problem statement and objective.",
  ),
  stepLearnM: v6(
    "step-learn-m",
    "A published course version with its duration, validity and objectives.",
  ),
  actionDetail: v6(
    "action-detail",
    "The actions list with owners, due dates and status for each action.",
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
  tilePps: v6(
    "tile-pps",
    "A problem-solving case with its why chain and fishbone analysis.",
  ),
  tileProjects: v6(
    "tile-projects",
    "A project charter with its problem statement and objective.",
  ),
  tileTraining: v6(
    "tile-training",
    "The training catalogue with published courses.",
  ),
  tileSkills: v6(
    "tile-training-skills",
    "The skills catalogue with categories for each skill.",
  ),
  leanaiPanel: v6(
    "leanai-panel",
    "LeanAI facilitating cause analysis next to pending proposals a person can accept, edit or reject.",
  ),
} as const satisfies Record<string, CaptureSlot>;

export type CaptureKey = keyof typeof CAPTURES;
