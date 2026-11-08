import { z } from "zod";

import {
  generateTrainingCourseCode,
  resolveUniqueTrainingCourseCode,
} from "@/modules/training/catalog-code";
import { resolveTrainingCurriculumCreateCode } from "@/modules/training/curriculum-code";
import type { TrainingStarterPack } from "@/modules/training/templates/types";

const deliveryMethodSchema = z.enum([
  "classroom",
  "workshop",
  "coaching",
  "practical",
  "online",
  "external",
  "blended",
]);

const courseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
  category: z.string().trim().max(120).nullable(),
  description: z.string().trim().max(2000).nullable(),
  duration_minutes: z.number().int().min(1).max(10000).nullable(),
  delivery_method: deliveryMethodSchema.nullable(),
  learning_objectives: z.string().trim().max(4000).nullable(),
});

const requirementSchema = z.object({
  course_code: z.string().trim().toLowerCase().min(1).max(80),
  job_function_id: z.uuid().nullable(),
  organisational_unit_id: z.uuid().nullable(),
  mandatory: z.boolean(),
  notes: z.string().trim().max(2000).nullable(),
});

const curriculumSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    description: z.string().trim().max(2000).nullable(),
    requirements: z.array(requirementSchema).max(80),
  })
  .nullable();

export const trainingSetupDefinitionSchema = z.object({
  source: z.enum(["manual", "quick_start", "leanai"]),
  template_key: z.string().trim().min(1).max(80).nullable(),
  template_version: z.string().trim().min(1).max(40).nullable(),
  title: z.string().trim().min(1).max(160),
  sample: z.boolean(),
  courses: z.array(courseSchema).min(1).max(24),
  curriculum: curriculumSchema,
  unresolved_roles: z
    .array(
      z.object({
        suggested_role: z.string().trim().min(1).max(160),
        reason: z.string().trim().min(1).max(400),
      }),
    )
    .max(40),
});

export type TrainingSetupDefinition = z.infer<
  typeof trainingSetupDefinitionSchema
>;

export type RoleMapping = {
  suggestedRole: string;
  jobFunctionId: string | null;
};

export function buildStarterPackDefinition(input: {
  pack: TrainingStarterPack;
  roleMappings: readonly RoleMapping[];
  existingCourseCodes?: readonly string[];
  existingCurriculumCodes?: readonly string[];
}):
  | { ok: true; definition: TrainingSetupDefinition }
  | { ok: false; message: string } {
  const courseCodes = [...(input.existingCourseCodes ?? [])];
  const courses = input.pack.courses.map((course) => {
    const code = resolveUniqueTrainingCourseCode(
      generateTrainingCourseCode(course.name),
      courseCodes,
    );
    courseCodes.push(code);
    return {
      name: course.name,
      code,
      category: course.category,
      description: course.description,
      duration_minutes: course.durationMinutes,
      delivery_method: course.deliveryMethod,
      learning_objectives: course.learningObjectives,
    };
  });
  const courseCodeByName = new Map(
    courses.map((course) => [course.name.trim().toLowerCase(), course.code]),
  );
  const mappedRoles = new Map(
    input.roleMappings.map((mapping) => [
      mapping.suggestedRole.trim().toLowerCase(),
      mapping.jobFunctionId,
    ]),
  );
  const unresolved: TrainingSetupDefinition["unresolved_roles"] = [];
  const requirements: NonNullable<
    TrainingSetupDefinition["curriculum"]
  >["requirements"] = [];

  for (const role of input.pack.suggestedRoles) {
    if (!mappedRoles.get(role.title.trim().toLowerCase())) {
      unresolved.push({
        suggested_role: role.title,
        reason:
          "Not mapped to an existing job function. No requirement was created for this role.",
      });
    }
  }

  for (const requirement of input.pack.requirements) {
    const courseCode = courseCodeByName.get(
      requirement.courseName.trim().toLowerCase(),
    );
    const jobFunctionId =
      mappedRoles.get(requirement.roleTitle.trim().toLowerCase()) ?? null;
    if (!courseCode) {
      return {
        ok: false,
        message: "A suggested requirement refers to a missing course.",
      };
    }
    if (!jobFunctionId) {
      continue;
    }
    requirements.push({
      course_code: courseCode,
      job_function_id: jobFunctionId,
      organisational_unit_id: null,
      mandatory: requirement.mandatory,
      notes: requirement.notes,
    });
  }

  const curriculumCode = resolveTrainingCurriculumCreateCode({
    name: input.pack.curriculumName,
    existingCodes: input.existingCurriculumCodes ?? [],
  });
  if (!curriculumCode.ok) {
    return { ok: false, message: curriculumCode.message };
  }

  const parsed = trainingSetupDefinitionSchema.safeParse({
    source: "quick_start",
    template_key: input.pack.key,
    template_version: input.pack.version,
    title: `Sample: ${input.pack.name}`,
    sample: true,
    courses,
    curriculum:
      requirements.length > 0
        ? {
            name: input.pack.curriculumName,
            code: curriculumCode.code,
            description: input.pack.curriculumDescription,
            requirements,
          }
        : {
            name: input.pack.curriculumName,
            code: curriculumCode.code,
            description: input.pack.curriculumDescription,
            requirements: [],
          },
    unresolved_roles: unresolved,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "This starter pack could not be turned into a draft.",
    };
  }

  return { ok: true, definition: parsed.data };
}
