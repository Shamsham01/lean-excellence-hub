import type { AiProposalType } from "@/platform/ai/types";

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  problem_statement: "Problem statement",
  current_condition_item: "Current condition",
  hypothesis: "Hypothesis",
  hypothesis_test: "Hypothesis test",
  containment: "Containment",
  countermeasure: "Countermeasure",
  universal_action: "Action",
  effectiveness_check: "Effectiveness check",
  sustainment_item: "Sustainment",
  session_question: "Session question",
  session_summary: "Session summary",
  lessons_learned: "Lessons learned",
  five_why_chain: "Five whys",
  fishbone_cause: "Fishbone cause",
  close_case: "Close case",
  analysis_node: "Cause analysis",
};

const PRIMARY_TEXT_KEYS = [
  "statement",
  "title",
  "description",
  "body",
  "what",
  "criterion",
  "test_question",
  "rationale",
] as const;

function humanizeTypeKey(type: string): string {
  return type
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function proposalTypeLabel(proposalType: string): string {
  return (
    PROPOSAL_TYPE_LABELS[proposalType] ?? humanizeTypeKey(proposalType)
  );
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unwrapEnvelope(payload: Record<string, unknown>): Record<string, unknown> {
  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return payload.data as Record<string, unknown>;
  }
  if (
    payload.payload &&
    typeof payload.payload === "object" &&
    !Array.isArray(payload.payload)
  ) {
    return payload.payload as Record<string, unknown>;
  }
  return payload;
}

function formatStructuredProposal(
  proposalType: AiProposalType | string,
  payload: Record<string, unknown>,
): string | null {
  const data = unwrapEnvelope(payload);

  switch (proposalType) {
    case "problem_statement":
    case "current_condition_item":
      return readString(data.statement);
    case "hypothesis":
      return readString(data.statement);
    case "hypothesis_test":
      return readString(data.test_question);
    case "containment":
    case "countermeasure":
      return (
        readString(data.description) ??
        readString(data.title) ??
        readString(data.rationale)
      );
    case "universal_action":
      return readString(data.title) ?? readString(data.description);
    case "effectiveness_check":
      return readString(data.criterion);
    case "sustainment_item":
      return readString(data.what);
    case "session_question":
    case "session_summary":
      return readString(data.body);
    case "lessons_learned":
      return readString(data.what_happened) ?? readString(data.what_learned);
    case "fishbone_cause":
      return readString(data.label);
    case "five_why_chain": {
      const steps = data.steps;
      if (Array.isArray(steps) && steps.length > 0) {
        const first = steps[0];
        if (first && typeof first === "object" && "label" in first) {
          return readString((first as { label?: unknown }).label);
        }
      }
      return readString(data.title);
    }
    default:
      break;
  }

  for (const key of PRIMARY_TEXT_KEYS) {
    const text = readString(data[key]);
    if (text) return text;
  }

  return null;
}

export function formatProposalPreview(
  proposalType: string,
  payload: Record<string, unknown>,
  humanExplanation: string,
): string {
  const structured = formatStructuredProposal(proposalType, payload);
  if (structured) return structured;

  const explanation = humanExplanation.trim();
  if (explanation.length > 0) return explanation;

  return "Review this proposal before accepting.";
}
