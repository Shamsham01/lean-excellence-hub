import type {
  NotificationDeliveryContext,
  RenderedOperationalEmail,
} from "../types.ts";
import {
  buildOperationalCtaUrl,
  renderBrandedOperationalEmail,
} from "./template.ts";

export function formatRecipientGreeting(
  recipientDisplayName: string | null | undefined,
): string {
  const trimmedName = recipientDisplayName?.trim();
  return trimmedName ? `Hello ${trimmedName}` : "Hello";
}

export const JOB_FUNCTION_ASSIGNED_KIND = "workforce.job_function_assigned";
export const TRAINING_COMPLETED_KIND = "workforce.training_completed";
export const SKILL_PROFICIENCY_VALIDATED_KIND =
  "workforce.skill_proficiency_validated";
export const RECOGNITION_AWARDED_KIND = "recognition.awarded";

export const SUGGESTION_REVIEWER_ASSIGNED_KIND =
  "suggestions.reviewer_assigned";
export const SUGGESTION_REVIEWER_REASSIGNED_KIND =
  "suggestions.reviewer_reassigned";
export const SUGGESTION_MORE_INFORMATION_REQUIRED_KIND =
  "suggestions.more_information_required";
export const SUGGESTION_APPROVED_KIND = "suggestions.approved";
export const SUGGESTION_DECLINED_KIND = "suggestions.declined";
export const SUGGESTION_PARKED_KIND = "suggestions.parked";
export const SUGGESTION_IMPLEMENTED_KIND = "suggestions.implemented";

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
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `${detail} for ${jobFunctionName} in ${context.organisationName}.\n\n` +
    `Open Lean Excellence Hub to review your workforce profile.`;

  return {
    subject,
    text: `${intro}\n\nView details: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Job function assignment updated",
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, ${detail.toLowerCase()} for ` +
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
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `Your completion of ${courseName} has been recorded in ${context.organisationName}.`;

  return {
    subject,
    text: `${intro}\n\nView training: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Training completion recorded",
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, your completion of ${courseName} ` +
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
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `Your proficiency in ${skillName} has been validated in ${context.organisationName}.`;

  return {
    subject,
    text: `${intro}\n\nView skills: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Skill proficiency validated",
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, your proficiency in ${skillName} ` +
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
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `You have been recognised in ${context.organisationName}.\n\n` +
    `${awardTitle}\n${awardMessage}`;

  return {
    subject,
    text: `${intro}\n\nView recognition: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "You received recognition",
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, you have been recognised in ` +
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
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `${bodyIntro} in ${context.organisationName}.\n\n` +
    `Open Lean Excellence Hub to review the idea and record the next step.`;

  return {
    subject,
    text: `${intro}\n\nReview suggestion: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: subjectPrefix,
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, ${bodyIntro.toLowerCase()} ` +
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

function renderSuggestionAuthorDecisionEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
  options: {
    subjectPrefix: string;
    heading: string;
    bodyDetail: string;
    feedbackHeading: string;
    nextStep?: string;
  },
): RenderedOperationalEmail {
  const suggestionTitle = context.contextTitle ?? "Suggestion";
  const employeeMessage = context.contextEmployeeMessage ?? "";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);
  const subject = `${options.subjectPrefix}: ${suggestionTitle}`;
  const intro =
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `${options.bodyDetail} in ${context.organisationName}.`;
  const feedbackBlock =
    employeeMessage.length > 0
      ? `\n\n${options.feedbackHeading}\n${employeeMessage}`
      : "";
  const nextStepBlock = options.nextStep ? `\n\n${options.nextStep}` : "";

  return {
    subject,
    text: `${intro}${feedbackBlock}${nextStepBlock}\n\nView suggestion: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: options.heading,
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, ${options.bodyDetail.toLowerCase()} ` +
        `in ${context.organisationName}.`,
      ...(employeeMessage
        ? {
            sections: [
              { heading: options.feedbackHeading, body: employeeMessage },
            ],
          }
        : {}),
      ctaLabel: "View suggestion",
      ctaUrl,
      footer: options.nextStep
        ? `${options.nextStep} You received this operational notification from Lean Excellence Hub.`
        : "You received this operational notification from Lean Excellence Hub.",
    }),
  };
}

export function renderSuggestionMoreInformationRequiredEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorDecisionEmail(context, appOrigin, {
    subjectPrefix: "More information needed",
    heading: "Action required",
    bodyDetail: "More information is needed for your suggestion",
    feedbackHeading: "Message from reviewer",
  });
}

export function renderSuggestionApprovedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorDecisionEmail(context, appOrigin, {
    subjectPrefix: "Suggestion approved",
    heading: "Suggestion approved",
    bodyDetail: "Your suggestion has been approved",
    feedbackHeading: "Feedback from reviewer",
    nextStep: "The suggestion can now move into implementation.",
  });
}

export function renderSuggestionDeclinedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorDecisionEmail(context, appOrigin, {
    subjectPrefix: "Suggestion declined",
    heading: "Suggestion declined",
    bodyDetail: "Your suggestion has been declined",
    feedbackHeading: "Feedback from reviewer",
  });
}

export function renderSuggestionParkedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  return renderSuggestionAuthorDecisionEmail(context, appOrigin, {
    subjectPrefix: "Suggestion update",
    heading: "Suggestion parked",
    bodyDetail: "Your suggestion has been parked for further consideration",
    feedbackHeading: "Feedback from reviewer",
  });
}

export function renderSuggestionImplementedEmail(
  context: NotificationDeliveryContext,
  appOrigin: string,
): RenderedOperationalEmail {
  const suggestionTitle = context.contextTitle ?? "Suggestion";
  const employeeOutcome = context.contextEmployeeMessage ?? "";
  const ctaUrl = buildOperationalCtaUrl(appOrigin, context.contextLinkPath);
  const subject = `Suggestion implemented: ${suggestionTitle}`;
  const intro =
    `${formatRecipientGreeting(context.recipientDisplayName)},\n\n` +
    `Your suggestion has been implemented in ${context.organisationName}.`;
  const outcomeBlock =
    employeeOutcome.length > 0 ? `\n\nOutcome\n${employeeOutcome}` : "";
  const closing = "\n\nThank you for contributing to continuous improvement.";

  return {
    subject,
    text: `${intro}${outcomeBlock}${closing}\n\nView suggestion: ${ctaUrl}`,
    html: renderBrandedOperationalEmail({
      eyebrow: context.organisationName,
      title: "Your suggestion has been implemented",
      intro:
        `${formatRecipientGreeting(context.recipientDisplayName)}, your suggestion has been implemented ` +
        `in ${context.organisationName}.`,
      ...(employeeOutcome
        ? { sections: [{ heading: "Outcome", body: employeeOutcome }] }
        : {}),
      ctaLabel: "View suggestion",
      ctaUrl,
      footer:
        "Thank you for contributing to continuous improvement. You received this operational notification from Lean Excellence Hub.",
    }),
  };
}
