import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completeGembaWalkFromForm,
  createGembaObservationFromForm,
} from "@/app/(platform)/platform/gemba/actions";
import { GembaWalkWorkspace } from "@/components/gemba/walk-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaWalkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canEdit = await currentMemberHasPermission(GEMBA_PERMISSIONS.walkPerform);

  const { data: walk } = await supabase
    .from("gemba_walks")
    .select("id, status, submission_id, definition_version_id, summary_notes, definition_name_snapshot, unit_name_snapshot, completed_at")
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
    .select("id, section_id, prompt, question_type, help_text")
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
          })) ?? [],
    })) ?? [];

  const { data: answersRaw } = await supabase
    .from("template_answers")
    .select("question_id, text_value")
    .eq("submission_id", walk.submission_id);

  const answers: Record<string, { text_value?: string | null }> = {};
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
    .select("id, observation_text, observation_type")
    .eq("walk_id", id);

  if (walk.status === "completed") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Gemba walk summary" description={walk.definition_name_snapshot ?? ""} />
        <Card>
          <CardContent className="py-6 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{walk.unit_name_snapshot}</p>
            {walk.summary_notes ? <p>{walk.summary_notes}</p> : null}
            <ul className="flex flex-col gap-2">
              {observations?.map((o) => (
                <li key={o.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{o.observation_type}</span>: {o.observation_text}
                </li>
              ))}
            </ul>
            <Button variant="outline" asChild><Link href="/platform/gemba/history">History</Link></Button>
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
        actions={
          canEdit ? (
            <form action={completeGembaWalkFromForm}>
              <input type="hidden" name="walkId" value={id} />
              <Button type="submit" className="min-h-11">Complete walk</Button>
            </form>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {["positive_practice", "improvement_opportunity", "issue"].map((type) => (
          <form key={type} action={createGembaObservationFromForm}>
            <input type="hidden" name="walkId" value={id} />
            <input type="hidden" name="observationType" value={type} />
            <input type="hidden" name="text" value={`Observation: ${type.replace(/_/g, " ")}`} />
            <Button type="submit" variant="outline" className="min-h-11 capitalize">
              {type.replace(/_/g, " ")}
            </Button>
          </form>
        ))}
      </div>

      <GembaWalkWorkspace
        walkId={id}
        status={walk.status}
        sections={sections}
        answers={answers}
        evidence={evidence}
        canEdit={canEdit && walk.status === "in_progress"}
      />
    </div>
  );
}
