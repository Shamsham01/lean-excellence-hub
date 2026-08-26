import { notFound } from "next/navigation";

import { PageHeader } from "@/components/platform/page-header";
import { CreateProjectWizard } from "@/components/projects/create-project-wizard";
import { untypedFrom } from "@/lib/projects/supabase-untyped";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function NewProjectPage() {
  const canManage = await currentMemberHasPermission("projects.manage");
  if (!canManage) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();

  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  const { data: methodologies } = await untypedFrom(supabase, "ci_project_methodologies")
    .select("id, name, code")
    .eq("status", "active")
    .order("name");

  const { data: versions } = await untypedFrom(supabase, "ci_project_methodology_versions")
    .select("id, methodology_id, version_number, status")
    .eq("status", "published")
    .order("version_number");

  const methodologyRows =
    (methodologies as Array<{ id: string; name: string; code: string }> | null) ?? [];
  const versionRows =
    (versions as Array<{
      id: string;
      methodology_id: string;
      version_number: number;
    }> | null) ?? [];

  const methodologyNameById = new Map(methodologyRows.map((row) => [row.id, row.name]));

  const methodologyOptions = versionRows.map((version) => ({
    versionId: version.id,
    label: `${methodologyNameById.get(version.methodology_id) ?? "Methodology"} v${version.version_number}`,
  }));

  const { data: memberships } = await supabase
    .from("organisation_memberships")
    .select("id, display_name, job_title")
    .eq("status", "active")
    .order("display_name");

  const memberOptions =
    memberships?.map((membership) => ({
      id: membership.id,
      label:
        membership.display_name ??
        membership.job_title ??
        membership.id.slice(0, 8),
    })) ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6" data-testid="create-project-page">
      <PageHeader
        title="New improvement project"
        description="Work through the charter step by step — basics, scope, methodology, team, and measures."
      />
      <CreateProjectWizard
        units={
          units?.map((unit) => ({
            id: unit.id,
            name: unit.name,
          })) ?? []
        }
        methodologies={methodologyOptions}
        members={memberOptions}
      />
    </div>
  );
}
