import type { SetupReadinessKey, SetupReadinessStatus } from "./types";

export type SetupReadinessCta = {
  recommendedAction: string;
  targetRoute: string;
};

const CTA_BY_KEY_STATUS: Record<
  SetupReadinessKey,
  Record<SetupReadinessStatus, SetupReadinessCta>
> = {
  organisation: {
    not_started: {
      recommendedAction: "Create your organisation",
      targetRoute: "/create-organisation",
    },
    incomplete: {
      recommendedAction: "Complete organisation setup",
      targetRoute: "/platform/settings/organisation",
    },
    ready: {
      recommendedAction: "Review organisation profile",
      targetRoute: "/platform/settings/organisation",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  sites: {
    not_started: {
      recommendedAction: "Add your first site",
      targetRoute: "/platform/settings/structure",
    },
    incomplete: {
      recommendedAction: "Add an active billable site",
      targetRoute: "/platform/settings/structure",
    },
    ready: {
      recommendedAction: "Review organisation structure",
      targetRoute: "/platform/settings/structure",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  people: {
    not_started: {
      recommendedAction: "Assign an organisation owner",
      targetRoute: "/platform/settings/people",
    },
    incomplete: {
      recommendedAction: "Configure job functions",
      targetRoute: "/platform/settings/job-functions",
    },
    ready: {
      recommendedAction: "Review people setup",
      targetRoute: "/platform/settings/people",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  maturity: {
    not_started: {
      recommendedAction: "Set up a Maturity Framework",
      targetRoute: "/platform/maturity/models",
    },
    incomplete: {
      recommendedAction: "Finish and publish your Maturity Framework",
      targetRoute: "/platform/maturity/models",
    },
    ready: {
      recommendedAction: "Open Maturity",
      targetRoute: "/platform/maturity",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  suggestions: {
    not_started: {
      recommendedAction: "Set up a Suggestion Programme",
      targetRoute: "/platform/suggestions/programmes",
    },
    incomplete: {
      recommendedAction: "Publish your Suggestion Programme",
      targetRoute: "/platform/suggestions/programmes",
    },
    ready: {
      recommendedAction: "Open Suggestions",
      targetRoute: "/platform/suggestions",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  five_s: {
    not_started: {
      recommendedAction: "Create a 5S standard",
      targetRoute: "/platform/5s/standards",
    },
    incomplete: {
      recommendedAction: "Publish a 5S standard for an active site",
      targetRoute: "/platform/5s/standards",
    },
    ready: {
      recommendedAction: "Open 5S",
      targetRoute: "/platform/5s",
    },
    blocked: {
      recommendedAction: "Add a site before setting up 5S",
      targetRoute: "/platform/settings/structure",
    },
  },
  gemba: {
    not_started: {
      recommendedAction: "Create a Gemba definition",
      targetRoute: "/platform/gemba/definitions",
    },
    incomplete: {
      recommendedAction: "Publish a Gemba definition for an active site",
      targetRoute: "/platform/gemba/definitions",
    },
    ready: {
      recommendedAction: "Open Gemba",
      targetRoute: "/platform/gemba",
    },
    blocked: {
      recommendedAction: "Add a site before setting up Gemba",
      targetRoute: "/platform/settings/structure",
    },
  },
  training: {
    not_started: {
      recommendedAction: "Build your training catalogue",
      targetRoute: "/platform/training/courses",
    },
    incomplete: {
      recommendedAction: "Publish a course and curriculum requirement",
      targetRoute: "/platform/training/curriculum",
    },
    ready: {
      recommendedAction: "Open Training",
      targetRoute: "/platform/training/courses",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  skills: {
    not_started: {
      recommendedAction: "Set up Skills",
      targetRoute: "/platform/skills",
    },
    incomplete: {
      recommendedAction: "Publish a skill scale and capability requirements",
      targetRoute: "/platform/skills",
    },
    ready: {
      recommendedAction: "Open Skills",
      targetRoute: "/platform/skills",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
  recognition: {
    not_started: {
      recommendedAction: "Create a recognition type",
      targetRoute: "/platform/recognition/types",
    },
    incomplete: {
      recommendedAction: "Activate a recognition type",
      targetRoute: "/platform/recognition/types",
    },
    ready: {
      recommendedAction: "Open Recognition",
      targetRoute: "/platform/recognition",
    },
    blocked: {
      recommendedAction: "Add a site before setting up Recognition",
      targetRoute: "/platform/settings/structure",
    },
  },
  lean_ai: {
    not_started: {
      recommendedAction: "Enable LeanAI for this organisation",
      targetRoute: "/platform/settings/ai",
    },
    incomplete: {
      recommendedAction: "Finish LeanAI availability setup",
      targetRoute: "/platform/settings/ai",
    },
    ready: {
      recommendedAction: "Review LeanAI settings",
      targetRoute: "/platform/settings/ai",
    },
    blocked: {
      recommendedAction: "Restore organisation access",
      targetRoute: "/billing",
    },
  },
};

export function setupReadinessCta(
  key: SetupReadinessKey,
  status: SetupReadinessStatus,
): SetupReadinessCta {
  return CTA_BY_KEY_STATUS[key][status];
}
