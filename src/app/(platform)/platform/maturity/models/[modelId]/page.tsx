import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  createSuccessorVersion,
  deactivateFrameworkVersion,
  deleteDraftVersion,
} from "../../actions";
import { PageHeader } from "@/components/platform/page-header";
import { FrameworkEditor } from "@/components/maturity/framework-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  scopeTypeLabel,
  type MaturityAssessmentScopeType,
} from "@/modules/maturity/semantic-scope";
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
  const latestArchivedVersion = versions?.find((v) => v.status === "archived");

  let assessmentScopes: MaturityAssessmentScopeType[] = ["site"];
  let levels: Array<{
    id: string;
    level_number: number;
    name: string;
    color_token: string;
    description: string | null;
    guidance: string | null;
  }> = [];
  let pillars: Array<{
    id: string;
    name: string;
    position: number;
    section_id: string;
    description: string | null;
    guidance: string | null;
  }> = [];
  const criteria: Array<{
    id: string;
    name: string;
    pillar_id: string;
    position: number;
    description: string | null;
    guidance: string | null;
  }> = [];
  const questions: Array<{
    id: string;
    prompt: string;
    criterion_id: string;
    position: number;
  }> = [];

  const editorVersion = draftVersion ?? publishedVersion;
  let versionDisplayName = model.display_name;
  let versionDescription = model.description;

  if (draftVersion) {
    const { data: draftMeta } = await supabase
      .from("maturity_model_versions")
      .select("display_name, description")
      .eq("id", draftVersion.id)
      .maybeSingle();
    if (draftMeta?.display_name) {
      versionDisplayName = draftMeta.display_name;
      versionDescription = draftMeta.description;
    }
  }

  if (editorVersion) {
    const { data: scopeRows } = await supabase
      .from("maturity_model_version_assessment_scopes")
      .select("scope_type")
      .eq("model_version_id", editorVersion.id);
    assessmentScopes = scopeRows?.map(
      (row) => row.scope_type as MaturityAssessmentScopeType,
    ) ?? ["site"];
  }

  if (draftVersion) {
    const { data: levelRows } = await supabase
      .from("maturity_levels")
      .select("id, level_number, name, color_token, description, guidance")
      .eq("model_version_id", draftVersion.id)
      .order("level_number");
    levels = levelRows ?? [];

    const { data: pillarRows } = await supabase
      .from("maturity_pillars")
      .select("id, name, position, section_id, description, guidance")
      .eq("model_version_id", draftVersion.id)
      .order("position");
    pillars = pillarRows ?? [];

    for (const pillar of pillars) {
      const { data: criterionRows } = await supabase
        .from("maturity_criteria")
        .select("id, name, pillar_id, position, description, guidance")
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
            .select("id, prompt, position")
            .eq("id", link.question_id)
            .maybeSingle();
          if (q) {
            questions.push({
              id: q.id,
              prompt: q.prompt,
              criterion_id: criterion.id,
              position: q.position,
            });
          }
        }
      }
    }
  }

  let publishedScopes: MaturityAssessmentScopeType[] = ["site"];
  if (publishedVersion) {
    const { data: publishedScopeRows } = await supabase
      .from("maturity_model_version_assessment_scopes")
      .select("scope_type")
      .eq("model_version_id", publishedVersion.id);
    publishedScopes = publishedScopeRows?.map(
      (row) => row.scope_type as MaturityAssessmentScopeType,
    ) ?? ["site"];
  }

  async function createSuccessorAction() {
    "use server";
    await createSuccessorVersion(modelId);
  }

  async function deactivateAction() {
    "use server";
    if (publishedVersion) {
      await deactivateFrameworkVersion(publishedVersion.id, modelId);
    }
  }

  async function deleteDraftAction() {
    "use server";
    if (!draftVersion) {
      return;
    }

    const result = await deleteDraftVersion(draftVersion.id, modelId);
    if (result?.error) {
      return;
    }

    redirect("/platform/maturity/models");
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
          <Badge
            key={v.id}
            variant={
              v.status === "published"
                ? "success"
                : v.status === "archived"
                  ? "secondary"
                  : "outline"
            }
          >
            v{v.version_number} · {v.status}
          </Badge>
        ))}
      </div>

      {publishedVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Active version {publishedVersion.version_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Assessment scope: {publishedScopes.map(scopeTypeLabel).join(", ")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  href={`/platform/maturity/assessments/new?versionId=${publishedVersion.id}`}
                >
                  Start assessment
                </Link>
              </Button>
              {canManage ? (
                <>
                  <form action={createSuccessorAction}>
                    <Button
                      type="submit"
                      variant="outline"
                      data-testid="create-successor-version"
                    >
                      Create new version
                    </Button>
                  </form>
                  <form action={deactivateAction}>
                    <Button type="submit" variant="outline">
                      Deactivate
                    </Button>
                  </form>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!publishedVersion && latestArchivedVersion && canManage ? (
        <Card data-testid="archived-framework-recovery">
          <CardHeader>
            <CardTitle>
              Framework inactive — version{" "}
              {latestArchivedVersion.version_number} archived
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Create a new draft from the latest archived version to continue
              configuring and publishing this framework.
            </p>
            <form action={createSuccessorAction}>
              <Button
                type="submit"
                variant="outline"
                data-testid="create-successor-from-archived"
              >
                Create new version from archived
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {draftVersion && canManage ? (
        <>
          <FrameworkEditor
            modelId={modelId}
            modelName={versionDisplayName}
            modelDescription={versionDescription}
            versionId={draftVersion.id}
            versionNumber={draftVersion.version_number}
            assessmentScopes={assessmentScopes}
            levels={levels}
            pillars={pillars}
            criteria={criteria}
            questions={questions}
          />
          <form action={deleteDraftAction}>
            <Button
              type="submit"
              variant="destructive"
              data-testid="delete-draft-version"
            >
              Delete draft version
            </Button>
          </form>
        </>
      ) : null}

      {!draftVersion && !publishedVersion ? (
        <p className="text-sm text-muted-foreground">
          No framework versions are available.
        </p>
      ) : null}
    </div>
  );
}
