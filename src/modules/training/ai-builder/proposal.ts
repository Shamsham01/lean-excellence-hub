import { z } from "zod";

import { normalizeModuleSetupDiscoveryQuestions } from "@/modules/module-setup/ai-builder/discovery-questions";
import { boundedText } from "@/modules/module-setup/text";
import {
  generateTrainingCourseCode,
  resolveUniqueTrainingCourseCode,
} from "@/modules/training/catalog-code";
import { resolveTrainingCurriculumCreateCode } from "@/modules/training/curriculum-code";
import {
  trainingSetupDefinitionSchema,
  type RoleMapping,
  type TrainingSetupDefinition,
} from "@/modules/training/setup/definition";
import { normalizeTrainingBuilderProviderEnvelope } from "./normalize-envelope";
import {
  TRAINING_BUILDER_DECLARED_KEY,
  TRAINING_BUILDER_LIMITS as LIMITS,
  type TrainingBuilderProposal,
} from "./types";

export function formatTrainingEnvelopeParseIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const path =
      issue.path.length > 0
        ? issue.path.map((segment) => String(segment)).join(".")
        : "root";
    return `${issue.code}@${path}`;
  });
}

function requirePresent(
  result: { ok: true; value: string | null } | { ok: false; issue: string },
): string | null {
  if (!result.ok || !result.value) {
    return null;
  }
  return result.value;
}

const rawCourseSchema = z
  .object({
    name: z.string(),
    category: z.string().nullable(),
    description: z.string().nullable(),
    duration_minutes: z.number().nullable(),
    delivery_method: z.string().nullable(),
    learning_objectives: z.string().nullable(),
  })
  .strict();

const rawRequirementSchema = z
  .object({
    course_name: z.string(),
    suggested_job_function: z.string(),
    mandatory: z.boolean(),
    notes: z.string().nullable(),
  })
  .strict();

const rawCurriculumSchema = z
  .object({
    name: z.string(),
    description: z.string().nullable(),
    requirements: z.array(rawRequirementSchema),
  })
  .strict()
  .nullable();

export const rawTrainingBuilderProposalSchema = z
  .object({
    title: z.string(),
    courses: z.array(rawCourseSchema),
    curriculum: rawCurriculumSchema,
    notes: z.array(z.string()),
  })
  .strict();

const understandingSchema = z
  .object({
    operation: z.string().nullable(),
    audience: z.string().nullable(),
    delivery: z.string().nullable(),
    compliance: z.string().nullable(),
    curriculum: z.string().nullable(),
  })
  .strict();

export const rawTrainingBuilderEnvelopeSchema = z.object({
  message: z.string(),
  phase: z.enum(["discovery", "proposal"]),
  understanding: understandingSchema,
  questions: z.array(
    z.object({
      question: z.string(),
      suggested_answers: z.array(z.string()),
    }),
  ),
  change_summary: z.array(z.string()),
  proposal: rawTrainingBuilderProposalSchema.nullable(),
});

const FORBIDDEN_PROPOSAL =
  /schedule session|mark complete|publish now|employee id|competent employee/i;

export function validateTrainingBuilderProposal(
  raw: z.infer<typeof rawTrainingBuilderProposalSchema>,
):
  | { ok: true; proposal: TrainingBuilderProposal }
  | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const title = boundedText(raw.title, LIMITS.nameMax, true);
  if (!title.ok) issues.push("Proposal title is missing or too long.");
  if (
    raw.courses.length < LIMITS.minCourses ||
    raw.courses.length > LIMITS.maxCourses
  ) {
    issues.push(
      `Use between ${LIMITS.minCourses} and ${LIMITS.maxCourses} courses.`,
    );
  }

  const courses: TrainingBuilderProposal["courses"] = [];
  const courseNames = new Set<string>();
  for (const course of raw.courses) {
    const name = requirePresent(boundedText(course.name, LIMITS.nameMax, true));
    const category = boundedText(course.category ?? "", 120, false);
    const description = boundedText(
      course.description ?? "",
      LIMITS.textMax,
      false,
    );
    const objectives = boundedText(
      course.learning_objectives ?? "",
      LIMITS.textMax,
      false,
    );
    const delivery = boundedText(course.delivery_method ?? "", 40, false);
    if (!name || !category.ok || !description.ok || !objectives.ok) {
      issues.push("A course name or field is missing or too long.");
      continue;
    }
    if (FORBIDDEN_PROPOSAL.test(name)) {
      issues.push("A course cannot record completions or permissions.");
    }
    courseNames.add(name.toLowerCase());
    const duration =
      typeof course.duration_minutes === "number" &&
      Number.isInteger(course.duration_minutes) &&
      course.duration_minutes > 0
        ? course.duration_minutes
        : null;
    courses.push({
      name,
      category: category.value || null,
      description: description.value || null,
      durationMinutes: duration,
      deliveryMethod: delivery.ok ? delivery.value || null : null,
      learningObjectives: objectives.value || null,
    });
  }

  let curriculum: TrainingBuilderProposal["curriculum"] = null;
  if (raw.curriculum) {
    const curriculumName = requirePresent(
      boundedText(raw.curriculum.name, LIMITS.nameMax, true),
    );
    const curriculumDescription = boundedText(
      raw.curriculum.description ?? "",
      LIMITS.textMax,
      false,
    );
    if (
      !curriculumName ||
      !curriculumDescription.ok ||
      raw.curriculum.requirements.length > LIMITS.maxRequirements
    ) {
      issues.push("Curriculum is incomplete or has too many requirements.");
    } else {
      const requirements: Array<{
        courseName: string;
        suggestedJobFunction: string;
        mandatory: boolean;
        notes: string | null;
      }> = [];
      for (const requirement of raw.curriculum.requirements) {
        const courseName = requirePresent(
          boundedText(requirement.course_name, LIMITS.nameMax, true),
        );
        const role = requirePresent(
          boundedText(requirement.suggested_job_function, LIMITS.nameMax, true),
        );
        const notes = boundedText(
          requirement.notes ?? "",
          LIMITS.textMax,
          false,
        );
        if (!courseName || !role || !notes.ok) {
          issues.push("A requirement is missing a course or job function.");
          continue;
        }
        if (!courseNames.has(courseName.toLowerCase())) {
          issues.push(
            `Requirement course "${courseName}" is not in the catalogue.`,
          );
        }
        requirements.push({
          courseName,
          suggestedJobFunction: role,
          mandatory: requirement.mandatory,
          notes: notes.value || null,
        });
      }
      curriculum = {
        name: curriculumName,
        description: curriculumDescription.value || null,
        requirements,
      };
    }
  }

  const notes = raw.notes
    .flatMap((note) => {
      const text = requirePresent(boundedText(note, 240, false));
      return text ? [text] : [];
    })
    .slice(0, 8);
  const titleText = requirePresent(title);

  if (!titleText || issues.length > 0) {
    return {
      ok: false,
      issues: issues.length > 0 ? issues : ["Proposal is incomplete."],
    };
  }

  return {
    ok: true,
    proposal: { title: titleText, courses, curriculum, notes },
  };
}

export function parseTrainingBuilderEnvelope(value: unknown):
  | {
      ok: true;
      envelope: {
        message: string;
        phase: "discovery" | "proposal";
        understanding: Record<string, string | null>;
        questions: Array<{ question: string; suggestedAnswers: string[] }>;
        changeSummary: string[];
        proposal: TrainingBuilderProposal | null;
        proposalStatus: "none" | "valid" | "invalid";
        proposalIssues: string[];
      };
    }
  | { ok: false; issues: string[] } {
  const parsed = rawTrainingBuilderEnvelopeSchema.safeParse(
    normalizeTrainingBuilderProviderEnvelope(value),
  );
  if (!parsed.success) {
    return {
      ok: false,
      issues: formatTrainingEnvelopeParseIssues(parsed.error),
    };
  }
  const message = requirePresent(boundedText(parsed.data.message, 2000, true));
  if (!message) {
    return { ok: false, issues: ["LeanAI's message was empty or too long."] };
  }
  let proposal: TrainingBuilderProposal | null = null;
  let proposalStatus: "none" | "valid" | "invalid" = "none";
  let proposalIssues: string[] = [];
  if (parsed.data.proposal) {
    const validated = validateTrainingBuilderProposal(parsed.data.proposal);
    if (validated.ok) {
      proposal = validated.proposal;
      proposalStatus = "valid";
    } else {
      proposalStatus = "invalid";
      proposalIssues = validated.issues;
    }
  }
  return {
    ok: true,
    envelope: {
      message,
      phase: parsed.data.phase,
      understanding: parsed.data.understanding,
      questions: normalizeModuleSetupDiscoveryQuestions(parsed.data.questions),
      changeSummary: parsed.data.change_summary,
      proposal,
      proposalStatus,
      proposalIssues,
    },
  };
}

export function revalidateStoredTrainingProposal(
  value: unknown,
): TrainingBuilderProposal | null {
  const parsed = rawTrainingBuilderProposalSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const validated = validateTrainingBuilderProposal(parsed.data);
  return validated.ok ? validated.proposal : null;
}

export function trainingProposalToDefinition(input: {
  proposal: TrainingBuilderProposal;
  roleMappings: readonly RoleMapping[];
  allowedJobFunctionIds: ReadonlySet<string>;
  existingCourseCodes: readonly string[];
  existingCurriculumCodes: readonly string[];
}):
  | { ok: true; definition: TrainingSetupDefinition }
  | { ok: false; message: string } {
  const codes = [...input.existingCourseCodes];
  const courses = input.proposal.courses.map((course) => {
    const code = resolveUniqueTrainingCourseCode(
      generateTrainingCourseCode(course.name),
      codes,
    );
    codes.push(code);
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
  const codeByName = new Map(
    courses.map((course) => [course.name.trim().toLowerCase(), course.code]),
  );
  const mappedRoles = new Map(
    input.roleMappings.map((mapping) => [
      mapping.suggestedRole.trim().toLowerCase(),
      mapping.jobFunctionId,
    ]),
  );
  const unresolved: TrainingSetupDefinition["unresolved_roles"] = [];
  let curriculum: TrainingSetupDefinition["curriculum"] = null;

  if (input.proposal.curriculum) {
    const curriculumCode = resolveTrainingCurriculumCreateCode({
      name: input.proposal.curriculum.name,
      existingCodes: input.existingCurriculumCodes,
    });
    if (!curriculumCode.ok) {
      return { ok: false, message: curriculumCode.message };
    }
    const requirements: NonNullable<
      TrainingSetupDefinition["curriculum"]
    >["requirements"] = [];
    for (const requirement of input.proposal.curriculum.requirements) {
      const jobFunctionId =
        mappedRoles.get(
          requirement.suggestedJobFunction.trim().toLowerCase(),
        ) ?? null;
      const courseCode = codeByName.get(
        requirement.courseName.trim().toLowerCase(),
      );
      if (!courseCode) {
        return {
          ok: false,
          message:
            "A requirement refers to a course that is not in the proposal.",
        };
      }
      if (!jobFunctionId) {
        unresolved.push({
          suggested_role: requirement.suggestedJobFunction,
          reason:
            "Not mapped to an existing job function. No requirement was created for this role.",
        });
        continue;
      }
      if (!input.allowedJobFunctionIds.has(jobFunctionId)) {
        return {
          ok: false,
          message: "Choose a job function from this organisation.",
        };
      }
      requirements.push({
        course_code: courseCode,
        job_function_id: jobFunctionId,
        organisational_unit_id: null,
        mandatory: requirement.mandatory,
        notes: requirement.notes,
      });
    }
    curriculum = {
      name: input.proposal.curriculum.name,
      code: curriculumCode.code,
      description: input.proposal.curriculum.description,
      requirements,
    };
  }

  const parsed = trainingSetupDefinitionSchema.safeParse({
    source: "leanai",
    template_key: TRAINING_BUILDER_DECLARED_KEY,
    template_version: "leanai",
    title: input.proposal.title,
    sample: false,
    courses,
    curriculum,
    unresolved_roles: unresolved,
  });
  if (!parsed.success) {
    return { ok: false, message: "This proposal could not become a draft." };
  }
  return { ok: true, definition: parsed.data };
}
