import { notFound } from "next/navigation";

import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { AppLink } from "@/components/ui/app-link";
import { callBenefitRpc } from "@/lib/benefits/supabase-untyped";
import type { LinkedBenefitSummary } from "@/lib/benefits/types";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
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
  const canCreateBenefit = await currentMemberHasPermission("benefits.create");
  const canUploadEvidence =
    await currentMemberHasPermission("attachments.upload");
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });

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
    action_number: string | null;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    due_at: string | null;
    project_phase_id: string | null;
  }> = [];

  if (actionIds.length > 0) {
    const { data: actionRows } = await supabase
      .from("actions")
      .select("id, action_number, title, status, priority, created_at, due_at")
      .in("id", actionIds);

    actions =
      actionRows?.map((action) => ({
        ...action,
        project_phase_id:
          contexts.find((ctx) => ctx.action_id === action.id)
            ?.project_phase_id ?? null,
      })) ?? [];
  }

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_membership_id")
    .eq("target_resource_id", projectId)
    .order("created_at");

  const { data: evidenceLinks } = await untypedFrom(
    supabase,
    "ci_project_evidence_links",
  )
    .select("attachment_id")
    .eq("project_id", projectId);

  const linkedAttachmentIds = new Set(
    ((evidenceLinks as Array<{ attachment_id: string }> | null) ?? []).map(
      (row) => row.attachment_id,
    ),
  );

  const { data: attachmentRows } = await supabase
    .from("attachments")
    .select("id, filename, mime_type, byte_size")
    .eq("target_resource_id", projectId)
    .eq("lifecycle", "active")
    .order("created_at");

  const evidence: EvidenceItem[] = (attachmentRows ?? [])
    .filter((item) => item.byte_size != null)
    .map((item) => ({
      id: item.id,
      filename: item.filename,
      mime_type: item.mime_type,
      byte_size: item.byte_size as number,
    }));

  if (linkedAttachmentIds.size > 0) {
    const missingIds = [...linkedAttachmentIds].filter(
      (id) => !evidence.some((item) => item.id === id),
    );
    if (missingIds.length > 0) {
      const { data: linkedRows } = await supabase
        .from("attachments")
        .select("id, filename, mime_type, byte_size")
        .in("id", missingIds)
        .eq("lifecycle", "active");
      for (const item of linkedRows ?? []) {
        if (item.byte_size == null) continue;
        evidence.push({
          id: item.id,
          filename: item.filename,
          mime_type: item.mime_type,
          byte_size: item.byte_size as number,
        });
      }
    }
  }

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
        evidence={evidence}
        comments={(comments ?? []) as CommentRow[]}
        teamMembers={enrichedTeam}
        benefits={benefits}
        unitName={unitRow?.name ?? null}
        methodologyLabel={methodologyLabel}
        currentPhaseTitle={currentPhase?.title_snapshot ?? null}
        ownerName={ownerName}
        canManage={canManage}
        canCreateBenefit={canCreateBenefit}
        canUploadEvidence={canUploadEvidence}
        people={selectorOptions.people}
        methodologies={methodologyOptions}
        requiresSiteSelection={selectorOptions.requiresSiteSelection}
      />
      <AppLink
        href="/platform/projects"
        className="mt-6 inline-block text-sm text-muted-foreground hover:underline"
        data-testid="projects-back-link"
      >
        Back to projects
      </AppLink>
    </div>
  );
}
