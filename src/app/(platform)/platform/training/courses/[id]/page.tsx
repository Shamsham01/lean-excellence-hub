import { notFound } from "next/navigation";

import { AuthoringSaveFeedback } from "@/components/authoring/authoring-save-feedback";
import { CourseDraftEditor } from "@/components/training/course-draft-editor";
import { CourseSuccessorForm } from "@/components/training/course-successor-form";
import { OrganisationCatalogueScopeNotice } from "@/components/training/organisation-catalogue-scope-notice";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAuthoringSavedKey } from "@/lib/authoring/authoring-query";
import { requireQuerySuccess } from "@/modules/organisation/applicability-selection";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  formatTrainingCourseVersionStatus,
  formatTrainingDeliveryMethod,
  trainingCoursePublishReadiness,
} from "@/modules/training/catalog-admin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const [{ context }, canManageCatalog] = await Promise.all([
    loadActiveSiteContext(),
    currentMemberHasPermission(TRAINING_PERMISSIONS.catalogManage),
  ]);

  const { data: course, error: courseError } = await supabase
    .from("training_courses")
    .select("id, name, code, description, category")
    .eq("id", id)
    .maybeSingle();

  requireQuerySuccess(courseError, course, "Failed to load training course");
  if (!course) notFound();

  const { data: versions, error: versionsError } = await supabase
    .from("training_course_versions")
    .select(
      "id, version_number, status, validity_days, duration_minutes, delivery_method, learning_objectives, trainer_requirements",
    )
    .eq("course_id", id)
    .order("version_number", { ascending: false });

  const loadedVersions = requireQuerySuccess(
    versionsError,
    versions ?? [],
    "Failed to load training course versions",
  );

  const draftVersion = loadedVersions.find(
    (version) => version.status === "draft",
  );
  const publishedVersion = loadedVersions.find(
    (version) => version.status === "published",
  );
  const publishReadiness = draftVersion
    ? trainingCoursePublishReadiness({
        validityDays: draftVersion.validity_days,
        durationMinutes: draftVersion.duration_minutes,
        deliveryMethod: draftVersion.delivery_method,
        learningObjectives: draftVersion.learning_objectives,
      })
    : null;

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="training-course-detail-page"
    >
      <AuthoringSaveFeedback savedKey={savedKey} />
      <PageHeader
        title={course.name}
        description={course.description ?? course.code}
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

      <OrganisationCatalogueScopeNotice context={context} />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Code: {course.code}</span>
        {course.category ? <span>· {course.category}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {loadedVersions.map((version) => (
          <Badge key={version.id} variant="outline">
            v{version.version_number} ·{" "}
            {formatTrainingCourseVersionStatus(
              version.status as "draft" | "published" | "archived",
            )}
          </Badge>
        ))}
      </div>

      {canManageCatalog && publishedVersion && !draftVersion ? (
        <CourseSuccessorForm courseId={id} />
      ) : null}

      {draftVersion && canManageCatalog ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft version {draftVersion.version_number}</CardTitle>
          </CardHeader>
          <CardContent>
            <CourseDraftEditor
              courseId={id}
              versionId={draftVersion.id}
              versionNumber={draftVersion.version_number}
              initialValidityDays={draftVersion.validity_days}
              initialDurationMinutes={draftVersion.duration_minutes}
              initialDeliveryMethod={draftVersion.delivery_method}
              initialLearningObjectives={draftVersion.learning_objectives}
              initialTrainerRequirements={draftVersion.trainer_requirements}
              recommendations={publishReadiness?.recommendations ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

      {publishedVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Published version {publishedVersion.version_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              This version is active in the organisation training catalogue.
            </p>
            <p>
              <span className="text-muted-foreground">Validity:</span>{" "}
              {publishedVersion.validity_days
                ? `${publishedVersion.validity_days} days`
                : "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Duration:</span>{" "}
              {publishedVersion.duration_minutes
                ? `${publishedVersion.duration_minutes} minutes`
                : "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Delivery:</span>{" "}
              {formatTrainingDeliveryMethod(publishedVersion.delivery_method)}
            </p>
            {publishedVersion.learning_objectives ? (
              <div>
                <p className="text-muted-foreground">Learning objectives</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {publishedVersion.learning_objectives}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!canManageCatalog && !draftVersion && !publishedVersion ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This course has no published version yet.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
