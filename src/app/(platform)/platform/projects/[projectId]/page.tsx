import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { callBenefitRpc } from "@/lib/benefits/supabase-untyped";
import type { LinkedBenefitSummary } from "@/lib/benefits/types";
import { callProjectRpc, untypedFrom } from "@/lib/projects/supabase-untyped";
import type { ProjectDetail } from "@/lib/projects/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: detail, error } = await callProjectRpc<ProjectDetail>(
    supabase,
    "get_ci_project_detail",
    { target_project_id: projectId },
  );

  if (error || !detail) notFound();

  const canManage = await currentMemberHasPermission("projects.manage");

  const { data: unitRow } = await supabase
    .from("organisation_units")
    .select("name")
    .eq("id", detail.unit_id)
    .maybeSingle();

  let methodologyLabel: string | null = null;
  if (detail.methodology_version_id) {
    const { data: versionRow } = await untypedFrom(
      supabase,
      "ci_project_methodology_versions",
    )
      .select("methodology_id, version_number")
      .eq("id", detail.methodology_version_id)
      .maybeSingle();

    if (versionRow) {
      const version = versionRow as {
        methodology_id: string;
        version_number: number;
      };
      const { data: methodologyRow } = await untypedFrom(
        supabase,
        "ci_project_methodologies",
      )
        .select("name")
        .eq("id", version.methodology_id)
        .maybeSingle();

      if (methodologyRow) {
        methodologyLabel = `${(methodologyRow as { name: string }).name} v${version.version_number}`;
      }
    }
  }

  const membershipIds = [
    ...new Set(detail.team_members.map((member) => member.membership_id)),
  ];
  const membershipNameById = new Map<string, string>();

  if (membershipIds.length > 0) {
    const { data: membershipRows } = await supabase
      .from("organisation_memberships")
      .select("id, display_name")
      .in("id", membershipIds);

    for (const row of membershipRows ?? []) {
      membershipNameById.set(row.id, row.display_name ?? row.id.slice(0, 8));
    }
  }

  const activeOwner = detail.team_members.find(
    (member) => member.team_role === "owner" && member.valid_to == null,
  );
  const ownerName = activeOwner
    ? (membershipNameById.get(activeOwner.membership_id) ?? null)
    : null;

  const currentPhase =
    detail.phases.find((phase) => phase.status === "in_progress") ??
    detail.phases.find((phase) => phase.status === "not_started");

  const { data: actionContexts } = await untypedFrom(
    supabase,
    "ci_project_action_context",
  )
    .select("action_id, project_phase_id")
    .eq("project_id", projectId);

  const contexts =
    (actionContexts as Array<{
      action_id: string;
      project_phase_id: string | null;
    }> | null) ?? [];
  const actionIds = contexts.map((row) => row.action_id);
  let actions: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    project_phase_id: string | null;
  }> = [];

  if (actionIds.length > 0) {
    const { data: actionRows } = await supabase
      .from("actions")
      .select("id, title, status, priority")
      .in("id", actionIds);

    actions =
      actionRows?.map((action) => ({
        ...action,
        project_phase_id:
          contexts.find((ctx) => ctx.action_id === action.id)
            ?.project_phase_id ?? null,
      })) ?? [];
  }

  const { data: evidence } = await untypedFrom(
    supabase,
    "ci_project_evidence_links",
  )
    .select("id, attachment_id, project_phase_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const evidenceRows =
    (evidence as Array<{
      id: string;
      attachment_id: string;
      project_phase_id: string | null;
      created_at: string;
    }> | null) ?? [];

  const attachmentIds = evidenceRows.map((row) => row.attachment_id);
  const attachmentFilenameById = new Map<string, string>();

  if (attachmentIds.length > 0) {
    const { data: attachmentRows } = await supabase
      .from("attachments")
      .select("id, filename")
      .in("id", attachmentIds);

    for (const row of attachmentRows ?? []) {
      attachmentFilenameById.set(row.id, row.filename);
    }
  }

  const enrichedEvidence = evidenceRows.map((row) => ({
    ...row,
    filename: attachmentFilenameById.get(row.attachment_id) ?? "Attachment",
  }));

  const enrichedTeam = detail.team_members.map((member) => ({
    ...member,
    display_name:
      membershipNameById.get(member.membership_id) ??
      member.membership_id.slice(0, 8),
  }));

  const { data: projectBenefitsData } = await callBenefitRpc<{
    items: LinkedBenefitSummary[];
  }>(supabase, "get_project_benefits", { target_project_id: projectId });
  const benefits = projectBenefitsData?.items ?? [];

  return (
    <div data-testid="project-detail-page">
      <ProjectWorkspace
        detail={detail}
        actions={actions}
        evidence={enrichedEvidence}
        teamMembers={enrichedTeam}
        benefits={benefits}
        unitName={unitRow?.name ?? null}
        methodologyLabel={methodologyLabel}
        currentPhaseTitle={currentPhase?.title_snapshot ?? null}
        ownerName={ownerName}
        canManage={canManage}
      />
      <Link
        href="/platform/projects"
        className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
      >
        Back to projects
      </Link>
    </div>
  );
}
