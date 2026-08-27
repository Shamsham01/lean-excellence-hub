import Link from "next/link";

import { notFound } from "next/navigation";

import { SuggestionDetail } from "@/components/suggestions/suggestion-detail";
import { callBenefitRpc } from "@/lib/benefits/supabase-untyped";
import type { LinkedBenefitSummary } from "@/lib/benefits/types";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ suggestionId: string }>;
}) {
  const { suggestionId } = await params;

  const supabase = await createServerSupabaseClient();

  const { data: detail, error } = await supabase.rpc("get_suggestion_detail", {
    target_suggestion_id: suggestionId,
  });

  if (error || !detail) notFound();

  const canManage = await currentMemberHasPermission("suggestions.manage");

  const canCreateProject = await currentMemberHasPermission("projects.manage");

  const canUploadEvidence =
    await currentMemberHasPermission("attachments.upload");

  const { data: comments } = await supabase

    .from("comments")

    .select("id, body, created_at, author_membership_id")

    .eq("target_resource_id", suggestionId)

    .order("created_at");

  const { data: statusHistory } = await supabase

    .from("suggestion_status_history")

    .select("from_status, to_status, changed_at, reason")

    .eq("suggestion_id", suggestionId)

    .order("changed_at");

  const { data: evidence } = await supabase

    .from("attachments")

    .select("id, filename, mime_type, byte_size")

    .eq("target_resource_id", suggestionId)

    .eq("lifecycle", "active")

    .order("created_at");

  const { data: suggestionBenefitsData } = await callBenefitRpc<{
    items: LinkedBenefitSummary[];
  }>(supabase, "get_suggestion_benefits", {
    target_suggestion_id: suggestionId,
  });
  const benefits = suggestionBenefitsData?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <SuggestionDetail
        detail={detail as Record<string, unknown>}

        comments={comments ?? []}

        statusHistory={statusHistory ?? []}

        evidence={(evidence ?? [])
          .filter((item) => item.byte_size != null)
          .map((item) => ({
            id: item.id,
            filename: item.filename,
            mime_type: item.mime_type,
            byte_size: item.byte_size as number,
          }))}
        benefits={benefits}

        canManage={canManage}

        canCreateProject={canCreateProject}

        canUploadEvidence={canUploadEvidence}
      />

      <Link
        href="/platform/suggestions"

        className="text-sm text-muted-foreground hover:underline"
      >
        Back to suggestions
      </Link>
    </div>
  );
}
