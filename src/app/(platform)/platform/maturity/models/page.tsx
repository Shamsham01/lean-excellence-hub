import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BuildWithLeanAiCard } from "@/components/maturity/ai-builder/build-with-leanai-card";
import { CreateMaturityFrameworkForm } from "@/components/maturity/create-maturity-framework-form";
import { MaturityQuickStartCard } from "@/components/maturity/maturity-quick-start-card";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { loadMaturityBuilderPageData } from "@/modules/maturity/ai-builder/load";
import {
  scopeTypeLabel,
  type MaturityAssessmentScopeType,
} from "@/modules/maturity/semantic-scope";
import { listMaturityFrameworkTemplates } from "@/modules/maturity/templates";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MaturityModelsPage() {
  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );
  const supabase = await createServerSupabaseClient();
  const builder = canManage ? await loadMaturityBuilderPageData() : null;
  const { data: models } = await supabase
    .from("maturity_models")
    .select("id, display_name, description, created_at")
    .order("created_at", { ascending: false });
  const templates = listMaturityFrameworkTemplates();

  const modelIds = models?.map((model) => model.id) ?? [];
  const { data: versions } =
    modelIds.length > 0
      ? await supabase
          .from("maturity_model_versions")
          .select("id, model_id, version_number, status")
          .in("model_id", modelIds)
          .order("version_number", { ascending: false })
      : { data: [] };

  const publishedVersionByModel = new Map<
    string,
    { id: string; version_number: number }
  >();
  for (const version of versions ?? []) {
    if (
      version.status === "published" &&
      !publishedVersionByModel.has(version.model_id)
    ) {
      publishedVersionByModel.set(version.model_id, {
        id: version.id,
        version_number: version.version_number,
      });
    }
  }

  const publishedVersionIds = [...publishedVersionByModel.values()].map(
    (v) => v.id,
  );
  const { data: scopeRows } =
    publishedVersionIds.length > 0
      ? await supabase
          .from("maturity_model_version_assessment_scopes")
          .select("model_version_id, scope_type")
          .in("model_version_id", publishedVersionIds)
      : { data: [] };

  const scopesByVersion = new Map<string, MaturityAssessmentScopeType[]>();
  for (const row of scopeRows ?? []) {
    const existing = scopesByVersion.get(row.model_version_id) ?? [];
    existing.push(row.scope_type as MaturityAssessmentScopeType);
    scopesByVersion.set(row.model_version_id, existing);
  }

  return (
    <div className="flex flex-col gap-8" data-testid="maturity-models-page">
      <PageHeader
        title="Maturity frameworks"
        description="Your framework. Your standards. Your way of working. Start from an LEH template, build one with LeanAI, or create it manually — every route creates an editable draft that only you publish."
        actions={
          <Button variant="outline" asChild>
            <AppLink
              href="/platform/maturity"
              data-testid="maturity-models-back-link"
            >
              Back to overview
            </AppLink>
          </Button>
        }
      />

      <section
        className="flex flex-col gap-4"
        data-testid="maturity-quick-start-section"
      >
        <div className="flex flex-col gap-1">
          <h2 className="typography-section-title">Quick Start</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Start with a practical Operational Excellence framework and tailor
            it to your organisation. The template is optional, fully editable,
            and never publishes itself.
          </p>
        </div>
        {templates.map((template) => (
          <MaturityQuickStartCard
            key={template.key}
            template={template}
            canManage={canManage}
          />
        ))}
      </section>

      {canManage && builder?.access.canManage ? (
        <section
          className="flex flex-col gap-4"
          data-testid="maturity-build-with-leanai-section"
        >
          <div className="flex flex-col gap-1">
            <h2 className="typography-section-title">Build with LeanAI</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Already have a way of assessing operations? LeanAI helps you
              translate it into levels, pillars, criteria and questions. You
              review every part, and nothing is saved until you create a draft.
            </p>
          </div>
          <BuildWithLeanAiCard
            access={builder.access}
            hasConversation={Boolean(builder.conversation?.turns.length)}
          />
        </section>
      ) : null}

      {canManage ? (
        <section
          id="maturity-manual-create"
          className="flex scroll-mt-6 flex-col gap-4"
          data-testid="maturity-manual-create-section"
        >
          <div className="flex flex-col gap-1">
            <h2 className="typography-section-title">Create manually</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Start from a blank draft if you already know the pillars, criteria
              and questions your organisation needs.
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <h3 className="text-sm font-semibold">New framework</h3>
              <CreateMaturityFrameworkForm />
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        {models?.map((model) => {
          const published = publishedVersionByModel.get(model.id);
          const scopes = published
            ? (scopesByVersion.get(published.id) ?? ["site"])
            : ["site"];
          return (
            <AppLink
              key={model.id}
              href={`/platform/maturity/models/${model.id}`}
              className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted"
              data-testid={`maturity-model-item-${model.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{model.display_name}</p>
                {published ? (
                  <Badge variant="success">
                    Active v{published.version_number}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Draft only</Badge>
                )}
              </div>
              {published ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Assessment scope:{" "}
                  {(scopes as MaturityAssessmentScopeType[])
                    .map(scopeTypeLabel)
                    .join(", ")}
                </p>
              ) : null}
              {model.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {model.description}
                </p>
              ) : null}
            </AppLink>
          );
        })}
      </div>
    </div>
  );
}
