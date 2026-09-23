import { notFound } from "next/navigation";

import { createCourseSuccessorFromForm } from "@/app/(platform)/platform/training/actions";
import { AuthoringSaveFeedback } from "@/components/authoring/authoring-save-feedback";
import { CourseDraftEditor } from "@/components/training/course-draft-editor";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAuthoringSavedKey } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  parseTrainingEvidenceNotes,
  trainingCourseVersionStatusLabel,
  trainingDeliveryMethodLabel,
} from "@/modules/training/catalog-admin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function optionalDisplay(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return "Not specified";
  }

  return String(value);
}

export default async function TrainingCourseDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const savedKey = parseAuthoringSavedKey(
    Array.isArray(query.saved) ? query.saved[0] : query.saved,
  );
  const supabase = await createServerSupabaseClient();
  const canManageCatalog = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.catalogManage,
  );

  const { data: course } = await supabase
    .from("training_courses")
    .select("id, name, code, description, category, status")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  const { data: versions } = await supabase
    .from("training_course_versions")
    .select(
      "id, version_number, status, validity_days, duration_minutes, delivery_method, learning_objectives, trainer_requirements, evidence_requirements",
    )
    .eq("course_id", id)
    .order("version_number", { ascending: false });

  const draftVersion = versions?.find((version) => version.status === "draft");
  const publishedVersion = versions?.find(
    (version) => version.status === "published",
  );
  const hasPublished = Boolean(publishedVersion);
  const hasDraft = Boolean(draftVersion);

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="training-course-detail-page"
    >
      <AuthoringSaveFeedback savedKey={savedKey} />
      <PageHeader
        title={course.name}
        description={course.description ?? "Organisation training course"}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/training/courses"
              data-testid="training-course-back-link"
            >
              Back to courses
            </AppLink>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span data-testid="training-course-code">{course.code}</span>
        {course.category ? <span>{course.category}</span> : null}
        <Badge
          variant={hasPublished ? "success" : "secondary"}
          data-testid="training-course-current-status"
        >
          {hasDraft && hasPublished
            ? "Published · successor draft"
            : hasPublished
              ? "Published"
              : "Draft"}
        </Badge>
      </div>

      {canManageCatalog && hasPublished && !hasDraft ? (
        <form action={createCourseSuccessorFromForm}>
          <input type="hidden" name="courseId" value={id} />
          <Button
            type="submit"
            variant="outline"
            className="min-h-11"
            data-testid="create-course-successor"
          >
            Create successor version
          </Button>
        </form>
      ) : null}

      {canManageCatalog && draftVersion ? (
        <CourseDraftEditor
          courseId={course.id}
          versionId={draftVersion.id}
          initialValues={{
            durationMinutes: draftVersion.duration_minutes
              ? String(draftVersion.duration_minutes)
              : "",
            validityDays: draftVersion.validity_days
              ? String(draftVersion.validity_days)
              : "",
            deliveryMethod: draftVersion.delivery_method ?? "",
            learningObjectives: draftVersion.learning_objectives ?? "",
            trainerRequirements: draftVersion.trainer_requirements ?? "",
            evidenceNotes: parseTrainingEvidenceNotes(
              draftVersion.evidence_requirements,
            ),
          }}
        />
      ) : null}

      {publishedVersion ? (
        <Card data-testid="training-course-published-content">
          <CardHeader>
            <CardTitle>
              Published version {publishedVersion.version_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>
              Duration: {optionalDisplay(publishedVersion.duration_minutes)}{" "}
              {publishedVersion.duration_minutes ? "minutes" : ""}
            </p>
            <p>
              Validity: {optionalDisplay(publishedVersion.validity_days)}{" "}
              {publishedVersion.validity_days ? "days" : ""}
            </p>
            <p>
              Delivery method:{" "}
              {publishedVersion.delivery_method
                ? trainingDeliveryMethodLabel(publishedVersion.delivery_method)
                : "Not specified"}
            </p>
            <p>
              Learning objectives:{" "}
              {optionalDisplay(publishedVersion.learning_objectives)}
            </p>
            <p>
              Trainer requirements:{" "}
              {optionalDisplay(publishedVersion.trainer_requirements)}
            </p>
            <p>
              Evidence requirements:{" "}
              {optionalDisplay(
                parseTrainingEvidenceNotes(
                  publishedVersion.evidence_requirements,
                ) || null,
              )}
            </p>
            <p className="text-muted-foreground">
              Published content is read-only. Create a successor version to
              prepare the next change.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {versions?.map((version) => (
              <li
                key={version.id}
                className="rounded-md border border-border px-4 py-3"
                data-testid={`training-course-version-${version.version_number}`}
              >
                Version {version.version_number} —{" "}
                {trainingCourseVersionStatusLabel(version.status)}
                {version.validity_days
                  ? ` · Valid ${version.validity_days} days`
                  : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
