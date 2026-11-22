export const TRAINING_STARTER_PACK_VERSION = "2026.11.08" as const;

export const TRAINING_STARTER_PACK_KEYS = [
  "leh-manufacturing-training-starter",
] as const;

export type TrainingStarterPackKey =
  (typeof TRAINING_STARTER_PACK_KEYS)[number];

export type TrainingStarterPackCourse = {
  name: string;
  category: string | null;
  description: string | null;
  durationMinutes: number | null;
  deliveryMethod:
    | "classroom"
    | "workshop"
    | "coaching"
    | "practical"
    | "online"
    | "external"
    | "blended"
    | null;
  learningObjectives: string | null;
};

export type TrainingStarterPackRequirement = {
  courseName: string;
  roleTitle: string;
  mandatory: boolean;
  notes: string | null;
};

export type TrainingStarterPack = {
  key: TrainingStarterPackKey;
  version: typeof TRAINING_STARTER_PACK_VERSION;
  name: string;
  summary: string;
  disclaimer: string | null;
  courses: TrainingStarterPackCourse[];
  curriculumName: string;
  curriculumDescription: string | null;
  suggestedRoles: Array<{ title: string; description: string | null }>;
  requirements: TrainingStarterPackRequirement[];
};
