export type ProblemSolvingCaseAuditEvent = {
  id: string;
  event_action: string;
  event_outcome: string;
  actor_membership_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "problem_solving.problem_statement_updated": "Problem statement updated",
  "problem_solving.target_condition_updated": "Target condition updated",
  "problem_solving.fishbone_cause_updated": "Fishbone cause edited",
  "problem_solving.fishbone_cause_removed": "Fishbone cause removed",
  "problem_solving.fishbone_cause_promoted": "Fishbone cause promoted",
  "problem_solving.effectiveness_recorded": "Effectiveness result recorded",
  "hypothesis.verified": "Cause verified",
  "hypothesis.rejected": "Cause rejected",
};

export function caseAuditEventLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function parseCaseAuditActivity(
  payload: unknown,
): ProblemSolvingCaseAuditEvent[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const event_action =
        typeof record.event_action === "string" ? record.event_action : "";
      const created_at =
        typeof record.created_at === "string" ? record.created_at : "";
      if (!id || !event_action || !created_at) return null;
      return {
        id,
        event_action,
        event_outcome:
          typeof record.event_outcome === "string" ? record.event_outcome : "",
        actor_membership_id:
          typeof record.actor_membership_id === "string"
            ? record.actor_membership_id
            : null,
        metadata:
          record.metadata && typeof record.metadata === "object"
            ? (record.metadata as Record<string, unknown>)
            : {},
        created_at,
      };
    })
    .filter((row): row is ProblemSolvingCaseAuditEvent => row !== null);
}
