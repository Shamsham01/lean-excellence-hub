import { PageHeader } from "@/components/platform/page-header";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SkillsCatalogPage() {
  const supabase = await createServerSupabaseClient();
  const { data: skills } = await supabase
    .from("skills")
    .select("id, name, code, category")
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Skills catalogue" description="Organisation-defined operational skills." />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {skills?.map((skill) => (
          <li key={skill.id} className="px-4 py-3 text-sm">
            <a href={`/platform/skills/${skill.id}`} className="font-medium hover:underline">
              {skill.name}
            </a>
            <span className="ml-2 text-muted-foreground">{skill.code}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
