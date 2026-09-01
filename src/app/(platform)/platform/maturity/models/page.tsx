import Link from "next/link";
import { redirect } from "next/navigation";

import { createMaturityModel } from "../actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import {
  scopeTypeLabel,
  type MaturityAssessmentScopeType,
} from "@/modules/maturity/semantic-scope";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MaturityModelsPage() {
  const canManage = await currentMemberHasPermission(
    MATURITY_PERMISSIONS.modelsManage,
  );
  const supabase = await createServerSupabaseClient();
  const { data: models } = await supabase
    .from("maturity_models")
    .select("id, display_name, description, created_at")
    .order("created_at", { ascending: false });

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

  async function createAction(formData: FormData) {
    "use server";
    const result = await createMaturityModel(formData);
    if (result.modelId) {
      redirect(`/platform/maturity/models/${result.modelId}`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Maturity frameworks"
        description="Configure pillars, criteria, assessment scopes, and questions."
        actions={
          <Button variant="outline" asChild>
            <Link href="/platform/maturity">Back to overview</Link>
          </Button>
        }
      />

      {canManage ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="text-sm font-semibold">New framework</h2>
            <form action={createAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Lean Excellence Framework"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <Button type="submit">Create draft framework</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        {models?.map((model) => {
          const published = publishedVersionByModel.get(model.id);
          const scopes = published
            ? (scopesByVersion.get(published.id) ?? ["site"])
            : ["site"];
          return (
            <Link
              key={model.id}
              href={`/platform/maturity/models/${model.id}`}
              className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted"
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
