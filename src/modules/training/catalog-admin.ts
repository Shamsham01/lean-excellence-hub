export type TrainingCourseVersionStatus = "draft" | "published" | "archived";

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
