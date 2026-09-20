import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingCoursesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name, code, category")
    .order("name");

  return (
    <div className="flex flex-col gap-8" data-testid="training-courses-page">
      <PageHeader
        title="Training courses"
        description="Organisation training catalogue."
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
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {courses?.map((course) => (
            <AppLink
              key={course.id}
              href={`/platform/training/courses/${course.id}`}
              className="flex min-h-11 items-center justify-between px-4 py-3 hover:bg-surface"
              data-testid={`training-course-link-${course.id}`}
            >
              <span>{course.name}</span>
              <span className="text-sm text-muted-foreground">
                {course.code}
              </span>
            </AppLink>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
