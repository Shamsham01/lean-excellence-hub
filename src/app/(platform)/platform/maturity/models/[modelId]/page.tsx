import { notFound, redirect } from "next/navigation";

import {
  createSuccessorVersion,
  deactivateFrameworkVersion,
  deleteDraftVersion,
} from "../../actions";
import { PageHeader } from "@/components/platform/page-header";
import { FrameworkEditor } from "@/components/maturity/framework-editor";
import { PublishedFrameworkInspector } from "@/components/maturity/published-framework-inspector";
import { loadFrameworkStructure } from "@/modules/maturity/load-framework-structure";
import { Badge } from "@/components/ui/badge";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  scopeTypeLabel,
  type MaturityAssessmentScopeType,
} from "@/modules/maturity/semantic-scope";
import { parseAuthoringStep } from "@/lib/authoring/authoring-query";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const FRAMEWORK_AUTHORING_STEPS = [
  "details",
  "scopes",
  "levels",
  "pillars",
  "criteria",
  "questions",
  "review",
  "publish",
] as const;

export default async function MaturityModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { modelId } = await params;
  const query = await searchParams;
  const initialAuthoringStep = parseAuthoringStep(
    Array.isArray(query.step) ? query.step[0] : query.step,
    FRAMEWORK_AUTHORING_STEPS,
    "details",
  );
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

  let publishedLevels: typeof levels = [];
  let publishedPillars: typeof pillars = [];
  let publishedCriteria: typeof criteria = [];
  let publishedQuestions: typeof questions = [];

  if (draftVersion) {
    const draftStructure = await loadFrameworkStructure(
      supabase,
      draftVersion.id,
    );
    levels = draftStructure.levels;
    pillars = draftStructure.pillars;
    criteria.push(...draftStructure.criteria);
    questions.push(...draftStructure.questions);
  }

  if (publishedVersion) {
    const publishedStructure = await loadFrameworkStructure(
      supabase,
      publishedVersion.id,
    );
    publishedLevels = publishedStructure.levels;
    publishedPillars = publishedStructure.pillars;
    publishedCriteria = publishedStructure.criteria;
    publishedQuestions = publishedStructure.questions;
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
    <div
      className="flex flex-col gap-8"
      data-testid="maturity-model-detail-page"
    >
      <PageHeader
        title={model.display_name}
        description={model.description ?? "Framework configuration"}
        actions={
          <Button variant="outline" asChild>
            <AppLink
              href="/platform/maturity/models"
              data-testid="maturity-model-back-link"
            >
              All frameworks
            </AppLink>
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

      {draftVersion && canManage ? (
        <>
          <FrameworkEditor
            modelId={modelId}
            modelName={versionDisplayName}
            modelDescription={versionDescription}
            versionId={draftVersion.id}
            versionNumber={draftVersion.version_number}
            initialAuthoringStep={initialAuthoringStep}
            assessmentScopes={assessmentScopes}
            levels={levels}
            pillars={pillars}
            criteria={criteria}
            questions={questions}
            activeVersion={
              publishedVersion
                ? {
                    versionNumber: publishedVersion.version_number,
                    pillars: publishedPillars,
                    criteria: publishedCriteria,
                    questions: publishedQuestions,
                  }
                : null
            }
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

      {publishedVersion ? (
        <>
          <Card
            className={draftVersion && canManage ? "border-dashed" : undefined}
            data-testid="active-published-version"
          >
            <CardHeader>
              <CardTitle data-testid="active-version-heading">
                Active version {publishedVersion.version_number} — Published
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Assessment scope:{" "}
                {publishedScopes.map(scopeTypeLabel).join(", ")}
              </p>
              {draftVersion && canManage ? (
                <p className="text-sm text-muted-foreground">
                  Historical reference for version{" "}
                  {publishedVersion.version_number}. Editing happens in Draft
                  version {draftVersion.version_number}.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <AppLink
                    href={`/platform/maturity/assessments/new?versionId=${publishedVersion.id}`}
                    data-testid="maturity-model-start-assessment-link"
                  >
                    Start assessment
                  </AppLink>
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
          {draftVersion && canManage ? (
            <details data-testid="active-version-disclosure">
              <summary className="cursor-pointer text-sm font-medium">
                View active version
              </summary>
              <div className="mt-4">
                <PublishedFrameworkInspector
                  versionNumber={publishedVersion.version_number}
                  levels={publishedLevels}
                  pillars={publishedPillars}
                  criteria={publishedCriteria}
                  questions={publishedQuestions}
                />
              </div>
            </details>
          ) : (
            <PublishedFrameworkInspector
              versionNumber={publishedVersion.version_number}
              levels={publishedLevels}
              pillars={publishedPillars}
              criteria={publishedCriteria}
              questions={publishedQuestions}
            />
          )}
        </>
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

      {!draftVersion && !publishedVersion ? (
        <p className="text-sm text-muted-foreground">
          No framework versions are available.
        </p>
      ) : null}
    </div>
  );
}
