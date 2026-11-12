export function formatFiveSAuditStatus(status: string): string {
  if (status === "in_progress") return "In progress";
  if (status === "completed") return "Completed";
  return status.replaceAll("_", " ");
}
