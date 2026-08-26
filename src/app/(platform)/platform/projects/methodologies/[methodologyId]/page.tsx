import Link from "next/link";
import { notFound } from "next/navigation";

import { MethodologyEditor } from "@/components/projects/methodology-editor";
import { untypedFrom } from "@/lib/projects/supabase-untyped";
import type { MethodologyPhaseRow, MethodologyVersionRow } from "@/lib/projects/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function MethodologyDetailPage({
  params,
}: {
  params: Promise<{ methodologyId: string }>;
}) {
  const { methodologyId } = await params;
  const supabase = await createServerSupabaseClient();
  const canRead = await currentMemberHasPermission("projects.read");
  const canManage = await currentMemberHasPermission("projects.manage");
  if (!canRead && !canManage) {
    notFound();
  }

  const { data: methodology } = await untypedFrom(supabase, "ci_project_methodologies")
    .select("id, name, code, description, status")
    .eq("id", methodologyId)
    .maybeSingle();

  const methodologyRow = methodology as {
    id: string;
    name: string;
    code: string;
    description: string | null;
    status: string;
  } | null;

  if (!methodologyRow) notFound();

  const { data: versions } = await untypedFrom(supabase, "ci_project_methodology_versions")
    .select("id, methodology_id, version_number, status, published_at")
    .eq("methodology_id", methodologyId)
    .order("version_number");

  const versionRows = (versions as MethodologyVersionRow[] | null) ?? [];
  const versionIds = versionRows.map((version) => version.id);
  let phases: MethodologyPhaseRow[] = [];

  if (versionIds.length > 0) {
    const { data: phaseRows } = await untypedFrom(supabase, "ci_project_methodology_phases")
      .select("id, methodology_version_id, phase_key, title, description, display_order")
      .in("methodology_version_id", versionIds)
      .order("display_order");

    phases = (phaseRows as MethodologyPhaseRow[]) ?? [];
  }

  return (
    <div data-testid="methodology-manager-page">
      <MethodologyEditor
        methodologyId={methodologyRow.id}
        methodologyName={methodologyRow.name}
        methodologyCode={methodologyRow.code}
        versions={versionRows}
        phases={phases}
        canManage={canManage}
      />
      <Link
        href="/platform/projects/methodologies"
        className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
      >
        Back to methodologies
      </Link>
    </div>
  );
}
