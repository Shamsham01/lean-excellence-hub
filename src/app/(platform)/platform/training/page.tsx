import { GraduationCap } from "lucide-react";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { TrainingCatalogueScopeNote } from "@/components/training/training-catalogue-scope-note";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingOverviewPage() {
  const supabase = await createServerSupabaseClient();
  const [canManageCatalog, { context }] = await Promise.all([
    currentMemberHasPermission(TRAINING_PERMISSIONS.catalogManage),
    loadActiveSiteContext(),
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

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name, code")
    .eq("status", "active")
    .order("name")
    .limit(10);

  const activeSiteName =
    context.mode === "site"
      ? (context.sites.find((site) => site.id === context.activeSiteId)?.name ??
        null)
      : null;

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
                  href="/platform/training/courses?new=1"
                  data-testid="training-hub-new-course-link"
                >
                  New course
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

      {activeSiteName ? (
        <TrainingCatalogueScopeNote siteName={activeSiteName} />
      ) : null}

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
            {(courses?.length ?? 0) === 0 ? (
              <div
                className="flex flex-col items-start gap-3 rounded-md border border-dashed border-border px-3 py-6"
                data-testid="training-hub-empty-courses"
              >
                <GraduationCap className="size-5 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">No courses yet</p>
                  <p className="text-sm text-muted-foreground">
                    {canManageCatalog
                      ? "Create the first course in the organisation catalogue."
                      : "No courses are available in the organisation catalogue yet."}
                  </p>
                </div>
                {canManageCatalog ? (
                  <Button asChild>
                    <AppLink href="/platform/training/courses?new=1">
                      New course
                    </AppLink>
                  </Button>
                ) : null}
              </div>
            ) : (
              courses?.map((course) => (
                <AppLink
                  key={course.id}
                  href={`/platform/training/courses/${course.id}`}
                  className="block rounded-md px-2 py-2 text-sm hover:bg-surface"
                  data-testid={`training-hub-course-link-${course.id}`}
                >
                  {course.name}
                </AppLink>
              ))
            )}
            <AppLink
              href="/platform/training/courses"
              className="text-sm text-muted-foreground hover:text-foreground"
              data-testid="training-courses-link"
            >
              {canManageCatalog ? "Manage catalogue" : "View all courses"}
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
