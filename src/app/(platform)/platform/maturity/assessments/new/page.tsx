import { PageHeader } from "@/components/platform/page-header";
import { StartAssessmentForm } from "@/components/maturity/start-assessment-form";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import type { MaturityAssessmentScopeType } from "@/modules/maturity/semantic-scope";

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ versionId?: string }>;
}) {
  const { versionId } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: versionRows } = await supabase
    .from("maturity_model_versions")
    .select("id, version_number, model_id, maturity_models(display_name)")
    .eq("status", "published")
    .order("version_number", { ascending: false });

  const versionIds = versionRows?.map((v) => v.id) ?? [];
  const { data: scopeRows } =
    versionIds.length > 0
      ? await supabase
          .from("maturity_model_version_assessment_scopes")
          .select("model_version_id, scope_type")
          .in("model_version_id", versionIds)
      : { data: [] };

  const scopesByVersion = new Map<string, MaturityAssessmentScopeType[]>();
  for (const row of scopeRows ?? []) {
    const existing = scopesByVersion.get(row.model_version_id) ?? [];
    existing.push(row.scope_type as MaturityAssessmentScopeType);
    scopesByVersion.set(row.model_version_id, existing);
  }

  const versions =
    versionRows?.map((v) => ({
      id: v.id,
      version_number: v.version_number,
      display_name:
        (v.maturity_models as { display_name: string } | null)?.display_name ??
        "Framework",
      scope_types: scopesByVersion.get(v.id) ?? ["site"],
    })) ?? [];

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <PageHeader
        title="Start assessment"
        description="Select a published framework version, assessment scope, and eligible entity."
      />
      <StartAssessmentForm
        versions={versions}
        {...(versionId ? { defaultVersionId: versionId } : {})}
      />
    </div>
  );
}
