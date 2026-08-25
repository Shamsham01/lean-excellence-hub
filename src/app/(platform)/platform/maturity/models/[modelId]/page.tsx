import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { FrameworkEditor } from "@/components/maturity/framework-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MaturityModelPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );

  const { data: model } = await supabase
    .from("maturity_models")
    .select("id, display_name, description")
    .eq("id", modelId)
    .maybeSingle();

  if (!model) {
    notFound();
  }

  const { data: versions } = await supabase
    .from("maturity_model_versions")
    .select("id, version_number, status, template_version_id")
    .eq("model_id", modelId)
    .order("version_number", { ascending: false });

  const draftVersion = versions?.find((v) => v.status === "draft");
  const publishedVersion = versions?.find((v) => v.status === "published");

  let levels: Array<{ level_number: number; name: string }> = [];
  let pillars: Array<{ id: string; name: string; position: number; section_id: string }> = [];
  const criteria: Array<{ id: string; name: string; pillar_id: string; position: number }> = [];
  const questions: Array<{ id: string; prompt: string; criterion_id: string }> = [];

  if (draftVersion) {
    const { data: levelRows } = await supabase
      .from("maturity_levels")
      .select("level_number, name")
      .eq("model_version_id", draftVersion.id)
      .order("level_number");
    levels = levelRows ?? [];

    const { data: pillarRows } = await supabase
      .from("maturity_pillars")
      .select("id, name, position, section_id")
      .eq("model_version_id", draftVersion.id)
      .order("position");
    pillars = pillarRows ?? [];

    for (const pillar of pillars) {
      const { data: criterionRows } = await supabase
        .from("maturity_criteria")
        .select("id, name, pillar_id, position")
        .eq("pillar_id", pillar.id)
        .order("position");
      for (const criterion of criterionRows ?? []) {
        criteria.push(criterion);
        const { data: links } = await supabase
          .from("maturity_criterion_questions")
          .select("question_id")
          .eq("criterion_id", criterion.id)
          .eq("contributes_to_score", true);
        for (const link of links ?? []) {
          const { data: q } = await supabase
            .from("template_questions")
            .select("id, prompt")
            .eq("id", link.question_id)
            .maybeSingle();
          if (q) {
            questions.push({
              id: q.id,
              prompt: q.prompt,
              criterion_id: criterion.id,
            });
          }
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={model.display_name}
        description={model.description ?? "Framework configuration"}
        actions={
          <Button variant="outline" asChild>
            <Link href="/platform/maturity/models">All frameworks</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {versions?.map((v) => (
          <Badge key={v.id} variant={v.status === "published" ? "success" : "secondary"}>
            v{v.version_number} · {v.status}
          </Badge>
        ))}
      </div>

      {draftVersion && canManage ? (
        <FrameworkEditor
          modelId={modelId}
          modelName={model.display_name}
          modelDescription={model.description}
          versionId={draftVersion.id}
          versionNumber={draftVersion.version_number}
          levels={levels}
          pillars={pillars}
          criteria={criteria}
          questions={questions}
        />
      ) : null}

      {publishedVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>Published version {publishedVersion.version_number}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Use this version to start assessments.
            </p>
            <Button asChild>
              <Link
                href={`/platform/maturity/assessments/new?versionId=${publishedVersion.id}`}
              >
                Start assessment
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
