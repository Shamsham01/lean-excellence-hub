import { CourseCreateForm } from "@/components/training/course-create-form";
import { TrainingCatalogueScopeNote } from "@/components/training/training-catalogue-scope-note";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  deriveTrainingCourseCatalogueStatus,
  trainingCourseCatalogueStatusLabel,
} from "@/modules/training/catalog-admin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainingCoursesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const newRequested = Array.isArray(query.new) ? query.new[0] : query.new;
  const supabase = await createServerSupabaseClient();
  const [canManageCatalog, { context }] = await Promise.all([
    currentMemberHasPermission(TRAINING_PERMISSIONS.catalogManage),
    loadActiveSiteContext(),
  ]);

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name, code, category, status")
    .order("name");

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: versions } =
    courseIds.length > 0
      ? await supabase
          .from("training_course_versions")
          .select("course_id, status")
          .in("course_id", courseIds)
      : { data: [] };

  const versionsByCourse = new Map<string, string[]>();
  for (const version of versions ?? []) {
    const existing = versionsByCourse.get(version.course_id) ?? [];
    existing.push(version.status);
    versionsByCourse.set(version.course_id, existing);
  }

  const isEmpty = (courses?.length ?? 0) === 0;
  const showCreateForm = canManageCatalog && (isEmpty || newRequested === "1");
  const activeSiteName =
    context.mode === "site"
      ? (context.sites.find((site) => site.id === context.activeSiteId)?.name ??
        null)
      : null;

  return (
    <div className="flex flex-col gap-8" data-testid="training-courses-page">
      <PageHeader
        title="Training catalogue"
        description="Organisation-wide courses available for curriculum, sessions, and compliance."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageCatalog && !showCreateForm ? (
              <CourseCreateForm
                existingCodes={courses?.map((course) => course.code) ?? []}
              />
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/training"
                data-testid="training-courses-back-link"
              >
                Back to training
              </AppLink>
            </Button>
          </div>
        }
      />

      {activeSiteName ? (
        <TrainingCatalogueScopeNote siteName={activeSiteName} />
      ) : (
        <p className="text-sm text-muted-foreground">
          This catalogue is shared across the organisation.
        </p>
      )}

      {canManageCatalog && showCreateForm ? (
        <CourseCreateForm
          existingCodes={courses?.map((course) => course.code) ?? []}
          defaultExpanded
        />
      ) : null}

      {isEmpty && !showCreateForm ? (
        <Card
          className="border-dashed bg-surface"
          data-testid="training-courses-empty"
        >
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex max-w-md flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">
                No training courses yet
              </h2>
              <p className="text-sm text-muted-foreground">
                The organisation has not published a training catalogue yet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isEmpty && showCreateForm ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="training-courses-empty"
        >
          Create the first course to start the organisation training catalogue.
          You can save a draft, then publish it when it is ready.
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {courses?.map((course) => {
              const status = deriveTrainingCourseCatalogueStatus({
                courseStatus: course.status,
                versionStatuses: versionsByCourse.get(course.id) ?? [],
              });
              const statusLabel = trainingCourseCatalogueStatusLabel(status);

              return (
                <AppLink
                  key={course.id}
                  href={`/platform/training/courses/${course.id}`}
                  className="flex min-h-11 flex-col gap-2 px-4 py-3 hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`training-course-link-${course.id}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{course.name}</span>
                    {course.category ? (
                      <span className="text-sm text-muted-foreground">
                        {course.category}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{course.code}</span>
                    <Badge
                      variant={
                        status === "published" ||
                        status === "published_with_draft"
                          ? "success"
                          : "secondary"
                      }
                      data-testid={`training-course-status-${course.id}`}
                    >
                      {statusLabel}
                    </Badge>
                  </span>
                </AppLink>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
