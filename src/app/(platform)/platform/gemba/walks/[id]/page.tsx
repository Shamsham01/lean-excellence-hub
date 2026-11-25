import { notFound } from "next/navigation";

import { completeGembaWalk } from "@/app/(platform)/platform/gemba/actions";
import { GembaWalkSummary } from "@/components/gemba/walk-summary";
import { GembaWalkWorkspace } from "@/components/gemba/walk-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  loadWorkplaceRecordFallback,
  loadWorkplaceRecordView,
} from "@/modules/workplace/access";
import { loadProjectPickerOptions } from "@/lib/projects/load-project-picker-options";
import { resolveProjectLinkSummary } from "@/lib/projects/project-link-summary";
import type { ProjectLinkSummary } from "@/lib/projects/types";
import { untypedFrom } from "@/lib/projects/supabase-untyped";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaWalkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { id } = await params;
  const workplaceView = await loadWorkplaceRecordView({
    readPermission: GEMBA_PERMISSIONS.read,
    module: "gemba",
    recordId: id,
    title: "Gemba walk",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const { prompt } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [
    canEdit,
    { data: walk },
  ] = await Promise.all([
    currentMemberHasPermission(GEMBA_PERMISSIONS.walkPerform),
    supabase
      .from("gemba_walks")
      .select(
        "id, status, submission_id, definition_version_id, summary_notes, definition_name_snapshot, unit_name_snapshot, completed_at, site_unit_id",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!walk) {
    const workplaceRecord = await loadWorkplaceRecordFallback({
      module: "gemba",
      recordId: id,
      title: "Gemba walk",
    });
    if (workplaceRecord) return workplaceRecord;
    notFound();
  }

  const [
    { data: version },
    { data: answersRaw },
    { data: evidenceLinks },
  ] = await Promise.all([
    supabase
      .from("gemba_definition_versions")
      .select("template_version_id")
      .eq("id", walk.definition_version_id)
      .maybeSingle(),
    supabase
      .from("template_answers")
      .select("question_id, text_value, is_not_applicable")
      .eq("submission_id", walk.submission_id),
    supabase
      .from("gemba_evidence_links")
      .select("section_id, question_id, observation_id, attachment_id")
      .eq("walk_id", id),
  ]);

  const [
    { data: sectionsRaw },
    { data: questionsRaw },
  ] = await Promise.all([
    supabase
      .from("template_sections")
      .select("id, title, position")
      .eq("template_version_id", version?.template_version_id ?? "")
      .order("position", { ascending: true }),
    supabase
      .from("template_questions")
      .select(
        "id, section_id, position, prompt, question_type, help_text, is_required, allows_not_applicable",
      )
      .eq("template_version_id", version?.template_version_id ?? "")
      .order("position", { ascending: true }),
  ]);

  const sections =
    sectionsRaw?.map((s) => ({
      id: s.id,
      title: s.title,
      questions:
        questionsRaw
          ?.filter((q) => q.section_id === s.id)
          .sort((left, right) => left.position - right.position)
          .map((q) => ({
            id: q.id,
            prompt: q.prompt,
            question_type: q.question_type,
            help_text: q.help_text,
            is_required: q.is_required,
            allows_not_applicable: q.allows_not_applicable,
          })) ?? [],
    })) ?? [];

  const answers: Record<
    string,
    { text_value?: string | null; is_not_applicable?: boolean }
  > = {};
  for (const a of answersRaw ?? []) answers[a.question_id] = a;

  const attachmentIds = [
    ...new Set((evidenceLinks ?? []).map((link) => link.attachment_id)),
  ];
  const attachmentsById = new Map<
    string,
    {
      id: string;
      filename: string;
      mime_type: string;
      byte_size: number | null;
      storage_object_path: string;
    }
  >();
  if (attachmentIds.length > 0) {
    const { data: attachments } = await supabase
      .from("attachments")
      .select("id, filename, mime_type, byte_size, storage_object_path")
      .in("id", attachmentIds);
    for (const attachment of attachments ?? []) {
      attachmentsById.set(attachment.id, attachment);
    }
  }

  const evidence = [];
  for (const link of evidenceLinks ?? []) {
    const attachment = attachmentsById.get(link.attachment_id);
    if (attachment) {
      evidence.push({
        id: attachment.id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        byte_size: attachment.byte_size ?? 0,
        storage_object_path: attachment.storage_object_path,
        question_id: link.question_id,
        section_id: link.section_id,
        observation_id: link.observation_id,
      });
    }
  }

  const [projectPicker, observationsResult, gembaActionContexts] =
    await Promise.all([
      loadProjectPickerOptions(),
      untypedFrom(supabase, "gemba_walk_observations")
        .select(
          "id, question_id, client_request_id, observation_text, observation_type, created_at, linked_project_id",
        )
        .eq("walk_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("gemba_action_context")
        .select("observation_id")
        .eq("walk_id", id),
    ]);
  const observations = observationsResult.data;

  const actionCountsByObservation: Record<string, number> = {};
  for (const row of gembaActionContexts.data ?? []) {
    if (!row.observation_id) continue;
    actionCountsByObservation[row.observation_id] =
      (actionCountsByObservation[row.observation_id] ?? 0) + 1;
  }

  const linkedProjectsByObservationId: Record<
    string,
    ProjectLinkSummary | null
  > = {};
  for (const observation of observations ?? []) {
    linkedProjectsByObservationId[observation.id] = resolveProjectLinkSummary(
      observation.linked_project_id,
      projectPicker.projects,
    );
  }

  if (walk.status === "completed") {
    return (
      <div
        className="flex flex-col gap-8"
        data-testid="gemba-walk-summary-page"
      >
        <PageHeader
          title="Gemba walk summary"
          description={walk.definition_name_snapshot ?? ""}
        />
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <GembaWalkSummary
              definitionName={walk.definition_name_snapshot ?? ""}
              unitName={walk.unit_name_snapshot}
              status={walk.status}
              completedAt={walk.completed_at}
              summaryNotes={walk.summary_notes}
              sections={sections}
              answers={answers}
              observations={observations ?? []}
              evidence={evidence}
            />
            <Button variant="outline" asChild>
              <AppLink
                href="/platform/gemba/history"
                data-testid="gemba-walk-back-link"
              >
                History
              </AppLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Gemba walk"
        description={walk.unit_name_snapshot ?? "In progress"}
      />

      <GembaWalkWorkspace
        siteUnitId={walk.site_unit_id}
        walkId={id}
        status={walk.status}
        sections={sections}
        answers={answers}
        evidence={evidence}
        observations={observations ?? []}
        canEdit={canEdit && walk.status === "in_progress"}
        canComplete={canEdit && walk.status === "in_progress"}
        initialPromptId={prompt ?? null}
        onComplete={completeGembaWalk}
        projectOptions={projectPicker.projects}
        requiresSiteSelection={projectPicker.requiresSiteSelection}
        linkedProjectsByObservationId={linkedProjectsByObservationId}
        actionCountsByObservation={actionCountsByObservation}
      />
    </div>
  );
}
