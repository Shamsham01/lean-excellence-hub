import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { CreateProjectWizard } from "@/components/projects/create-project-wizard";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { untypedFrom } from "@/lib/projects/supabase-untyped";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewProjectPage() {
  const canManage = await currentMemberHasPermission("projects.manage");
  if (!canManage) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });

  const { data: methodologies } = await untypedFrom(
    supabase,
    "ci_project_methodologies",
  )
    .select("id, name, code")
    .eq("status", "active")
    .order("name");

  const { data: versions } = await untypedFrom(
    supabase,
    "ci_project_methodology_versions",
  )
    .select("id, methodology_id, version_number, status")
    .eq("status", "published")
    .order("version_number");

  const methodologyRows =
    (methodologies as Array<{
      id: string;
      name: string;
      code: string;
    }> | null) ?? [];
  const versionRows =
    (versions as Array<{
      id: string;
      methodology_id: string;
      version_number: number;
    }> | null) ?? [];

  const methodologyNameById = new Map(
    methodologyRows.map((row) => [row.id, row.name]),
  );

  const methodologyOptions = versionRows.map((version) => ({
    versionId: version.id,
    label: `${methodologyNameById.get(version.methodology_id) ?? "Methodology"} v${version.version_number}`,
  }));

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-6"
      data-testid="create-project-page"
    >
      <PageHeader
        title="New improvement project"
        description="Work through the charter step by step — basics, scope, methodology, team, and measures."
      />
      <CreateProjectWizard
        units={selectorOptions.units}
        methodologies={methodologyOptions}
        members={selectorOptions.people}
        requiresSiteSelection={selectorOptions.requiresSiteSelection}
      />
    </div>
  );
}
