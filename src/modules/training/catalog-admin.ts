import type { Json } from "@/platform/supabase/database.types";

export const TRAINING_DELIVERY_METHODS = [
  "classroom",
  "workshop",
  "coaching",
  "practical",
  "online",
  "external",
  "blended",
] as const;

export type TrainingDeliveryMethod = (typeof TRAINING_DELIVERY_METHODS)[number];

export type TrainingCourseVersionStatus = "draft" | "published" | "archived";

export type TrainingCourseCatalogueStatus =
  "draft" | "published" | "published_with_draft" | "deactivated";

export function isTrainingDeliveryMethod(
  value: string | null | undefined,
): value is TrainingDeliveryMethod {
  return (
    typeof value === "string" &&
    TRAINING_DELIVERY_METHODS.includes(value as TrainingDeliveryMethod)
  );
}

export function trainingDeliveryMethodLabel(method: string): string {
  switch (method) {
    case "classroom":
      return "Classroom";
    case "workshop":
      return "Workshop";
    case "coaching":
      return "Coaching";
    case "practical":
      return "Practical";
    case "online":
      return "Online";
    case "external":
      return "External";
    case "blended":
      return "Blended";
    default:
      return method;
  }
}

export function trainingCourseVersionStatusLabel(status: string): string {
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

export function deriveTrainingCourseCatalogueStatus(input: {
  courseStatus: string;
  versionStatuses: readonly string[];
}): TrainingCourseCatalogueStatus {
  if (input.courseStatus === "deactivated") {
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

export function trainingCourseCatalogueStatusLabel(
  status: TrainingCourseCatalogueStatus,
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

export function trainingCoursePublishGuidance(): string {
  return "The existing publish contract does not require extra fields. Publishing makes this version available for sessions and curriculum. Published versions cannot be edited in place; create a successor draft to change them later.";
}

export function isTrainingEvidenceObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseTrainingEvidenceNotes(
  evidenceRequirements: unknown,
): string {
  if (
    isTrainingEvidenceObject(evidenceRequirements) &&
    "notes" in evidenceRequirements
  ) {
    const notes = evidenceRequirements.notes;
    return typeof notes === "string" ? notes : "";
  }

  return "";
}

export function buildTrainingEvidenceRequirements(
  notes: string | null | undefined,
  existing?: unknown,
): Json {
  const current: Record<string, Json> = isTrainingEvidenceObject(existing)
    ? { ...(existing as Record<string, Json>) }
    : {};
  const trimmed = notes?.trim() ?? "";

  if (trimmed) {
    current.notes = trimmed;
  } else {
    delete current.notes;
  }

  return Object.keys(current).length > 0 ? current : null;
}

export function optionalPositiveInteger(
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

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      ok: false,
      message:
        "Duration and validity must be blank or a positive whole number.",
    };
  }

  return { ok: true, value: parsed };
}

export function trainingCatalogueScopeMessage(
  siteName?: string | null,
): string {
  if (siteName?.trim()) {
    return `The training catalogue is organisation-wide. Selecting ${siteName.trim()} does not filter these courses.`;
  }

  return "The training catalogue is organisation-wide. The active site does not filter these courses.";
}
