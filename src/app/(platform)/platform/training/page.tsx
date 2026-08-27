import Link from "next/link";

import { MetricCard } from "@/components/platform/metric-card";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingOverviewPage() {
  const supabase = await createServerSupabaseClient();
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
    .limit(10);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Training"
        description="Catalogue, curriculum, sessions, and compliance tracking."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/training/matrix">Training matrix</Link>
          </Button>
        }
      />

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
            {courses?.map((course) => (
              <Link
                key={course.id}
                href={`/platform/training/courses/${course.id}`}
                className="block rounded-md px-2 py-2 text-sm hover:bg-surface"
              >
                {course.name}
              </Link>
            ))}
            <Link
              href="/platform/training/courses"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all courses
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/platform/training/curriculum"
              className="text-sm hover:underline"
            >
              Curriculum editor
            </Link>
            <Link
              href="/platform/training/sessions"
              className="text-sm hover:underline"
            >
              Training sessions
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
