import { notFound } from "next/navigation";

import { loadActionSheetPayload } from "@/app/(platform)/platform/actions/actions";
import { ActionWorkspace } from "@/components/actions/action-workspace";
import { ACTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import {
  loadWorkplaceRecordFallback,
  loadWorkplaceRecordView,
} from "@/modules/workplace/access";

export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;
  const workplaceView = await loadWorkplaceRecordView({
    readPermission: ACTIONS_PERMISSIONS.read,
    module: "actions",
    recordId: actionId,
    title: "Action",
    denyWithoutAccess: false,
    baselineOpensModule: true,
  });
  if (workplaceView) return workplaceView;

  const loaded = await loadActionSheetPayload(actionId);
  if (loaded.error || !loaded.payload) {
    const workplaceRecord = await loadWorkplaceRecordFallback({
      module: "actions",
      recordId: actionId,
      title: "Action",
    });
    if (workplaceRecord) return workplaceRecord;
    notFound();
  }

  const {
    detail,
    comments,
    evidence,
    assignablePeople,
    canUploadEvidence,
    canPostComments,
    currentCommentAuthor,
    assigneeAvatarUrl,
    fiveSQuestionPrompt,
  } = loaded.payload;

  return (
    <ActionWorkspace
      detail={detail}
      comments={comments}
      evidence={evidence}
      assignablePeople={assignablePeople}
      canUploadEvidence={canUploadEvidence}
      canPostComments={canPostComments}
      currentCommentAuthor={currentCommentAuthor}
      assigneeAvatarUrl={assigneeAvatarUrl}
      fiveSQuestionPrompt={fiveSQuestionPrompt}
    />
  );
}
