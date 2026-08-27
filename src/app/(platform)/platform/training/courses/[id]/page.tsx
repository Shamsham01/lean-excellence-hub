import { notFound } from "next/navigation";

import { createCourseSuccessorFromForm } from "@/app/(platform)/platform/training/actions";
import { PageHeader } from "@/components/platform/page-header";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { Button } from "@/components/ui/button";

type PageProps = { params: Promise<{ id: string }> };

export default async function TrainingCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canManageCatalog = await currentMemberHasPermission(
    TRAINING_PERMISSIONS.catalogManage,
  );

  const { data: course } = await supabase
    .from("training_courses")
    .select("id, name, code, description, category")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  const { data: versions } = await supabase
    .from("training_course_versions")
    .select("id, version_number, status, validity_days, duration_minutes")
    .eq("course_id", id)
    .order("version_number", { ascending: false });

  const hasPublished = versions?.some((v) => v.status === "published");
  const hasDraft = versions?.some((v) => v.status === "draft");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={course.name}
        description={course.description ?? course.code}
      />
      {canManageCatalog && hasPublished && !hasDraft ? (
        <form action={createCourseSuccessorFromForm}>
          <input type="hidden" name="courseId" value={id} />
          <Button
            type="submit"
            variant="outline"
            data-testid="create-course-successor"
          >
            Create successor version
          </Button>
        </form>
      ) : null}
      <ul className="space-y-2 text-sm">
        {versions?.map((version) => (
          <li
            key={version.id}
            className="rounded-md border border-border px-4 py-3"
          >
            Version {version.version_number} — {version.status}
            {version.validity_days
              ? ` · Valid ${version.validity_days} days`
              : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
