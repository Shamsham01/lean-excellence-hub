import {
  JOB_FUNCTION_ASSIGNED_KIND,
  RECOGNITION_AWARDED_KIND,
  SKILL_PROFICIENCY_VALIDATED_KIND,
  SUGGESTION_APPROVED_KIND,
  SUGGESTION_DECLINED_KIND,
  SUGGESTION_PARKED_KIND,
  SUGGESTION_REVIEW_STARTED_KIND,
  SUGGESTION_REVIEWER_ASSIGNED_KIND,
  SUGGESTION_REVIEWER_REASSIGNED_KIND,
  TRAINING_COMPLETED_KIND,
  renderJobFunctionAssignedEmail,
  renderRecognitionAwardedEmail,
  renderSkillProficiencyValidatedEmail,
  renderSuggestionApprovedEmail,
  renderSuggestionDeclinedEmail,
  renderSuggestionParkedEmail,
  renderSuggestionReviewStartedEmail,
  renderSuggestionReviewerAssignedEmail,
  renderSuggestionReviewerReassignedEmail,
  renderTrainingCompletedEmail,
} from "./renderers.ts";
import type {
  NotificationDeliveryContext,
  RenderedOperationalEmail,
} from "../types.ts";

type NotificationRenderer = (
  context: NotificationDeliveryContext,
  appOrigin: string,
) => RenderedOperationalEmail;

const RENDERERS: Record<string, NotificationRenderer> = {
  [JOB_FUNCTION_ASSIGNED_KIND]: renderJobFunctionAssignedEmail,
  [TRAINING_COMPLETED_KIND]: renderTrainingCompletedEmail,
  [SKILL_PROFICIENCY_VALIDATED_KIND]: renderSkillProficiencyValidatedEmail,
  [RECOGNITION_AWARDED_KIND]: renderRecognitionAwardedEmail,
  [SUGGESTION_REVIEWER_ASSIGNED_KIND]: renderSuggestionReviewerAssignedEmail,
  [SUGGESTION_REVIEWER_REASSIGNED_KIND]:
    renderSuggestionReviewerReassignedEmail,
  [SUGGESTION_REVIEW_STARTED_KIND]: renderSuggestionReviewStartedEmail,
  [SUGGESTION_APPROVED_KIND]: renderSuggestionApprovedEmail,
  [SUGGESTION_DECLINED_KIND]: renderSuggestionDeclinedEmail,
  [SUGGESTION_PARKED_KIND]: renderSuggestionParkedEmail,
};

export function renderOperationalNotification(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  const renderer = RENDERERS[context.notificationKind];
  if (!renderer) {
    throw new Error(
      `unsupported_notification_kind:${context.notificationKind}`,
    );
  }

  return renderer(context, appOrigin);
}

export function listSupportedNotificationKinds(): string[] {
  return Object.keys(RENDERERS);
}
