import {
  JOB_FUNCTION_ASSIGNED_EVENT,
  projectJobFunctionAssigned,
} from "./projectors/job-function-assigned.ts";
import {
  RECOGNITION_AWARDED_EVENT,
  projectRecognitionAwarded,
} from "./projectors/recognition-awarded.ts";
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
