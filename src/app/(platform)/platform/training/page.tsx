import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { EmptyState } from "@/components/platform/empty-state";
import { OrganisationCatalogueScopeNotice } from "@/components/training/organisation-catalogue-scope-notice";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireQuerySuccess } from "@/modules/organisation/applicability-selection";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { trainingCourseEmptyStateMessage } from "@/modules/training/catalog-admin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const [{ context }, canManageCatalog] = await Promise.all([
    loadActiveSiteContext(),
    currentMemberHasPermission(TRAINING_PERMISSIONS.catalogManage),
  ]);
  const { data: summary } = await supabase.rpc(
    "get_training_compliance_summary",
    {},
  );

  const summaryObj = summary as {
    compliance_percent?: number | null;
    outstanding_required?: number;
    expiring_in_30_days?: number;
  } | null;

  const compliance = summaryObj?.compliance_percent ?? null;
  const outstanding = summaryObj?.outstanding_required ?? 0;
  const expiring = summaryObj?.expiring_in_30_days ?? 0;

  const { data: courses, error: coursesError } = await supabase
    .from("training_courses")
    .select("id, name, code")
    .eq("status", "active")
    .limit(10);
  const loadedCourses = requireQuerySuccess(
    coursesError,
    courses ?? [],
    "Failed to load training courses",
  );

  const emptyState = trainingCourseEmptyStateMessage(canManageCatalog);

  return (
    <div className="flex flex-col gap-8" data-testid="training-overview">
      <PageHeader
        title="Training"
        description="Catalogue, curriculum, sessions, and compliance tracking."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageCatalog ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/training/courses"
                  data-testid="training-manage-catalogue-link"
                >
                  Manage catalogue
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/training/matrix"
                data-testid="training-matrix-link"
              >
                Training matrix
              </AppLink>
            </Button>
          </div>
        }
      />

      <OrganisationCatalogueScopeNotice context={context} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Training compliance"
          value={compliance != null ? `${compliance}%` : "—"}
        />
        <MetricCard label="Outstanding required" value={outstanding} />
        <MetricCard label="Expiring in 30 days" value={expiring} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadedCourses.length > 0 ? (
              loadedCourses.map((course) => (
                <AppLink
                  key={course.id}
                  href={`/platform/training/courses/${course.id}`}
                  className="block rounded-md px-2 py-2 text-sm hover:bg-surface"
                  data-testid={`training-hub-course-link-${course.id}`}
                >
                  {course.name}
                </AppLink>
              ))
            ) : canManageCatalog ? (
              <EmptyState
                title={emptyState.title}
                description={emptyState.description}
                actionLabel="Create your first course"
                actionHref="/platform/training/courses"
              />
            ) : (
              <EmptyState
                title={emptyState.title}
                description={emptyState.description}
              />
            )}
            <AppLink
              href="/platform/training/courses"
              className="text-sm text-muted-foreground hover:text-foreground"
              data-testid="training-courses-link"
            >
              View all courses
            </AppLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <AppLink
              href="/platform/training/curriculum"
              className="text-sm hover:underline"
              data-testid="training-curriculum-link"
            >
              Curriculum editor
            </AppLink>
            <AppLink
              href="/platform/training/sessions"
              className="text-sm hover:underline"
              data-testid="training-sessions-link"
            >
              Training sessions
            </AppLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
