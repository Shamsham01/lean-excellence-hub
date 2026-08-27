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

export const SUGGESTIONS_PERMISSIONS = {
  read: "suggestions.read",
  submit: "suggestions.submit",
  review: "suggestions.review",
  manage: "suggestions.manage",
  programmesManage: "suggestions.programmes.manage",
} as const;

export const RECOGNITION_PERMISSIONS = {
  read: "recognition.read",
  award: "recognition.award",
  manage: "recognition.manage",
} as const;

export const PROJECTS_PERMISSIONS = {
  read: "projects.read",
  manage: "projects.manage",
} as const;

export const BENEFITS_PERMISSIONS = {
  read: "benefits.read",
  create: "benefits.create",
  manage: "benefits.manage",
  validateCi: "benefits.validate.ci",
  validateFinance: "benefits.validate.finance",
  realisationRecord: "benefits.realisation.record",
  realisationValidate: "benefits.realisation.validate",
  categoriesManage: "benefits.categories.manage",
} as const;

export const PROBLEM_SOLVING_PERMISSIONS = {
  view: "problem_solving.view",
  create: "problem_solving.create",
  contribute: "problem_solving.contribute",
  manage: "problem_solving.manage",
  facilitate: "problem_solving.facilitate",
  verifyCause: "problem_solving.verify_cause",
  close: "problem_solving.close",
  methodsManage: "problem_solving.methods.manage",
} as const;
