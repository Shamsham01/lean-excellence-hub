import Link from "next/link";
import { notFound } from "next/navigation";

import { completeGembaWalk } from "@/app/(platform)/platform/gemba/actions";
import { GembaWalkSummary } from "@/components/gemba/walk-summary";
import { GembaWalkWorkspace } from "@/components/gemba/walk-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaWalkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { id } = await params;
  const { prompt } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const canEdit = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.walkPerform,
  );

  const { data: walk } = await supabase
    .from("gemba_walks")
    .select(
      "id, status, submission_id, definition_version_id, summary_notes, definition_name_snapshot, unit_name_snapshot, completed_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!walk) notFound();

  const { data: version } = await supabase
    .from("gemba_definition_versions")
    .select("template_version_id")
    .eq("id", walk.definition_version_id)
    .maybeSingle();

  const { data: sectionsRaw } = await supabase
    .from("template_sections")
    .select("id, title")
    .eq("template_version_id", version?.template_version_id ?? "");

  const { data: questionsRaw } = await supabase
    .from("template_questions")
    .select(
      "id, section_id, prompt, question_type, help_text, is_required, allows_not_applicable",
    )
    .eq("template_version_id", version?.template_version_id ?? "");

  const sections =
    sectionsRaw?.map((s) => ({
      id: s.id,
      title: s.title,
      questions:
        questionsRaw
          ?.filter((q) => q.section_id === s.id)
          .map((q) => ({
            id: q.id,
            prompt: q.prompt,
            question_type: q.question_type,
            help_text: q.help_text,
            is_required: q.is_required,
            allows_not_applicable: q.allows_not_applicable,
          })) ?? [],
    })) ?? [];

  const { data: answersRaw } = await supabase
    .from("template_answers")
    .select("question_id, text_value, is_not_applicable")
    .eq("submission_id", walk.submission_id);

  const answers: Record<
    string,
    { text_value?: string | null; is_not_applicable?: boolean }
  > = {};
  for (const a of answersRaw ?? []) answers[a.question_id] = a;

  const { data: evidenceLinks } = await supabase
    .from("gemba_evidence_links")
    .select("section_id, question_id, observation_id, attachment_id")
    .eq("walk_id", id);

  const evidence = [];
  for (const link of evidenceLinks ?? []) {
    const { data: attachment } = await supabase
      .from("attachments")
      .select("id, filename, mime_type, byte_size")
      .eq("id", link.attachment_id)
      .maybeSingle();
    if (attachment) {
      evidence.push({
        id: attachment.id,
        filename: attachment.filename,
        mime_type: attachment.mime_type,
        byte_size: attachment.byte_size ?? 0,
        question_id: link.question_id,
        section_id: link.section_id,
        observation_id: link.observation_id,
      });
    }
  }

  const { data: observations } = await supabase
    .from("gemba_walk_observations")
    .select("id, observation_text, observation_type, created_at")
    .eq("walk_id", id)
    .order("created_at", { ascending: true });

  if (walk.status === "completed") {
    return (
      <div className="flex flex-col gap-8">
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
              <Link href="/platform/gemba/history">History</Link>
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
      />
    </div>
  );
}
