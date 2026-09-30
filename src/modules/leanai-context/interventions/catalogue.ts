import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  AI_PERMISSIONS,
  FIVE_S_PERMISSIONS,
  GEMBA_PERMISSIONS,
  JOB_FUNCTION_PERMISSIONS,
  RECOGNITION_PERMISSIONS,
  SKILLS_PERMISSIONS,
  SUGGESTIONS_PERMISSIONS,
  TRAINING_PERMISSIONS,
} from "@/modules/operational/permissions";

import type { LeanAiInterventionDefinition } from "./types";

const SETUP_SURFACES = [
  "onboarding",
  "setup",
  "platform_home",
] as const satisfies LeanAiInterventionDefinition["surfaces"];

const DEFAULT_DISMISS_HOURS = 168;
const DEFAULT_SNOOZE_MINUTES = 1_440;

/**
 * Typed, versionable intervention catalogue. Ranking and copy are
 * deterministic product knowledge — not model output.
 */
export const LEANAI_INTERVENTION_CATALOGUE: readonly LeanAiInterventionDefinition[] =
  [
    {
      key: "organisation_profile_setup",
      moduleKey: "organisation",
      readinessKey: "organisation",
      eligibleStatuses: ["incomplete", "blocked"],
      requiredPermissions: ["billing.manage"],
      priority: 10,
      surfaces: SETUP_SURFACES,
      title: "Finish organisation access",
      body: "Your organisation profile or billing access is still incomplete, so other setup steps cannot finish reliably.",
      explain:
        "Lean Excellence Hub needs an active organisation with operational access before sites, people, and modules can be configured. Open billing or onboarding to restore access, then return here.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/billing",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "sites_first_setup",
      moduleKey: "sites",
      readinessKey: "sites",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: ["hierarchy.manage"],
      priority: 20,
      surfaces: SETUP_SURFACES,
      title: "Add your first site",
      body: "Your organisation is ready, but it does not yet have an active billable site. Maturity, 5S, Gemba and Recognition all use your structure.",
      explain:
        "A site is the first unit in your organisation structure. Create at least one active site so assessments, walks, audits and recognition can be anchored to a real workplace rather than floating at organisation level.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/settings/structure",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "people_job_functions_setup",
      moduleKey: "people",
      readinessKey: "people",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [JOB_FUNCTION_PERMISSIONS.manage],
      priority: 30,
      surfaces: SETUP_SURFACES,
      title: "Configure job functions",
      body: "An owner exists, but job functions have not been configured. Training and Skills use job functions to describe what people do.",
      explain:
        "A job function is a work role such as Operator or Quality Lead. It does not grant application permissions. Adding at least one active job function is the minimum people setup needed before Training and Skills can be used meaningfully.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/settings/job-functions",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "maturity_first_setup",
      moduleKey: "maturity",
      readinessKey: "maturity",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [MATURITY_PERMISSIONS.modelsManage],
      priority: 40,
      surfaces: [...SETUP_SURFACES, "maturity"],
      title: "Set up a Maturity Framework",
      body: "You do not have a published Maturity Framework yet, so the organisation cannot measure Lean / operational excellence consistently.",
      explain:
        "A Maturity Framework defines the pillars and questions used for assessments. A draft-only framework is not ready. Publish at least one version so teams can run assessments against a shared standard.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/maturity/models",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "suggestions_programme_setup",
      moduleKey: "suggestions",
      readinessKey: "suggestions",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [SUGGESTIONS_PERMISSIONS.programmesManage],
      priority: 50,
      surfaces: [...SETUP_SURFACES, "suggestions"],
      title: "Set up a Suggestion Programme",
      body: "Suggestions are available, but no active published programme exists yet. People cannot submit ideas against a live programme.",
      explain:
        "A Suggestion Programme holds categories, guidance and the published form people use to submit ideas. Create a programme and publish a version. Catalogue presence without a published version is not enough.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/suggestions/programmes",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "five_s_standard_setup",
      moduleKey: "five_s",
      readinessKey: "five_s",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [FIVE_S_PERMISSIONS.standardsManage],
      priority: 60,
      surfaces: SETUP_SURFACES,
      title: "Create a 5S standard",
      body: "No published 5S standard applies to an active unit yet, so audits cannot run against a usable template.",
      explain:
        "5S needs a published standard and an active applicability to a site or unit. Draft-only standards are incomplete. Publish a standard and attach it to at least one active unit.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/5s/standards",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "gemba_definition_setup",
      moduleKey: "gemba",
      readinessKey: "gemba",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [GEMBA_PERMISSIONS.definitionsManage],
      priority: 70,
      surfaces: SETUP_SURFACES,
      title: "Create a Gemba definition",
      body: "No published Gemba definition applies to an active unit yet, so walks cannot start from a shared checklist.",
      explain:
        "A Gemba definition is the published walk template. It must apply to at least one active unit. Draft-only definitions stay incomplete until they are published with applicability.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/gemba/definitions",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "training_curriculum_setup",
      moduleKey: "training",
      readinessKey: "training",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [TRAINING_PERMISSIONS.curriculumManage],
      priority: 80,
      surfaces: SETUP_SURFACES,
      title: "Publish training requirements",
      body: "A training catalogue alone is not enough. Publish a course and a curriculum requirement before Training is ready.",
      explain:
        "Training readiness needs at least one published course and a published curriculum that assigns a requirement. This tells Lean Excellence Hub who needs which course, rather than only listing catalogue items.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/training/curriculum",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "skills_capability_setup",
      moduleKey: "skills",
      readinessKey: "skills",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [SKILLS_PERMISSIONS.requirementsManage],
      priority: 90,
      surfaces: SETUP_SURFACES,
      title: "Set up Skills",
      body: "Skills is not yet a usable published set. You need a published scale, an active skill, and a published capability requirement.",
      explain:
        "Skills configuration is ready only when a scale with levels is published, at least one skill is active, and a capability set assigns requirements. Partial catalogues stay incomplete so teams are not assessed against unfinished definitions.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/skills",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "recognition_types_setup",
      moduleKey: "recognition",
      readinessKey: "recognition",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [RECOGNITION_PERMISSIONS.manage],
      priority: 100,
      surfaces: SETUP_SURFACES,
      title: "Create a recognition type",
      body: "No active recognition type exists yet, so the organisation cannot award recognition.",
      explain:
        "Recognition types describe the kinds of acknowledgement your organisation uses. Activate at least one type. Inactive-only catalogues remain incomplete.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/recognition/types",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
    {
      key: "lean_ai_enablement_setup",
      moduleKey: "lean_ai",
      readinessKey: "lean_ai",
      eligibleStatuses: ["not_started", "incomplete"],
      requiredPermissions: [AI_PERMISSIONS.manageSettings],
      priority: 110,
      surfaces: SETUP_SURFACES,
      title: "Finish LeanAI availability",
      body: "LeanAI is not fully available for this organisation. You can still use this deterministic coach without a model provider.",
      explain:
        "Organisation LeanAI enablement, your permission to manage settings, and application provider availability are separate. This prompt never requires a model call. Open LeanAI settings to enable the organisation or review why the provider is unavailable.",
      primaryCtaLabel: "Set it up",
      targetRoute: "/platform/settings/ai",
      dismissCooldownHours: DEFAULT_DISMISS_HOURS,
      snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    },
  ];

export const LEANAI_INTERVENTION_KEYS = LEANAI_INTERVENTION_CATALOGUE.map(
  (entry) => entry.key,
);

export const LEANAI_INTERVENTION_PERMISSION_KEYS = [
  ...new Set(
    LEANAI_INTERVENTION_CATALOGUE.flatMap((entry) => entry.requiredPermissions),
  ),
];

export function leanAiInterventionByKey(
  key: string,
): LeanAiInterventionDefinition | undefined {
  return LEANAI_INTERVENTION_CATALOGUE.find((entry) => entry.key === key);
}
