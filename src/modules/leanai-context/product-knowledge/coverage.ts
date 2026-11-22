import { allPlatformKnowledgeFieldGaps } from "./registry";
import { problemSolvingKnowledgeFieldGaps } from "./problem-solving";
import { skillsKnowledgeFieldGaps } from "./skills";

export type PlatformKnowledgeCoverage = {
  module: string;
  status: "complete" | "partial" | "not_started";
  followUp: string;
};

const gaps = allPlatformKnowledgeFieldGaps();

function bundleComplete(module: keyof typeof gaps): boolean {
  return gaps[module].length === 0;
}

/** Release-matched coverage ledger for LeanAI answers and CI drift checks. */
export const PLATFORM_KNOWLEDGE_COVERAGE: readonly PlatformKnowledgeCoverage[] =
  [
    {
      module: "skills",
      status: skillsKnowledgeFieldGaps().length === 0 ? "complete" : "partial",
      followUp:
        skillsKnowledgeFieldGaps().length === 0
          ? "Audited Skills authoring and assessment fields ship in this bundle."
          : `Missing Skills fields: ${skillsKnowledgeFieldGaps().join(", ")}.`,
    },
    {
      module: "problem_solving",
      status:
        problemSolvingKnowledgeFieldGaps().length === 0
          ? "complete"
          : "partial",
      followUp:
        problemSolvingKnowledgeFieldGaps().length === 0
          ? "Audited case fields, seeded methods, permissions, and closure outcomes ship in this bundle."
          : `Missing Problem Solving fields: ${problemSolvingKnowledgeFieldGaps().join(", ")}.`,
    },
    {
      module: "maturity",
      status: bundleComplete("maturity") ? "complete" : "partial",
      followUp:
        gaps.maturity.length === 0
          ? "First-wave framework and assessment lifecycle fields are audited."
          : `Maturity bundle gaps: ${gaps.maturity.join(", ")}. Pillar or question scoring metadata not fully audited.`,
    },
    {
      module: "suggestions",
      status: bundleComplete("suggestions") ? "complete" : "partial",
      followUp:
        gaps.suggestions.length === 0
          ? "Programme, category, submission, and park rationale fields are audited."
          : `Suggestions gaps: ${gaps.suggestions.join(", ")}.`,
    },
    {
      module: "actions",
      status: bundleComplete("actions") ? "complete" : "partial",
      followUp:
        gaps.actions.length === 0
          ? "Core action create, priority, unit, assignee, and status fields are audited."
          : `Actions gaps: ${gaps.actions.join(", ")}.`,
    },
    {
      module: "training",
      status: bundleComplete("training") ? "complete" : "partial",
      followUp:
        gaps.training.length === 0
          ? "Course, curriculum requirement, and session lifecycle fields are audited. Three-path setup ships at /platform/training/setup."
          : `Training gaps: ${gaps.training.join(", ")}.`,
    },
    {
      module: "people",
      status: bundleComplete("people") ? "complete" : "partial",
      followUp:
        "Job functions, invitations, and primary assignment are audited. HR import columns and full directory columns remain partial.",
    },
    {
      module: "five_s",
      status: bundleComplete("five_s") ? "complete" : "partial",
      followUp:
        "Standard publish and audit score fields are audited. Full scoring-scale editor fields remain partial.",
    },
    {
      module: "gemba",
      status: bundleComplete("gemba") ? "complete" : "partial",
      followUp:
        "Definition publish and observation fields are audited. Route-question editor fields remain partial.",
    },
    {
      module: "recognition",
      status: bundleComplete("recognition") ? "complete" : "partial",
      followUp:
        "Type and recipient fields are audited. Nomination approval chains not fully audited.",
    },
    {
      module: "projects",
      status: bundleComplete("projects") ? "complete" : "partial",
      followUp:
        "Title, priority, and charter problem statement are audited. Phase and milestone fields remain partial.",
    },
    {
      module: "benefits",
      status: bundleComplete("benefits") ? "complete" : "partial",
      followUp:
        "Class, planned realisation, and status are audited. Forecast line items and validation queues remain partial.",
    },
    {
      module: "billing_and_administration",
      status: bundleComplete("billing_administration") ? "complete" : "partial",
      followUp:
        "Capacity and ownership transfer boundaries are audited. Payment instrument and invoice line detail are not in the bundle.",
    },
  ];

export function knowledgeCoverageStatement(): string {
  return "LeanAI ships release-matched product knowledge bundles. Skills, Problem Solving, Maturity, Suggestions, Actions, and Training have audited first-wave field coverage. Other modules have smaller bundles or coach facts only. If a screen or field is not in the bundle, LeanAI states the gap instead of inventing it.";
}
