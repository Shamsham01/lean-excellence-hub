export const TRAINING_BUILDER_MODULE_KEY = "training" as const;
export const TRAINING_BUILDER_SESSION_TITLE = "LeanAI Training setup";
export const TRAINING_BUILDER_CONTEXT_CONTRACT =
  "training-setup-builder-context-v1" as const;
export const TRAINING_BUILDER_PAYLOAD_KIND = "training_setup_builder" as const;
export const TRAINING_BUILDER_DECLARED_KEY = "leanai-training-builder" as const;
export const TRAINING_BUILDER_ROUTE =
  "/platform/training/setup/leanai" as const;
export const TRAINING_BUILDER_COOKIE_PATH = "/platform/training" as const;

export const TRAINING_BUILDER_LIMITS = {
  minCourses: 1,
  maxCourses: 12,
  maxRequirements: 40,
  nameMax: 160,
  textMax: 2000,
} as const;

export type TrainingBuilderProposal = {
  title: string;
  courses: Array<{
    name: string;
    category: string | null;
    description: string | null;
    durationMinutes: number | null;
    deliveryMethod: string | null;
    learningObjectives: string | null;
  }>;
  curriculum: {
    name: string;
    description: string | null;
    requirements: Array<{
      courseName: string;
      suggestedJobFunction: string;
      mandatory: boolean;
      notes: string | null;
    }>;
  } | null;
  notes: string[];
};
