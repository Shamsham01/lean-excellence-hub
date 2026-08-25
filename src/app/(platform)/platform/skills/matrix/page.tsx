import {
  SkillsMatrix,
  type SkillsMatrixGapRow,
} from "@/components/skills/skills-matrix";
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

export default async function SkillsMatrixPage() {
  const supabase = await createServerSupabaseClient();

  const memberships = await listMatrixMemberships(supabase);

  const { data: skills } = await supabase
    .from("skills")
    .select("id, name")
    .eq("status", "active")
    .order("name")
    .limit(12);

  const gapRows: SkillsMatrixGapRow[] = await Promise.all(
    (memberships ?? []).flatMap((membership) =>
      (skills ?? []).map(async (skill) => {
        const { data } = await supabase.rpc("derive_skill_gap", {
          target_membership_id: membership.id,
          target_skill_id: skill.id,
        });
        return {
          membershipId: membership.id,
          skillId: skill.id,
          gap: data as SkillsMatrixGapRow["gap"],
        };
      }),
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Skills matrix"
        description="Current proficiency vs role requirements."
      />
      <SkillsMatrix
        memberships={memberships ?? []}
        skills={skills ?? []}
        gaps={gapRows}
      />
    </div>
  );
}
