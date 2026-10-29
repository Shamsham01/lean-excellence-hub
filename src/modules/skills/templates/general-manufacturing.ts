import { SKILLS_STARTER_PACK_VERSION, type SkillsStarterPack } from "./types";

const LEVELS = [
  {
    order: 0,
    label: "Aware",
    guidance:
      "Can describe the standard and the risks. Not yet safe to perform it alone.",
  },
  {
    order: 1,
    label: "Developing",
    guidance: "Can perform the skill with coaching or a defined check.",
  },
  {
    order: 2,
    label: "Competent",
    guidance: "Can perform the skill independently to the current standard.",
  },
  {
    order: 3,
    label: "Proficient",
    guidance: "Can handle normal variation and explain why the standard works.",
  },
  {
    order: 4,
    label: "Can coach others",
    guidance: "Can teach the skill and judge someone else's demonstration.",
  },
] as const;

export const generalManufacturingSkillsPack: SkillsStarterPack = {
  key: "leh-general-manufacturing-skills",
  version: SKILLS_STARTER_PACK_VERSION,
  name: "General manufacturing",
  summary:
    "A short catalogue of observable manufacturing skills, a five-level proficiency scale, and suggested requirements for common job functions. It is a starting point for your organisation to edit.",
  disclaimer: null,
  scaleName: "Sample manufacturing proficiency",
  scaleDescription:
    "Sample. Describes demonstrated ability. It is not a job grade, a job title, or proof that training was completed.",
  levels: LEVELS,
  skills: [
    {
      name: "Follow standard work for the assigned process",
      category: "Standard work",
      description:
        "Perform the current standard method for the process, in the right sequence, using the specified tools.",
      evidenceExpectations:
        "Observed complete cycle against the current standard work. Training attendance is not enough.",
    },
    {
      name: "Identify and contain an abnormal condition",
      category: "Abnormality response",
      description:
        "Recognise when the process is outside the standard and stop or contain it before more output is affected.",
      evidenceExpectations:
        "Observed response to a real or staged abnormal condition, including who was told.",
    },
    {
      name: "Change over equipment using the standard method",
      category: "Changeover",
      description:
        "Change the process from one specification to the next using the documented method and checks.",
      evidenceExpectations:
        "Observed changeover, including the first-off check.",
    },
    {
      name: "Complete the required quality checks",
      category: "Quality",
      description:
        "Carry out the checks defined for the process and record the result against the standard.",
      evidenceExpectations:
        "Completed check record plus observation that the method matched the standard.",
    },
    {
      name: "Record process data accurately",
      category: "Process control",
      description:
        "Enter the required counts, times, or measurements at the point of work, without reconstructing them later.",
      evidenceExpectations:
        "Sample of records compared with the process that was running.",
    },
    {
      name: "Restore the work area to the 5S standard",
      category: "Workplace organisation",
      description:
        "Return tools, materials, and information to the agreed places and remove what does not belong.",
      evidenceExpectations:
        "End-of-shift or end-of-job observation against the local 5S standard.",
    },
    {
      name: "Escalate a problem that cannot be contained locally",
      category: "Abnormality response",
      description:
        "Hand a contained problem to the right person with the facts they need to act.",
      evidenceExpectations:
        "Example of an escalation that included the condition, the containment, and the time.",
    },
    {
      name: "Coach a colleague through a standard task",
      category: "Coaching",
      description:
        "Show, observe, and correct a colleague performing a standard task without taking the task over.",
      evidenceExpectations:
        "Observed coaching cycle. Being a manager is not itself this skill.",
    },
  ],
  suggestedRoles: [
    {
      title: "Line Operator",
      summary: "Performs the process on the line.",
    },
    {
      title: "Area Leader",
      summary:
        "Runs the area and responds when the line cannot contain a problem.",
    },
    {
      title: "Department Manager",
      summary: "Owns the department's standards and capability.",
    },
    {
      title: "Quality Technician",
      summary: "Checks conformance and supports problem containment.",
    },
    {
      title: "Maintenance Technician",
      summary: "Restores equipment using the agreed method.",
    },
  ],
  requirements: [
    {
      skillName: "Follow standard work for the assigned process",
      roleTitle: "Line Operator",
      levelLabel: "Competent",
      evidence: "Observed cycle against current standard work.",
    },
    {
      skillName: "Identify and contain an abnormal condition",
      roleTitle: "Line Operator",
      levelLabel: "Developing",
      evidence: "Observed containment, with support available.",
    },
    {
      skillName: "Complete the required quality checks",
      roleTitle: "Line Operator",
      levelLabel: "Competent",
      evidence: "Check completed at the process, not from memory.",
    },
    {
      skillName: "Identify and contain an abnormal condition",
      roleTitle: "Area Leader",
      levelLabel: "Proficient",
      evidence: "Can judge whether containment is sufficient.",
    },
    {
      skillName: "Escalate a problem that cannot be contained locally",
      roleTitle: "Area Leader",
      levelLabel: "Competent",
      evidence: "Escalation includes facts, containment, and time.",
    },
    {
      skillName: "Coach a colleague through a standard task",
      roleTitle: "Area Leader",
      levelLabel: "Developing",
      evidence: "Observed coaching of one standard task.",
    },
    {
      skillName: "Coach a colleague through a standard task",
      roleTitle: "Department Manager",
      levelLabel: "Proficient",
      evidence: "Can coach a leader, not only perform the task.",
    },
    {
      skillName: "Complete the required quality checks",
      roleTitle: "Quality Technician",
      levelLabel: "Proficient",
      evidence: "Can explain the check and the reaction when it fails.",
    },
    {
      skillName: "Change over equipment using the standard method",
      roleTitle: "Maintenance Technician",
      levelLabel: "Competent",
      evidence: "Observed changeover support using the standard method.",
    },
  ],
};
