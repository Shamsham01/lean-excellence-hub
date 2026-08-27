import { PageHeader } from "@/components/platform/page-header";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function TrainingCoursesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name, code, category")
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Training courses"
        description="Organisation training catalogue."
      />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {courses?.map((course) => (
            <a
              key={course.id}
              href={`/platform/training/courses/${course.id}`}
              className="flex min-h-11 items-center justify-between px-4 py-3 hover:bg-surface"
            >
              <span>{course.name}</span>
              <span className="text-sm text-muted-foreground">
                {course.code}
              </span>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
