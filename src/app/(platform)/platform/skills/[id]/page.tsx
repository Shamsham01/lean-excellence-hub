import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: skill } = await supabase
    .from("skills")
    .select("id, name, code, category, description, status")
    .eq("id", id)
    .maybeSingle();

  if (!skill) notFound();

  return (
    <div className="flex flex-col gap-6" data-testid="skills-detail-page">
      <PageHeader
        title={skill.name}
        description={skill.description ?? skill.code}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/skills/catalog"
              data-testid="skills-detail-back-link"
            >
              Back to catalogue
            </AppLink>
          </Button>
        }
      />
      <dl className="grid gap-3 rounded-lg border border-border px-4 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-medium">{skill.code}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{skill.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Category</dt>
          <dd className="font-medium">{skill.category ?? "—"}</dd>
        </div>
      </dl>
      <AppLink
        href="/platform/skills/matrix"
        className="text-sm text-primary hover:underline"
        data-testid="skills-detail-matrix-link"
      >
        Open skills matrix
      </AppLink>
    </div>
  );
}
