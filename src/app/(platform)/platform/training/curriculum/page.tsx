import { PageHeader } from "@/components/platform/page-header";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function TrainingCurriculumPage() {
  const supabase = await createServerSupabaseClient();
  const { data: curricula } = await supabase
    .from("training_curricula")
    .select("id, name, code")
    .eq("status", "active");

  const publishedVersion = curricula?.[0]
    ? (
        await supabase
          .from("training_curriculum_versions")
          .select("id")
          .eq("curriculum_id", curricula[0].id)
          .eq("status", "published")
          .maybeSingle()
      ).data
    : null;

  const requirements = publishedVersion?.id
    ? (
        await supabase
          .from("training_requirements")
          .select("id, course_id, job_function_id, mandatory")
          .eq("curriculum_version_id", publishedVersion.id)
      ).data
    : [];

  const jobFunctions = await supabase
    .from("job_functions")
    .select("id, name")
    .eq("status", "active");

  const courses = await supabase.from("training_courses").select("id, name");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Training curriculum"
        description="Job function training requirements for the published curriculum."
      />
      <div className="space-y-4">
        {jobFunctions.data?.map((jf) => (
          <section key={jf.id} className="rounded-lg border border-border p-4">
            <h2 className="font-semibold">{jf.name}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {requirements
                ?.filter((r) => r.job_function_id === jf.id)
                .map((req) => {
                  const course = courses.data?.find((c) => c.id === req.course_id);
                  return (
                    <li key={req.id}>
                      {course?.name ?? req.course_id}
                      {req.mandatory ? " (mandatory)" : ""}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
