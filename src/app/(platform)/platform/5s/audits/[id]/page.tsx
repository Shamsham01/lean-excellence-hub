import Link from "next/link";
import { notFound } from "next/navigation";

import { completeFiveSAuditFromForm } from "@/app/(platform)/platform/5s/actions";
import { FiveSAuditWorkspace } from "@/components/five-s/audit-workspace";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function FiveSAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canEdit = await currentMemberHasPermission(FIVE_S_PERMISSIONS.auditPerform);

  const { data: audit } = await supabase
    .from("five_s_audits")
    .select(
      "id, status, submission_id, standard_version_id, overall_score_percent, target_percent, result_status, standard_name_snapshot, unit_name_snapshot, completed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!audit) notFound();

  const { data: version } = await supabase
    .from("five_s_standard_versions")
    .select("template_version_id")
    .eq("id", audit.standard_version_id)
    .maybeSingle();

  const { data: sectionsRaw } = await supabase
    .from("template_sections")
    .select("id, title, position")
    .eq("template_version_id", version?.template_version_id ?? "")
    .order("position");

  const { data: questionsRaw } = await supabase
    .from("template_questions")
    .select("id, section_id, prompt, question_type, is_required, allows_not_applicable, help_text, position")
    .eq("template_version_id", version?.template_version_id ?? "")
    .order("position");

  const sections =
    sectionsRaw?.map((section) => ({
      id: section.id,
      title: section.title,
      questions:
        questionsRaw
          ?.filter((q) => q.section_id === section.id)
          .map((q) => ({
            id: q.id,
            prompt: q.prompt,
            question_type: q.question_type,
            is_required: q.is_required,
            allows_not_applicable: q.allows_not_applicable,
            help_text: q.help_text,
          })) ?? [],
    })) ?? [];

  const { data: answersRaw } = await supabase
    .from("template_answers")
    .select("question_id, text_value, number_value, is_not_applicable")
    .eq("submission_id", audit.submission_id);

  const answers: Record<string, { text_value?: string | null; number_value?: number | null; is_not_applicable?: boolean }> = {};
  for (const a of answersRaw ?? []) {
    answers[a.question_id] = a;
  }

  const { data: evidenceLinks } = await supabase
    .from("five_s_evidence_links")
    .select("section_id, question_id, finding_id, attachment_id")
    .eq("audit_id", id);

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
        finding_id: link.finding_id,
      });
    }
  }

  if (audit.status === "completed") {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="5S audit result" description={audit.standard_name_snapshot ?? "Completed audit"} />
        <Card>
          <CardContent className="py-6 flex flex-col gap-2">
            <p className="text-2xl font-semibold">{audit.overall_score_percent}%</p>
            <p className="text-sm text-muted-foreground">
              Target {audit.target_percent}% · {audit.result_status} · {audit.unit_name_snapshot}
            </p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/platform/5s/history">Back to history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="5S audit"
        description={audit.unit_name_snapshot ?? "In progress"}
        actions={
          canEdit && audit.status === "in_progress" ? (
            <form action={completeFiveSAuditFromForm}>
              <input type="hidden" name="auditId" value={id} />
              <Button type="submit" className="min-h-11">Complete audit</Button>
            </form>
          ) : null
        }
      />
      <FiveSAuditWorkspace
        auditId={id}
        status={audit.status}
        sections={sections}
        answers={answers}
        evidence={evidence}
        canEdit={canEdit && audit.status === "in_progress"}
      />
    </div>
  );
}
