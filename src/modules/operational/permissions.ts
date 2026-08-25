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

export const JOB_FUNCTION_PERMISSIONS = {
  read: "job_functions.read",
  manage: "job_functions.manage",
} as const;

export const TRAINING_PERMISSIONS = {
  read: "training.read",
  catalogManage: "training.catalog.manage",
  curriculumManage: "training.curriculum.manage",
  sessionsManage: "training.sessions.manage",
  completionsManage: "training.completions.manage",
} as const;

export const SKILLS_PERMISSIONS = {
  read: "skills.read",
  catalogManage: "skills.catalog.manage",
  requirementsManage: "skills.requirements.manage",
  assess: "skills.assess",
} as const;

export const PEOPLE_PERMISSIONS = {
  capabilityRead: "people.capability.read",
} as const;
