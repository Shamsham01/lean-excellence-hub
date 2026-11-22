import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import type { MaturityAssessmentScopeType } from "@/modules/maturity/semantic-scope";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type StartAssessmentDialogProps = {
  versions: Array<{
    id: string;
    version_number: number;
    display_name: string;
    scope_types: MaturityAssessmentScopeType[];
  }>;
  people: Array<{ id: string; label: string }>;
};

export async function loadStartAssessmentDialogProps(): Promise<StartAssessmentDialogProps> {
  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions();

  const { data: versionRows } = await supabase
    .from("maturity_model_versions")
    .select("id, version_number, model_id, display_name, description")
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
      display_name: v.display_name ?? "Framework",
      scope_types: scopesByVersion.get(v.id) ?? ["site"],
    })) ?? [];

  return {
    versions,
    people: selectorOptions.people,
  };
}
