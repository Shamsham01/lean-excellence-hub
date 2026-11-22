export function isTerminalCaseStatus(status: string): boolean {
  return status === "closed" || status === "cancelled";
}

export function caseStatusAllowsLeanAiDrafting(status: string): boolean {
  return !isTerminalCaseStatus(status);
}
