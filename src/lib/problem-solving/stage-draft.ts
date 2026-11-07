import {
  pendingAiProposalMatchesViewStage,
  resolveProblemSolvingSemanticStageKey,
} from "@/lib/problem-solving/ai-proposal-stage";
import type { ProblemSolvingWriteToolName } from "@/platform/ai/tools/problem-solving-schemas";
import {
  PROBLEM_SOLVING_READ_TOOLS,
  type ProblemSolvingToolName,
  buildOpenAiTools,
} from "@/platform/ai/tools/problem-solving-schemas";

/** Method template keys that alias a canonical semantic stage for drafting. */
const STAGE_KEY_ALIASES: Record<string, string> = {
  ANALYSE: "ROOT_CAUSE_ANALYSIS",
  VERIFY_CAUSE: "ROOT_CAUSE_ANALYSIS",
  CONTAIN: "CURRENT_CONDITION",
  COUNTERMEASURE: "COUNTERMEASURES",
  VERIFY_EFFECT: "EFFECTIVENESS_CHECK",
  SUSTAIN: "SUSTAINMENT",
  SUSTAINMENT: "SUSTAINMENT",
  CLOSE: "SUSTAINMENT",
};

const STAGE_WRITE_TOOLS: Record<
  string,
  readonly ProblemSolvingWriteToolName[]
> = {
  DEFINE: ["propose_problem_statement"],
  CURRENT_CONDITION: ["propose_current_condition_item"],
  TARGET_CONDITION: ["propose_target_condition"],
  ROOT_CAUSE_ANALYSIS: [
    "propose_five_why_chain",
    "propose_fishbone_cause",
    "propose_hypothesis",
  ],
  COUNTERMEASURES: ["propose_countermeasure"],
  IMPLEMENTATION: ["propose_universal_action"],
  EFFECTIVENESS_CHECK: ["propose_effectiveness_check"],
  SUSTAINMENT: ["propose_sustainment_item", "propose_lessons_learned"],
};

const STAGE_READ_TOOLS: Partial<
  Record<string, readonly ProblemSolvingToolName[]>
> = {
  DEFINE: ["get_problem_solving_case_overview"],
  CURRENT_CONDITION: [
    "get_problem_solving_case_overview",
    "get_current_condition",
  ],
  TARGET_CONDITION: [
    "get_problem_solving_case_overview",
    "get_current_condition",
  ],
  ROOT_CAUSE_ANALYSIS: [
    "get_problem_solving_case_overview",
    "get_current_condition",
    "get_cause_analysis",
    "get_hypotheses",
  ],
  COUNTERMEASURES: [
    "get_problem_solving_case_overview",
    "get_hypotheses",
    "get_countermeasures",
  ],
  IMPLEMENTATION: [
    "get_problem_solving_case_overview",
    "get_countermeasures",
    "get_case_actions",
  ],
  EFFECTIVENESS_CHECK: [
    "get_problem_solving_case_overview",
    "get_effectiveness_checks",
  ],
  SUSTAINMENT: [
    "get_problem_solving_case_overview",
    "get_sustainment",
    "get_lessons_learned",
  ],
};

/** Built-in problem-solving methods and semantic stages used in CI and pgTAP. */
export const PROBLEM_SOLVING_BUILTIN_METHOD_STAGES = [
  {
    method: "a3_structured",
    label: "A3 / 8-step",
    stages: [
      "DEFINE",
      "CURRENT_CONDITION",
      "TARGET_CONDITION",
      "ROOT_CAUSE_ANALYSIS",
      "COUNTERMEASURES",
      "IMPLEMENTATION",
      "EFFECTIVENESS_CHECK",
      "SUSTAINMENT",
    ],
  },
  {
    method: "rapid_rca",
    label: "Rapid RCA",
    stages: [
      "DEFINE",
      "CURRENT_CONDITION",
      "ROOT_CAUSE_ANALYSIS",
      "COUNTERMEASURES",
      "EFFECTIVENESS_CHECK",
    ],
  },
  {
    method: "five_why",
    label: "5 Why",
    stages: [
      "DEFINE",
      "ROOT_CAUSE_ANALYSIS",
      "COUNTERMEASURES",
      "EFFECTIVENESS_CHECK",
    ],
  },
  {
    method: "rapid_improvement",
    label: "Rapid Improvement",
    stages: [
      "DEFINE",
      "ROOT_CAUSE_ANALYSIS",
      "COUNTERMEASURES",
      "EFFECTIVENESS_CHECK",
    ],
  },
] as const;

export function resolveCanonicalStageKey(
  stageKey: string | null | undefined,
): string {
  if (stageKey == null) return "DEFINE";
  const trimmed = stageKey.trim();
  if (!trimmed) return "DEFINE";
  const aliased = STAGE_KEY_ALIASES[trimmed] ?? trimmed;
  const semantic = resolveProblemSolvingSemanticStageKey(aliased);
  return semantic ?? aliased;
}

export function writeToolsForStage(
  stageKey: string | null | undefined,
): readonly ProblemSolvingWriteToolName[] {
  const canonical = resolveCanonicalStageKey(stageKey);
  return (
    STAGE_WRITE_TOOLS[canonical] ?? [
      "propose_problem_statement",
      "propose_current_condition_item",
    ]
  );
}

export function primaryWriteToolForStage(
  stageKey: string | null | undefined,
): ProblemSolvingWriteToolName {
  const tools = writeToolsForStage(stageKey);
  return tools[0] ?? "propose_problem_statement";
}

export function readToolsForStage(
  stageKey: string | null | undefined,
): readonly ProblemSolvingToolName[] {
  const canonical = resolveCanonicalStageKey(stageKey);
  return STAGE_READ_TOOLS[canonical] ?? ["get_problem_solving_case_overview"];
}

export function buildOpenAiToolsForStage(
  stageKey: string | null | undefined,
): Array<Record<string, unknown>> {
  const allowed = new Set<ProblemSolvingToolName>([
    ...readToolsForStage(stageKey),
    ...writeToolsForStage(stageKey),
  ]);
  return buildOpenAiTools().filter((tool) =>
    allowed.has(tool.name as ProblemSolvingToolName),
  );
}

/**
 * Bounded auto-draft instruction: names exact write tools so stage drafts cannot
 * exhaust the tool loop on reads alone (ROOT_CAUSE_ANALYSIS regression).
 */
export function buildStageAutoDraftPrompt(
  stageKey: string | null | undefined,
): string {
  const canonical = resolveCanonicalStageKey(stageKey);
  const writeTools = writeToolsForStage(canonical);
  const toolList = writeTools.join(", ");
  const primary = writeTools[0];

  const templates: Record<string, string> = {
    DEFINE: `Call ${primary} with an improved problem statement based on authorised case data. You may use at most one overview read first. Do not only ask a question — queue at least one proposal.`,
    CURRENT_CONDITION: `Call ${primary} with observation or measured-fact drafts from authorised data. At most one overview read first. Queue at least one proposal.`,
    TARGET_CONDITION: `Call ${primary} with concise, observable target-condition wording (desired state—not the solution). At most one overview read first. Queue at least one proposal. Do not only ask a question.`,
    ROOT_CAUSE_ANALYSIS: `Without more than one overview read, call ${toolList} to queue at least one draft (prefer ${primary} plus fishbone or hypothesis when useful). Do not verify root cause. Do not finish without a write tool.`,
    COUNTERMEASURES: `Call ${primary} tied to leading hypotheses. Queue at least one countermeasure proposal.`,
    IMPLEMENTATION: `Call ${primary} with context_role countermeasure for work to execute. Queue at least one action proposal.`,
    EFFECTIVENESS_CHECK: `Call ${primary} with measurable criteria versus baseline. Queue at least one effectiveness check proposal.`,
    SUSTAINMENT: `Call one of ${toolList} for standards/checks or lessons learned. Queue at least one proposal.`,
  };

  return (
    templates[canonical] ??
    `Facilitate stage ${canonical}. Call one of ${toolList} and queue at least one draft proposal for human acceptance.`
  );
}

export type PendingProposalForStageCount = {
  proposal_type: string;
  status: string;
  semantic_stage_key?: string | null;
};

export function countPendingProposalsForViewStage(
  proposals: PendingProposalForStageCount[],
  viewStageKey: string,
): number {
  const canonical = resolveCanonicalStageKey(viewStageKey);
  return proposals.filter(
    (row) =>
      row.status === "pending" &&
      pendingAiProposalMatchesViewStage({
        proposal_type: row.proposal_type,
        semantic_stage_key: row.semantic_stage_key ?? null,
        viewStageKey: canonical,
      }),
  ).length;
}

/** Guards tests: every built-in method stage must expose at least one write tool. */
export function assertStageDraftCoverage(
  stageKey: string,
): ProblemSolvingWriteToolName[] {
  const tools = [...writeToolsForStage(stageKey)];
  if (tools.length === 0) {
    throw new Error(`No write tools configured for stage ${stageKey}`);
  }
  return tools;
}

const READ_TOOL_SET = new Set<string>(PROBLEM_SOLVING_READ_TOOLS);

export function isProblemSolvingReadToolName(name: string): boolean {
  return READ_TOOL_SET.has(name);
}
