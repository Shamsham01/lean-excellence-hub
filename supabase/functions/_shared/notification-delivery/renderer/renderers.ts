import type {
  NotificationDeliveryContext,
  RenderedOperationalEmail,
} from "../types.ts";
import {
  buildOperationalCtaUrl,
  renderBrandedOperationalEmail,
} from "./template.ts";

export const JOB_FUNCTION_ASSIGNED_KIND = "workforce.job_function_assigned";
export const TRAINING_COMPLETED_KIND = "workforce.training_completed";
export const SKILL_PROFICIENCY_VALIDATED_KIND =
  "workforce.skill_proficiency_validated";
export const RECOGNITION_AWARDED_KIND = "recognition.awarded";

export const SUGGESTION_REVIEWER_ASSIGNED_KIND =
  "suggestions.reviewer_assigned";
export const SUGGESTION_REVIEWER_REASSIGNED_KIND =
  "suggestions.reviewer_reassigned";
export const SUGGESTION_REVIEW_STARTED_KIND = "suggestions.review_started";
export const SUGGESTION_APPROVED_KIND = "suggestions.approved";
export const SUGGESTION_DECLINED_KIND = "suggestions.declined";
export const SUGGESTION_PARKED_KIND = "suggestions.parked";

export function renderJobFunctionAssignedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  const jobFunctionName = context.contextTitle ?? "your job function";
  const detail =
    context.contextDetail ?? "A job function assignment was recorded.";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);

  const subject = `Job function update: ${jobFunctionName}`;
  const intro =
    `Hello ${context.recipientDisplayName},\n\n` +
    `${detail} for ${jobFunctionName} in ${context.organisationName}.\n\n` +
    `Open Lean Excellence Hub to review your workforce profile.`;

  return {
    subject,
    text: `${intro}\n\nView details: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Job function assignment updated",
      intro:
        `Hello ${context.recipientDisplayName}, ${detail.toLowerCase()} for ` +
        `${jobFunctionName} in ${context.organisationName}.`,
      ctaLabel: "View workforce profile",
      ctaUrl,
      footer:
        "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

export function renderTrainingCompletedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  const courseName = context.contextTitle ?? "a training course";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);

  const subject = `Training completed: ${courseName}`;
  const intro =
    `Hello ${context.recipientDisplayName},\n\n` +
    `Your completion of ${courseName} has been recorded in ${context.organisationName}.`;

  return {
    subject,
    text: `${intro}\n\nView training: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Training completion recorded",
      intro:
        `Hello ${context.recipientDisplayName}, your completion of ${courseName} ` +
        `has been recorded in ${context.organisationName}.`,
      ctaLabel: "View training",
      ctaUrl,
      footer:
        "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

export function renderSkillProficiencyValidatedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  const skillName = context.contextTitle ?? "a skill";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);

  const subject = `Skill validated: ${skillName}`;
  const intro =
    `Hello ${context.recipientDisplayName},\n\n` +
    `Your proficiency in ${skillName} has been validated in ${context.organisationName}.`;

  return {
    subject,
    text: `${intro}\n\nView skills: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Skill proficiency validated",
      intro:
        `Hello ${context.recipientDisplayName}, your proficiency in ${skillName} ` +
        `has been validated in ${context.organisationName}.`,
      ctaLabel: "View skills",
      ctaUrl,
      footer:
        "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

export function renderRecognitionAwardedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  const awardTitle = context.contextTitle ?? "Recognition";
  const awardMessage = context.contextDetail ?? "You received recognition.";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);

  const subject = `Recognition awarded: ${awardTitle}`;
  const intro =
    `Hello ${context.recipientDisplayName},\n\n` +
    `You have been recognised in ${context.organisationName}.\n\n` +
    `${awardTitle}\n${awardMessage}`;

  return {
    subject,
    text: `${intro}\n\nView recognition: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "You received recognition",
      intro:
        `Hello ${context.recipientDisplayName}, you have been recognised in ` +
        `${context.organisationName}. ${awardTitle}: ${awardMessage}`,
      ctaLabel: "View recognition",
      ctaUrl,
      footer:
        "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

function renderSuggestionReviewerEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
  subjectPrefix: string,
  bodyIntro: string,
): RenderedOperationalEmail {
  const suggestionTitle = context.contextTitle ?? "Suggestion";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);
  const subject = `${subjectPrefix}: ${suggestionTitle}`;
  const intro =
    `Hello ${context.recipientDisplayName},\n\n` +
    `${bodyIntro} in ${context.organisationName}.\n\n` +
    `Open Lean Excellence Hub to review the idea and record the next step.`;

  return {
    subject,
    text: `${intro}\n\nReview suggestion: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: subjectPrefix,
      intro:
        `Hello ${context.recipientDisplayName}, ${bodyIntro.toLowerCase()} ` +
        `in ${context.organisationName}.`,
      ctaLabel: "Review suggestion",
      ctaUrl,
      footer:
        "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

export function renderSuggestionReviewerAssignedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionReviewerEmail(
    context,
    appOrigin,
    "Suggestion assigned for review",
    "A suggestion has been assigned to you for review",
  );
}

export function renderSuggestionReviewerReassignedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionReviewerEmail(
    context,
    appOrigin,
    "Suggestion reassigned to you",
    "A suggestion has been reassigned to you for review",
  );
}

function renderSuggestionAuthorEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
  subjectPrefix: string,
  bodyDetail: string,
): RenderedOperationalEmail {
  const suggestionTitle = context.contextTitle ?? "Suggestion";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);
  const subject = `${subjectPrefix}: ${suggestionTitle}`;
  const intro =
    `Hello ${context.recipientDisplayName},\n\n` +
    `${bodyDetail} in ${context.organisationName}.`;

  return {
    subject,
    text: `${intro}\n\nView suggestion: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: subjectPrefix,
      intro:
        `Hello ${context.recipientDisplayName}, ${bodyDetail.toLowerCase()} ` +
        `in ${context.organisationName}.`,
      ctaLabel: "View suggestion",
      ctaUrl,
      footer:
        "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

export function renderSuggestionReviewStartedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorEmail(
    context,
    appOrigin,
    "Your suggestion is under review",
    "Your suggestion is now under review",
  );
}

export function renderSuggestionApprovedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorEmail(
    context,
    appOrigin,
    "Suggestion approved",
    "Your suggestion was approved",
  );
}

export function renderSuggestionDeclinedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorEmail(
    context,
    appOrigin,
    "Suggestion declined",
    "Your suggestion was declined",
  );
}

export function renderSuggestionParkedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorEmail(
    context,
    appOrigin,
    "Suggestion update",
    "Your suggestion has been parked for further consideration",
  );
}
