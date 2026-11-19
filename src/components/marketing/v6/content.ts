/** Landing copy (published page main@b1bd423, edited per art direction §6). */
import { CAPTURES, type CaptureSlot } from "./assets";

export type ThreadStep = {
  id: "observe" | "act" | "solve" | "improve" | "learn";
  index: string;
  title: string;
  module: string;
  desktop: CaptureSlot;
  mobile: CaptureSlot;
};

export const THREAD_STEPS: readonly ThreadStep[] = [
  {
    id: "observe",
    index: "01",
    title: "Observe",
    module: "Gemba",
    desktop: CAPTURES.stepObserve,
    mobile: CAPTURES.stepObserveM,
  },
  {
    id: "act",
    index: "02",
    title: "Act",
    module: "Actions",
    desktop: CAPTURES.stepAct,
    mobile: CAPTURES.stepActM,
  },
  {
    id: "solve",
    index: "03",
    title: "Solve",
    module: "Problem solving",
    desktop: CAPTURES.stepSolve,
    mobile: CAPTURES.stepSolveM,
  },
  {
    id: "improve",
    index: "04",
    title: "Improve",
    module: "Projects & Benefits",
    desktop: CAPTURES.stepImprove,
    mobile: CAPTURES.stepImproveM,
  },
  {
    id: "learn",
    index: "05",
    title: "Learn",
    module: "Standards & skills",
    desktop: CAPTURES.stepLearn,
    mobile: CAPTURES.stepLearnM,
  },
];

export type BentoTile = {
  id: string;
  name: string;
  line: string;
  slot: CaptureSlot;
  /** Second window offset behind the first (Training & Skills). */
  back?: CaptureSlot;
};

export const BENTO_ROWS: readonly (readonly BentoTile[])[] = [
  [
    {
      id: "gemba",
      name: "Gemba",
      line: "See the work where it happens.",
      slot: CAPTURES.tileGemba,
    },
    {
      id: "five-s",
      name: "5S",
      line: "Turn standards into repeatable practice.",
      slot: CAPTURES.tile5s,
    },
  ],
  [
    {
      id: "suggestions",
      name: "Suggestions",
      line: "Turn frontline ideas into visible decisions.",
      slot: CAPTURES.tileSuggestions,
    },
    {
      id: "actions",
      name: "Actions",
      line: "One accountable action system.",
      slot: CAPTURES.tileActions,
    },
    {
      id: "projects-benefits",
      name: "Projects & Benefits",
      line: "Connect delivered change to validated value.",
      slot: CAPTURES.tileProjects,
    },
  ],
  [
    {
      id: "problem-solving",
      name: "Problem Solving",
      line: "Use your methodology. Keep the evidence.",
      slot: CAPTURES.tilePps,
    },
    {
      id: "training-skills",
      name: "Training & Skills",
      line: "Build capability against your standards.",
      slot: CAPTURES.tileTraining,
      back: CAPTURES.tileSkills,
    },
  ],
];

/** Real published result (Formal assessment, 2.7 / 5). Order matches the app. */
export const PILLARS = [
  { name: "Engineering & Asset Reliability", score: 2.8 },
  { name: "Health & Safety", score: 2.4 },
  { name: "Operations", score: 2.7 },
  { name: "Quality & Technical", score: 2.9 },
  { name: "People & Leadership", score: 2.8 },
] as const;

export const OVERALL_SCORE = 2.7;
export const SCORE_MAX = 5;

export const LEAN_BEATS = [
  {
    index: "01",
    title: "Context",
    body: "Organisation, site, role where permitted, current workflow, open record and relevant framework.",
  },
  {
    index: "02",
    title: "Understand",
    body: "LeanAI understands where the user is and what the workflow is for.",
  },
  {
    index: "03",
    title: "Connect",
    body: "It can bring related work and the organisation's current standard into the conversation.",
  },
  {
    index: "04",
    title: "Coach",
    body: "It explains the next governed step and helps the user operate and set up the platform.",
  },
  {
    index: "05",
    title: "Recommend",
    body: "It can suggest a next step inside the open workflow. A person chooses whether to act.",
  },
  {
    index: "06",
    title: "You decide",
    body: "Publishing, closure, access and purchasing stay with a person.",
  },
] as const;

export type FaqItem = {
  id: string;
  q: string;
  a: string;
  link?: { href: string; label: string };
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "faq-what",
    q: "What is Lean Excellence Hub?",
    a: "A B2B platform for Continuous Improvement and Operational Excellence: maturity, Gemba, 5S, suggestions, actions, problem solving, projects, benefits, scheduling, recognition, training and capability in one connected system.",
  },
  {
    id: "faq-demo",
    q: "How do I book a demonstration?",
    a: "Use Book a demo to pick a time for a 30-minute walkthrough. The meeting is confirmed once the booking is accepted.",
    link: { href: "/demo", label: "Book a demo" },
  },
  {
    id: "faq-access",
    q: "How do I get early access?",
    a: "Use Get free access and tell us about your organisation and how many sites you run. We will set up early access with you.",
    link: { href: "/early-access", label: "Get free access" },
  },
  {
    id: "faq-data",
    q: "Are the records on this page real customer data?",
    a: "No. Product previews and examples on this marketing site use illustrative records only. They are not customer performance data.",
  },
  {
    id: "faq-leanai",
    q: "How does LeanAI relate to publishing and access?",
    a: "LeanAI can find, explain and recommend inside the current organisation, site and workflow. Publishing, closure, access and purchasing stay with a person.",
  },
];
