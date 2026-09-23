import type { Json } from "@/platform/supabase/database.types";

export type TrainingCourseVersionStatus = "draft" | "published" | "archived";

export type TrainingCourseDraftFields = {
  courseId: string;
  versionId: string;
  deliveryMethod: string;
  learningObjectives: string;
  trainerRequirements: string;
  durationMinutes: string;
  validityDays: string;
};

export type TrainingCourseDraftFormState = TrainingCourseDraftFields & {
  error?: string;
};

export type TrainingCourseDraftUpdateArgs = {
  target_course_version_id: string;
  target_delivery_method?: string;
  target_duration_minutes?: number;
  target_evidence_requirements?: Json;
  target_learning_objectives?: string;
  target_trainer_requirements?: string;
  target_validity_days?: number;
};

export type TrainingCourseListItem = {
  id: string;
  name: string;
  code: string;
  category: string | null;
  latestVersionStatus: TrainingCourseVersionStatus | null;
  latestVersionNumber: number | null;
};

export const TRAINING_DELIVERY_METHODS = [
  { value: "classroom", label: "Classroom" },
  { value: "workshop", label: "Workshop" },
  { value: "coaching", label: "Coaching" },
  { value: "practical", label: "Practical / on-the-job" },
  { value: "online", label: "Online" },
  { value: "external", label: "External provider" },
  { value: "blended", label: "Blended" },
] as const;

export function formatTrainingCourseVersionStatus(
  status: TrainingCourseVersionStatus | null | undefined,
): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return "Unknown";
  }
}

export function formatTrainingDeliveryMethod(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Not set";
  }
  return (
    TRAINING_DELIVERY_METHODS.find((method) => method.value === value)?.label ??
    value
  );
}

export function trainingCourseEmptyStateMessage(canManage: boolean): {
  title: string;
  description: string;
} {
  if (canManage) {
    return {
      title: "No training courses yet",
      description:
        "Create your first course to start building the organisation training catalogue. Courses are shared across all sites.",
    };
  }

  return {
    title: "No training courses yet",
    description:
      "Your organisation has not published any training courses in the catalogue.",
  };
}

export function buildTrainingCourseListItems(
  courses: Array<{
    id: string;
    name: string;
    code: string;
    category: string | null;
  }>,
  versions: Array<{
    course_id: string;
    version_number: number;
    status: TrainingCourseVersionStatus;
  }>,
): TrainingCourseListItem[] {
  const latestVersionByCourse = new Map<
    string,
    { version_number: number; status: TrainingCourseVersionStatus }
  >();

  for (const version of versions) {
    const existing = latestVersionByCourse.get(version.course_id);
    if (!existing || version.version_number > existing.version_number) {
      latestVersionByCourse.set(version.course_id, {
        version_number: version.version_number,
        status: version.status,
      });
    }
  }

  return courses.map((course) => {
    const latest = latestVersionByCourse.get(course.id);
    return {
      ...course,
      latestVersionNumber: latest?.version_number ?? null,
      latestVersionStatus: latest?.status ?? null,
    };
  });
}

export function trainingCoursePublishReadiness(input: {
  validityDays: number | null;
  durationMinutes: number | null;
  deliveryMethod: string | null;
  learningObjectives: string | null;
}): { ready: boolean; recommendations: string[] } {
  const recommendations: string[] = [];

  if (!input.validityDays) {
    recommendations.push("Set how long the qualification remains valid.");
  }
  if (!input.durationMinutes) {
    recommendations.push("Add an estimated duration to help planners.");
  }
  if (!input.deliveryMethod) {
    recommendations.push("Choose a delivery method.");
  }
  if (!input.learningObjectives?.trim()) {
    recommendations.push("Describe the learning objectives.");
  }

  return {
    ready: true,
    recommendations,
  };
}

function readDraftField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function emptyTrainingCourseDraftFields(): TrainingCourseDraftFields {
  return {
    courseId: "",
    versionId: "",
    deliveryMethod: "",
    learningObjectives: "",
    trainerRequirements: "",
    durationMinutes: "",
    validityDays: "",
  };
}

export function readTrainingCourseDraftFields(
  formData: FormData,
): TrainingCourseDraftFields {
  return {
    courseId: readDraftField(formData, "courseId"),
    versionId: readDraftField(formData, "versionId"),
    deliveryMethod: readDraftField(formData, "deliveryMethod"),
    learningObjectives: readDraftField(formData, "learningObjectives"),
    trainerRequirements: readDraftField(formData, "trainerRequirements"),
    durationMinutes: readDraftField(formData, "durationMinutes"),
    validityDays: readDraftField(formData, "validityDays"),
  };
}

function parsePositiveNumber(
  raw: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (!raw) {
    return { ok: true, value: null };
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return {
      ok: false,
      message: `${label} must be a positive number.`,
    };
  }

  return { ok: true, value };
}

export function parseTrainingCourseDraftFields(
  formData: FormData,
):
  | { ok: true; fields: TrainingCourseDraftFields }
  | { ok: false; fields: TrainingCourseDraftFields; message: string } {
  const fields = readTrainingCourseDraftFields(formData);

  if (!fields.courseId || !fields.versionId) {
    return { ok: false, fields, message: "Course version is required." };
  }

  const duration = parsePositiveNumber(fields.durationMinutes, "Duration");
  if (!duration.ok) {
    return { ok: false, fields, message: duration.message };
  }

  const validity = parsePositiveNumber(fields.validityDays, "Validity");
  if (!validity.ok) {
    return { ok: false, fields, message: validity.message };
  }

  return { ok: true, fields };
}

export function resolveTrainingCourseDraftIntent(
  formData: FormData,
): "save" | "publish" {
  return readDraftField(formData, "intent") === "publish" ? "publish" : "save";
}

export function buildTrainingCourseDraftUpdateArgs(
  fields: TrainingCourseDraftFields,
  evidenceRequirements: Json | null,
): TrainingCourseDraftUpdateArgs {
  const duration = fields.durationMinutes
    ? Number(fields.durationMinutes)
    : null;
  const validity = fields.validityDays ? Number(fields.validityDays) : null;

  return {
    target_course_version_id: fields.versionId,
    ...(duration != null && Number.isFinite(duration)
      ? { target_duration_minutes: duration }
      : {}),
    ...(fields.learningObjectives
      ? { target_learning_objectives: fields.learningObjectives }
      : {}),
    ...(validity != null && Number.isFinite(validity)
      ? { target_validity_days: validity }
      : {}),
    ...(fields.deliveryMethod
      ? { target_delivery_method: fields.deliveryMethod }
      : {}),
    ...(fields.trainerRequirements
      ? { target_trainer_requirements: fields.trainerRequirements }
      : {}),
    ...(evidenceRequirements != null
      ? { target_evidence_requirements: evidenceRequirements }
      : {}),
  };
}

export function mapTrainingCourseActionError(message: string): string {
  const normalised = message.toLowerCase();

  if (
    normalised.includes("duplicate key") &&
    normalised.includes("training_courses_organisation_id_code_key")
  ) {
    return "A course with this code already exists. Choose a different code or name.";
  }
  if (normalised.includes("training_courses_code_check")) {
    return "Use lowercase letters, numbers, dots, hyphens, or underscores. Start with a letter or number.";
  }
  if (
    normalised.includes("training course creation is not authorised") ||
    normalised.includes("training course update is not authorised") ||
    normalised.includes("training course publish is not authorised") ||
    normalised.includes("training course successor creation is not authorised")
  ) {
    return "Training catalogue management is not authorised.";
  }
  if (normalised.includes("draft course version not found")) {
    return "This draft can no longer be edited. Reload the course and try again.";
  }
  if (normalised.includes("published course version not found")) {
    return "A published version is required before creating a successor.";
  }
  if (normalised.includes("draft course version already exists")) {
    return "A draft successor already exists for this course.";
  }

  return message;
}
