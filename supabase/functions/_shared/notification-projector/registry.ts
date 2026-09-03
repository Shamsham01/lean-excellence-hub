import {
  JOB_FUNCTION_ASSIGNED_EVENT,
  projectJobFunctionAssigned,
} from "./projectors/job-function-assigned.ts";
import {
  RECOGNITION_AWARDED_EVENT,
  projectRecognitionAwarded,
} from "./projectors/recognition-awarded.ts";
import {
  projectSuggestionAccepted,
  projectSuggestionParked,
  projectSuggestionRejected,
  projectSuggestionReviewStarted,
  SUGGESTION_ACCEPTED_EVENT,
  SUGGESTION_PARKED_EVENT,
  SUGGESTION_REJECTED_EVENT,
  SUGGESTION_REVIEW_STARTED_EVENT,
} from "./projectors/suggestion-author-events.ts";
import {
  projectSuggestionReviewerAssigned,
  SUGGESTION_REVIEWER_ASSIGNED_EVENT,
} from "./projectors/suggestion-reviewer-assigned.ts";
import {
  projectSuggestionReviewerReassigned,
  SUGGESTION_REVIEWER_REASSIGNED_EVENT,
} from "./projectors/suggestion-reviewer-reassigned.ts";
import {
  SKILL_PROFICIENCY_VALIDATED_EVENT,
  projectSkillProficiencyValidated,
} from "./projectors/skill-proficiency-validated.ts";
import {
  TRAINING_COMPLETED_EVENT,
  projectTrainingCompleted,
} from "./projectors/training-completed.ts";
import type {
  ClaimedDomainEvent,
  ProjectorContext,
  ProjectorOutcome,
} from "./types.ts";

export type DomainEventProjector = {
  eventType: string;
  project: (
    event: ClaimedDomainEvent,
    context: ProjectorContext,
  ) => ProjectorOutcome | Promise<ProjectorOutcome>;
};

export const NOTIFICATION_EVENT_PROJECTORS: DomainEventProjector[] = [
  {
    eventType: JOB_FUNCTION_ASSIGNED_EVENT,
    project: projectJobFunctionAssigned,
  },
  {
    eventType: TRAINING_COMPLETED_EVENT,
    project: projectTrainingCompleted,
  },
  {
    eventType: SKILL_PROFICIENCY_VALIDATED_EVENT,
    project: projectSkillProficiencyValidated,
  },
  {
    eventType: RECOGNITION_AWARDED_EVENT,
    project: projectRecognitionAwarded,
  },
  {
    eventType: SUGGESTION_REVIEWER_ASSIGNED_EVENT,
    project: projectSuggestionReviewerAssigned,
  },
  {
    eventType: SUGGESTION_REVIEWER_REASSIGNED_EVENT,
    project: projectSuggestionReviewerReassigned,
  },
  {
    eventType: SUGGESTION_REVIEW_STARTED_EVENT,
    project: projectSuggestionReviewStarted,
  },
  {
    eventType: SUGGESTION_ACCEPTED_EVENT,
    project: projectSuggestionAccepted,
  },
  {
    eventType: SUGGESTION_REJECTED_EVENT,
    project: projectSuggestionRejected,
  },
  {
    eventType: SUGGESTION_PARKED_EVENT,
    project: projectSuggestionParked,
  },
];

export const SUPPORTED_NOTIFICATION_EVENT_TYPES =
  NOTIFICATION_EVENT_PROJECTORS.map((projector) => projector.eventType);

export function findNotificationProjector(
  eventType: string,
): DomainEventProjector | null {
  return (
    NOTIFICATION_EVENT_PROJECTORS.find(
      (projector) => projector.eventType === eventType,
    ) ?? null
  );
}

export async function projectDomainEvent(
  event: ClaimedDomainEvent,
  context: ProjectorContext,
): Promise<ProjectorOutcome | null> {
  const projector = findNotificationProjector(event.eventType);
  if (!projector) {
    return null;
  }

  return projector.project(event, context);
}
