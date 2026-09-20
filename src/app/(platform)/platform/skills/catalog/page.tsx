import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SkillsCatalogPage() {
  const supabase = await createServerSupabaseClient();
  const { data: skills } = await supabase
    .from("skills")
    .select("id, name, code, category")
    .order("name");

  return (
    <div className="flex flex-col gap-8" data-testid="skills-catalog-page">
      <PageHeader
        title="Skills catalogue"
        description="Organisation-defined operational skills."
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/skills"
              data-testid="skills-catalog-back-link"
            >
              Back to skills
            </AppLink>
          </Button>
        }
      />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {skills?.map((skill) => (
          <li key={skill.id} className="px-4 py-3 text-sm">
            <AppLink
              href={`/platform/skills/${skill.id}`}
              className="font-medium hover:underline"
              data-testid={`skills-catalog-link-${skill.id}`}
            >
              {skill.name}
            </AppLink>
            <span className="ml-2 text-muted-foreground">{skill.code}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
