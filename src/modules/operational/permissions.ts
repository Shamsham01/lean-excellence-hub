export const FIVE_S_PERMISSIONS = {
  read: "five_s.read",
  standardsManage: "five_s.standards.manage",
  auditPerform: "five_s.audit.perform",
  auditReview: "five_s.audit.review",
} as const;

export const GEMBA_PERMISSIONS = {
  read: "gemba.read",
  definitionsManage: "gemba.definitions.manage",
  walkPerform: "gemba.walk.perform",
  walkReview: "gemba.walk.review",
} as const;

export const SCHEDULE_PERMISSIONS = {
  read: "schedules.read",
  manage: "schedules.manage",
  complete: "schedules.complete",
} as const;
