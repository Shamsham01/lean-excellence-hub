import { PageHeader } from "@/components/platform/page-header";
import { EmptyState } from "@/components/platform/empty-state";
import { CreateCourseForm } from "@/components/training/create-course-form";
import { OrganisationCatalogueScopeNotice } from "@/components/training/organisation-catalogue-scope-notice";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  buildTrainingCourseListItems,
  formatTrainingCourseVersionStatus,
  trainingCourseEmptyStateMessage,
} from "@/modules/training/catalog-admin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingCoursesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ context }, canManageCatalog] = await Promise.all([
    loadActiveSiteContext(),
    currentMemberHasPermission(TRAINING_PERMISSIONS.catalogManage),
  ]);

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name, code, category")
    .order("name");

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: versions } =
    courseIds.length > 0
      ? await supabase
          .from("training_course_versions")
          .select("course_id, version_number, status")
          .in("course_id", courseIds)
      : { data: [] };

  const listItems = buildTrainingCourseListItems(
    courses ?? [],
    (versions ?? []).map((version) => ({
      ...version,
      status: version.status as "draft" | "published" | "archived",
    })),
  );
  const existingCodes = (courses ?? []).map((course) => course.code);
  const emptyState = trainingCourseEmptyStateMessage(canManageCatalog);

  return (
    <div className="flex flex-col gap-8" data-testid="training-courses-page">
      <PageHeader
        title="Training courses"
        description="Organisation-wide training catalogue."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/training"
              data-testid="training-courses-back-link"
            >
              Back to training
            </AppLink>
          </Button>
        }
      />

      <OrganisationCatalogueScopeNotice context={context} />

      {canManageCatalog ? (
        <Card>
          <CardHeader>
            <CardTitle>New course</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCourseForm existingCodes={existingCodes} />
          </CardContent>
        </Card>
      ) : null}

      {listItems.length === 0 ? (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Catalogue</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {listItems.map((course) => (
              <AppLink
                key={course.id}
                href={`/platform/training/courses/${course.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface"
                data-testid={`training-course-link-${course.id}`}
              >
                <div className="min-w-0">
                  <p className="font-medium">{course.name}</p>
                  {course.category ? (
                    <p className="text-sm text-muted-foreground">
                      {course.category}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {course.latestVersionStatus ? (
                    <Badge
                      variant={
                        course.latestVersionStatus === "published"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {formatTrainingCourseVersionStatus(
                        course.latestVersionStatus,
                      )}
                      {course.latestVersionNumber
                        ? ` v${course.latestVersionNumber}`
                        : ""}
                    </Badge>
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {course.code}
                  </span>
                </div>
              </AppLink>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
