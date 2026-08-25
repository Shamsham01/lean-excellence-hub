import Link from "next/link";

import { TrainingMatrix } from "@/components/training/training-matrix";
import { PageHeader } from "@/components/platform/page-header";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type DirectoryPerson = {
  membership_id: string;
  display_name: string | null;
};

async function listMatrixMemberships(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data: directory, error } = await supabase.rpc(
    "get_people_directory",
    {
      target_page: 1,
      target_page_size: 100,
    },
  );

  const directoryObj = directory as { people?: DirectoryPerson[] } | null;
  if (!error && directoryObj?.people?.length) {
    return directoryObj.people.map((person) => ({
      id: person.membership_id,
      display_name: person.display_name,
    }));
  }

  const { data: memberships } = await supabase
    .from("organisation_memberships")
    .select("id, display_name")
    .eq("status", "active")
    .order("display_name")
    .limit(25);

  return memberships ?? [];
}

export default async function TrainingMatrixPage() {
  const supabase = await createServerSupabaseClient();

  const memberships = await listMatrixMemberships(supabase);

  const { data: courses } = await supabase
    .from("training_courses")
    .select("id, name")
    .eq("status", "active")
    .order("name")
    .limit(12);

  const { data: curriculumVersion } = await supabase
    .from("training_curriculum_versions")
    .select("id")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();

  const requirements = curriculumVersion?.id
    ? ((
        await supabase
          .from("training_requirements")
          .select("id, course_id, mandatory")
          .eq("curriculum_version_id", curriculumVersion.id)
      ).data ?? [])
    : [];

  const completionRows = await supabase
    .from("training_completions")
    .select("membership_id, course_id, status, expires_at")
    .eq("status", "completed");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Training matrix"
        description="Who needs what training, and where are the gaps?"
        actions={
          <Link
            href="/platform/training"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to training
          </Link>
        }
      />
      <TrainingMatrix
        memberships={memberships ?? []}
        courses={courses ?? []}
        requirements={requirements}
        completions={completionRows.data ?? []}
      />
    </div>
  );
}
