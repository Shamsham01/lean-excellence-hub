import { z } from "zod";

import {
  generateTrainingCourseCode,
  resolveUniqueTrainingCourseCode,
} from "@/modules/training/catalog-code";
import { resolveTrainingCurriculumCreateCode } from "@/modules/training/curriculum-code";
import {
  trainingSetupDefinitionSchema,
  type TrainingSetupDefinition,
} from "@/modules/training/setup/definition";

const deliveryMethodSchema = z.enum([
  "classroom",
  "workshop",
  "coaching",
  "practical",
  "online",
  "external",
  "blended",
]);

const courseDraftLoose = z.object({
  name: z.string().trim().max(160).default(""),
  category: z.string().trim().max(120).default(""),
  description: z.string().trim().max(2000).default(""),
  durationMinutes: z.string().trim().max(12).default(""),
  deliveryMethod: z.string().trim().max(40).default(""),
  learningObjectives: z.string().trim().max(4000).default(""),
});

export const manualTrainingPreparationSchema = z.object({
  idempotencyKey: z.uuid(),
  step: z.enum(["courses", "curriculum", "preview"]),
  title: z.string().trim().max(160).default(""),
  courses: z.array(courseDraftLoose).max(24),
  includeCurriculum: z.boolean(),
  curriculumName: z.string().trim().max(160).default(""),
  curriculumDescription: z.string().trim().max(2000).default(""),
});

export type ManualTrainingPreparation = z.infer<
  typeof manualTrainingPreparationSchema
>;

export const quickStartPreparationSchema = z.object({
  idempotencyKey: z.uuid(),
  roleMappings: z
    .array(
      z.object({
        suggestedRole: z.string().trim().min(1).max(160),
        jobFunctionId: z.uuid().nullable(),
      }),
    )
    .max(40),
});

export type QuickStartPreparation = z.infer<typeof quickStartPreparationSchema>;

export const leanAiPreparationSchema = quickStartPreparationSchema;

export type TrainingCreationKeyState =
  "absent" | "draft" | "published" | "discarded";

export function trainingCreationKeyState(
  status: string | null | undefined,
): TrainingCreationKeyState {
  if (status === "draft" || status === "published" || status === "discarded") {
    return status;
  }
  return "absent";
}

export function resolveTrainingPreparationVisit<
  T extends { idempotencyKey: string },
>(input: {
  saved: T | null;
  creationKeyState: TrainingCreationKeyState;
  fresh: () => T;
  replacementKey: string;
}): { preparation: T; mode: "fresh" | "resume" | "new_setup" } {
  if (!input.saved) {
    return { preparation: input.fresh(), mode: "fresh" };
  }
  if (
    input.creationKeyState === "absent" ||
    input.creationKeyState === "draft"
  ) {
    return { preparation: input.saved, mode: "resume" };
  }
  return {
    preparation: { ...input.saved, idempotencyKey: input.replacementKey },
    mode: "new_setup",
  };
}

export function renewTrainingPreparationKey<
  T extends { idempotencyKey: string },
>(preparation: T, replacementKey: string): T {
  return { ...preparation, idempotencyKey: replacementKey };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function manualPreparationToDefinition(
  state: ManualTrainingPreparation,
  existingCourseCodes: readonly string[],
  existingCurriculumCodes: readonly string[],
):
  | { ok: true; definition: TrainingSetupDefinition }
  | { ok: false; message: string } {
  const codes = [...existingCourseCodes];
  const courses = [];
  for (const course of state.courses.filter((row) => row.name.trim())) {
    const resolved = resolveUniqueTrainingCourseCode(
      generateTrainingCourseCode(course.name),
      codes,
    );
    codes.push(resolved);
    const duration = Number.parseInt(course.durationMinutes, 10);
    const delivery = course.deliveryMethod.trim();
    courses.push({
      name: course.name.trim(),
      code: resolved,
      category: emptyToNull(course.category),
      description: emptyToNull(course.description),
      duration_minutes:
        Number.isFinite(duration) && duration > 0 ? duration : null,
      delivery_method:
        deliveryMethodSchema.safeParse(delivery).success && delivery.length > 0
          ? (delivery as z.infer<typeof deliveryMethodSchema>)
          : null,
      learning_objectives: emptyToNull(course.learningObjectives),
    });
  }
  if (courses.length === 0) {
    return { ok: false, message: "Add at least one course." };
  }

  let curriculum: TrainingSetupDefinition["curriculum"] = null;
  if (state.includeCurriculum && state.curriculumName.trim()) {
    const curriculumCode = resolveTrainingCurriculumCreateCode({
      name: state.curriculumName,
      existingCodes: existingCurriculumCodes,
    });
    if (!curriculumCode.ok) {
      return { ok: false, message: curriculumCode.message };
    }
    curriculum = {
      name: state.curriculumName.trim(),
      code: curriculumCode.code,
      description: emptyToNull(state.curriculumDescription),
      requirements: [],
    };
  }

  const parsed = trainingSetupDefinitionSchema.safeParse({
    source: "manual",
    template_key: null,
    template_version: null,
    title: state.title.trim() || "Training catalogue draft",
    sample: false,
    courses,
    curriculum,
    unresolved_roles: [],
  });
  if (!parsed.success) {
    return { ok: false, message: "Check the course fields and try again." };
  }
  return { ok: true, definition: parsed.data };
}
