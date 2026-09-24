export type TrainingCurriculumVersionStatus =
  "draft" | "published" | "archived";

export type TrainingCurriculumCatalogueStatus =
  "draft" | "published" | "published_with_draft" | "deactivated";

export type TrainingRequirementApplicabilityMode =
  "all_members" | "job_function" | "job_function_and_unit";

export type TrainingRequirementTargetInput = {
  courseId: string;
  appliesToAllMembers: boolean;
  jobFunctionId: string | null;
  organisationalUnitId: string | null;
};

export function deriveTrainingCurriculumCatalogueStatus(input: {
  curriculumStatus: string;
  versionStatuses: readonly string[];
}): TrainingCurriculumCatalogueStatus {
  if (input.curriculumStatus === "deactivated") {
    return "deactivated";
  }

  const hasPublished = input.versionStatuses.includes("published");
  const hasDraft = input.versionStatuses.includes("draft");

  if (hasPublished && hasDraft) {
    return "published_with_draft";
  }

  if (hasPublished) {
    return "published";
  }

  return "draft";
}

export function trainingCurriculumCatalogueStatusLabel(
  status: TrainingCurriculumCatalogueStatus,
): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "published_with_draft":
      return "Published · successor draft";
    case "deactivated":
      return "Deactivated";
  }
}

export function trainingCurriculumVersionStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function trainingCurriculumScopeMessage(siteName?: string | null) {
  const siteClause = siteName?.trim()
    ? `Selecting ${siteName.trim()} does not filter who a requirement applies to.`
    : "The active site does not filter who a requirement applies to.";

  return `Curriculum management is organisation-wide. ${siteClause} A recorded organisational unit does not currently restrict compliance; job-function requirements apply across the organisation.`;
}

export function trainingCurriculumPublishGuidance() {
  return "Publishing makes this draft the current curriculum for compliance. Published versions cannot be edited in place; create a successor draft to change them later.";
}

export function resolveTrainingRequirementApplicabilityMode(input: {
  appliesToAllMembers: boolean;
  jobFunctionId?: string | null;
  organisationalUnitId?: string | null;
}): TrainingRequirementApplicabilityMode {
  if (input.appliesToAllMembers) {
    return "all_members";
  }

  if (input.organisationalUnitId) {
    return "job_function_and_unit";
  }

  return "job_function";
}

export function describeTrainingRequirementApplicability(input: {
  appliesToAllMembers: boolean;
  jobFunctionName?: string | null;
  organisationalUnitName?: string | null;
}): string {
  if (input.appliesToAllMembers) {
    return "Everyone in the organisation needs this course.";
  }

  const jobFunction =
    input.jobFunctionName?.trim() || "the selected job function";

  if (input.organisationalUnitName?.trim()) {
    return `Stored for ${jobFunction} in ${input.organisationalUnitName.trim()}. Current compliance still applies this requirement to people with that primary job function across the organisation.`;
  }

  return `People whose primary job function is ${jobFunction} need this course.`;
}

export function describeTrainingCourseValidity(input: {
  courseValidityDays?: number | null;
  overrideDays?: number | null;
}): string {
  const courseLabel =
    input.courseValidityDays != null
      ? `This course version is valid for ${input.courseValidityDays} days after completion.`
      : "This course version does not set an expiry.";

  if (input.overrideDays != null) {
    return `${courseLabel} A curriculum override of ${input.overrideDays} days is stored on this requirement. Completion recording uses an explicitly supplied override or the course-version validity; it does not automatically load this curriculum override.`;
  }

  return `${courseLabel} Leave the override blank to store no curriculum-specific value. Completions still use the course-version validity unless an override is supplied when the completion is recorded.`;
}

export function describeTrainingRequirementDeadlineGuidance() {
  return "Stored on this requirement as a planned completion deadline. Current compliance does not use this field to mark training due.";
}

export function describeTrainingRequirementGraceGuidance() {
  return "Stored on this requirement as a planned grace period. Current compliance and completion recording do not apply this field.";
}

export function trainingRequirementTimingLimitation() {
  return "Deadline, validity override, and grace period are stored on the requirement. Completions today use an explicitly supplied override or the course-version validity. Compliance does not currently use these timing fields.";
}

export function trainingCurriculumPublishAfterSaveError(publishError: string) {
  return `The requirement was saved, but the curriculum could not be published. ${publishError}`;
}

export function optionalNonNegativeInteger(
  value: string | number | null | undefined,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value == null) {
    return { ok: true, value: null };
  }

  const raw = typeof value === "number" ? String(value) : value.trim();

  if (!raw) {
    return { ok: true, value: null };
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      ok: false,
      message: "Grace period must be blank or zero or a positive whole number.",
    };
  }

  return { ok: true, value: parsed };
}

export function trainingRequirementIdentityKey(
  input: TrainingRequirementTargetInput,
): string {
  return [
    input.courseId,
    input.appliesToAllMembers ? "all" : "scoped",
    input.jobFunctionId ?? "",
    input.organisationalUnitId ?? "",
  ].join(":");
}

export function findOverlappingTrainingRequirement<
  T extends TrainingRequirementTargetInput & { id?: string },
>(
  candidate: TrainingRequirementTargetInput & { id?: string },
  existing: readonly T[],
): T | undefined {
  const candidateKey = trainingRequirementIdentityKey(candidate);

  return existing.find((requirement) => {
    if (candidate.id && requirement.id === candidate.id) {
      return false;
    }

    return trainingRequirementIdentityKey(requirement) === candidateKey;
  });
}

export function resolveTrainingRequirementTarget(input: {
  courseId: string;
  applicabilityMode: TrainingRequirementApplicabilityMode | string;
  jobFunctionId?: string | null;
  organisationalUnitId?: string | null;
}):
  | { ok: true; value: TrainingRequirementTargetInput }
  | { ok: false; message: string } {
  const courseId = input.courseId.trim();
  if (!courseId) {
    return { ok: false, message: "Choose a course." };
  }

  if (input.applicabilityMode === "all_members") {
    return {
      ok: true,
      value: {
        courseId,
        appliesToAllMembers: true,
        jobFunctionId: null,
        organisationalUnitId: null,
      },
    };
  }

  const jobFunctionId = input.jobFunctionId?.trim() || null;
  if (!jobFunctionId) {
    return { ok: false, message: "Choose a job function." };
  }

  if (input.applicabilityMode === "job_function") {
    return {
      ok: true,
      value: {
        courseId,
        appliesToAllMembers: false,
        jobFunctionId,
        organisationalUnitId: null,
      },
    };
  }

  if (input.applicabilityMode === "job_function_and_unit") {
    const organisationalUnitId = input.organisationalUnitId?.trim() || null;
    if (!organisationalUnitId) {
      return { ok: false, message: "Choose an organisational unit." };
    }

    return {
      ok: true,
      value: {
        courseId,
        appliesToAllMembers: false,
        jobFunctionId,
        organisationalUnitId,
      },
    };
  }

  return {
    ok: false,
    message: "Choose who this requirement applies to.",
  };
}

export function trainingRequirementFormHasUnsavedContent(input: {
  courseId: string;
  jobFunctionId: string;
  organisationalUnitId: string;
  requiredWithinDays: string;
  validityDaysOverride: string;
  gracePeriodDays: string;
  notes: string;
}): boolean {
  return Boolean(
    input.courseId.trim() ||
    input.jobFunctionId.trim() ||
    input.organisationalUnitId.trim() ||
    input.requiredWithinDays.trim() ||
    input.validityDaysOverride.trim() ||
    input.gracePeriodDays.trim() ||
    input.notes.trim(),
  );
}
