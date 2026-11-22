import {
  TRAINING_STARTER_PACK_VERSION,
  type TrainingStarterPack,
} from "./types";

export const manufacturingTrainingStarterPack: TrainingStarterPack = {
  key: "leh-manufacturing-training-starter",
  version: TRAINING_STARTER_PACK_VERSION,
  name: "Manufacturing training starter",
  summary:
    "A small catalogue of common manufacturing courses plus a curriculum skeleton that assigns them to typical job functions. Edit everything before you publish.",
  disclaimer:
    "Sample content only. It does not certify anyone or replace your own training standards.",
  courses: [
    {
      name: "Induction and site safety",
      category: "Safety",
      description:
        "Site rules, emergency response, and personal protective equipment for new starters.",
      durationMinutes: 90,
      deliveryMethod: "classroom",
      learningObjectives:
        "Describe site hazards, escalation paths, and required PPE for the workplace.",
    },
    {
      name: "Quality at the point of work",
      category: "Quality",
      description:
        "How to perform required checks, record results, and stop when quality is abnormal.",
      durationMinutes: 60,
      deliveryMethod: "workshop",
      learningObjectives:
        "Complete defined checks and explain when to contain output.",
    },
    {
      name: "Standard work and abnormality response",
      category: "Operations",
      description:
        "Follow standard work, recognise abnormality, and escalate before more work is affected.",
      durationMinutes: 75,
      deliveryMethod: "practical",
      learningObjectives:
        "Perform a standard cycle and respond to a staged abnormal condition.",
    },
    {
      name: "Equipment changeover basics",
      category: "Changeover",
      description:
        "Prepare, change over, and complete first-off checks using the documented method.",
      durationMinutes: 120,
      deliveryMethod: "coaching",
      learningObjectives:
        "Complete a changeover with observation and first-off confirmation.",
    },
  ],
  curriculumName: "Manufacturing training requirements",
  curriculumDescription:
    "Sample requirements linking starter courses to common job functions.",
  suggestedRoles: [
    {
      title: "Line Operator",
      description: "Performs the process to the current standard.",
    },
    {
      title: "Team Leader",
      description: "Supports the line and escalates abnormality.",
    },
    {
      title: "Quality Technician",
      description: "Performs checks and supports containment.",
    },
  ],
  requirements: [
    {
      courseName: "Induction and site safety",
      roleTitle: "Line Operator",
      mandatory: true,
      notes: null,
    },
    {
      courseName: "Induction and site safety",
      roleTitle: "Team Leader",
      mandatory: true,
      notes: null,
    },
    {
      courseName: "Quality at the point of work",
      roleTitle: "Line Operator",
      mandatory: true,
      notes: null,
    },
    {
      courseName: "Quality at the point of work",
      roleTitle: "Quality Technician",
      mandatory: true,
      notes: null,
    },
    {
      courseName: "Standard work and abnormality response",
      roleTitle: "Line Operator",
      mandatory: true,
      notes: null,
    },
    {
      courseName: "Equipment changeover basics",
      roleTitle: "Team Leader",
      mandatory: false,
      notes: "Assign when the role performs changeovers.",
    },
  ],
};
