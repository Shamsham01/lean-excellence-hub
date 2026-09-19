import { notFound } from "next/navigation";

import { ActionWorkspace } from "@/components/actions/action-workspace";
import type { EvidenceItem } from "@/components/attachments/evidence-uploader";
import type { CommentRow } from "@/components/comments/resource-comments";
import { callActionRpc } from "@/lib/actions/supabase-untyped";
import type { ActionDetail, AssignablePerson } from "@/lib/actions/types";
import { ACTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type DirectoryPayload = {
  people?: Array<{
    membership_id: string;
    display_name: string | null;
  }>;
};

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: detail, error } = await callActionRpc<ActionDetail>(
    supabase,
    "get_action_detail",
    { target_action_id: actionId },
  );

  if (error || !detail) notFound();

  const action = detail;
  const canUploadEvidence =
    await currentMemberHasPermission("attachments.upload");
  const canAssign = await currentMemberHasPermission(
    ACTIONS_PERMISSIONS.assign,
  );

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, author_membership_id")
    .eq("target_resource_id", actionId)
    .order("created_at");

  const { data: evidence } = await supabase
    .from("attachments")
    .select("id, filename, mime_type, byte_size")
    .eq("target_resource_id", actionId)
    .eq("lifecycle", "active")
    .order("created_at");

  let assignablePeople: AssignablePerson[] = [];
  if (canAssign && action.permissions.can_assign) {
    const { data: directory } = await supabase.rpc("get_people_directory", {
      target_page: 1,
      target_page_size: 200,
    });
    const people = (directory as DirectoryPayload | null)?.people ?? [];
    assignablePeople = people.map((person) => ({
      membership_id: person.membership_id,
      display_name: person.display_name?.trim() || "Team member",
    }));

    for (const assignee of action.assignees) {
      if (
        !assignablePeople.some(
          (person) => person.membership_id === assignee.membership_id,
        )
      ) {
        assignablePeople.push({
          membership_id: assignee.membership_id,
          display_name: assignee.display_name,
        });
      }
    }
  }

  return (
    <ActionWorkspace
      detail={action}
      comments={(comments ?? []) as CommentRow[]}
      evidence={(evidence ?? [])
        .filter((item) => item.byte_size != null)
        .map((item): EvidenceItem => ({
          id: item.id,
          filename: item.filename,
          mime_type: item.mime_type,
          byte_size: item.byte_size as number,
        }))}
      assignablePeople={assignablePeople}
      canUploadEvidence={canUploadEvidence}
    />
  );
}
