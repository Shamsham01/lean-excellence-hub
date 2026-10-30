import { SKILLS_STARTER_PACK_VERSION, type SkillsStarterPack } from "./types";

export const FOOD_PRODUCTION_DISCLAIMER =
  "Sample starting point for a food operation. It is not a certification, a HACCP plan, or evidence that a site meets BRCGS, retailer, or legal requirements. A competent local reviewer must adapt it before it is published.";

export const foodProductionSkillsPack: SkillsStarterPack = {
  key: "leh-food-production-skills",
  version: SKILLS_STARTER_PACK_VERSION,
  name: "Food production",
  summary:
    "Observable skills for a food line, including the oven example used in setup guidance. Local review is required before publishing.",
  disclaimer: FOOD_PRODUCTION_DISCLAIMER,
  scaleName: "Sample food-production proficiency",
  scaleDescription: `Sample. ${FOOD_PRODUCTION_DISCLAIMER}`,
  levels: [
    {
      order: 0,
      label: "Aware",
      guidance:
        "Can point to the standard and the food-safety risk. Cannot yet perform the task alone.",
    },
    {
      order: 1,
      label: "Developing",
      guidance: "Can perform the task with a checker present.",
    },
    {
      order: 2,
      label: "Competent",
      guidance: "Can perform the task to the local standard without a checker.",
    },
    {
      order: 3,
      label: "Proficient",
      guidance:
        "Can handle a deviation and explain the food-safety reason for the standard.",
    },
    {
      order: 4,
      label: "Can coach others",
      guidance:
        "Can train and judge a demonstration. Training attendance alone does not reach this level.",
    },
  ],
  skills: [
    {
      name: "Operate and monitor the oven",
      category: "Process",
      description:
        "Run the oven to the current recipe, watch the critical measures, and stop the process when a measure leaves the limit.",
      evidenceExpectations:
        "Observed start-up and in-process checks. Completing an oven training course does not by itself prove this skill.",
    },
    {
      name: "Verify allergen controls before the run",
      category: "Food safety",
      description:
        "Confirm the line is clear of the previous allergen, the labels match the run, and the checks are recorded.",
      evidenceExpectations:
        "Observed pre-run check against the local allergen standard.",
    },
    {
      name: "Complete a foreign-body detection challenge",
      category: "Food safety",
      description:
        "Run the site's detection challenge the way the local standard describes and react when it fails.",
      evidenceExpectations:
        "Observed challenge and the recorded result. This pack does not define the legal test.",
    },
    {
      name: "Record product temperatures",
      category: "Process control",
      description:
        "Take the temperature the standard specifies, at the point and frequency it specifies, and record the actual value.",
      evidenceExpectations: "Record compared with an observed check.",
    },
    {
      name: "Follow the hygiene and handwash standard",
      category: "Hygiene",
      description:
        "Enter the area and handle product using the current hygiene standard.",
      evidenceExpectations:
        "Observed entry and handling, not a signed training sheet alone.",
    },
    {
      name: "Change the line over and clear the previous product",
      category: "Changeover",
      description:
        "Remove the previous product and packaging, clean to the standard, and release the line for the next run.",
      evidenceExpectations:
        "Observed changeover, including the clearance check.",
    },
    {
      name: "Hold non-conforming product",
      category: "Quality",
      description:
        "Identify product that does not meet the standard, hold it, and tell the person who can release or reject it.",
      evidenceExpectations:
        "Example of a hold that was labelled, separated, and escalated.",
    },
  ],
  suggestedRoles: [
    {
      title: "Oven Operator",
      summary: "Runs the oven process. This is a job function, not a skill.",
    },
    {
      title: "Line Operator",
      summary: "Performs the packing or process task on the line.",
    },
    {
      title: "Area Leader",
      summary: "Confirms the line is safe to run and coaches the standard.",
    },
    {
      title: "Hygiene Leader",
      summary: "Owns the hygiene standard for the area.",
    },
  ],
  requirements: [
    {
      skillName: "Operate and monitor the oven",
      roleTitle: "Oven Operator",
      levelLabel: "Competent",
      evidence: "Observed oven start-up and in-process monitoring.",
    },
    {
      skillName: "Record product temperatures",
      roleTitle: "Oven Operator",
      levelLabel: "Competent",
      evidence: "Temperature record taken at the specified point.",
    },
    {
      skillName: "Verify allergen controls before the run",
      roleTitle: "Line Operator",
      levelLabel: "Competent",
      evidence: "Observed pre-run allergen check.",
    },
    {
      skillName: "Follow the hygiene and handwash standard",
      roleTitle: "Line Operator",
      levelLabel: "Competent",
      evidence: "Observed hygiene practice.",
    },
    {
      skillName: "Hold non-conforming product",
      roleTitle: "Area Leader",
      levelLabel: "Proficient",
      evidence: "Can judge a hold and who is allowed to release it.",
    },
    {
      skillName: "Verify allergen controls before the run",
      roleTitle: "Area Leader",
      levelLabel: "Proficient",
      evidence: "Can confirm the check was actually done.",
    },
    {
      skillName: "Follow the hygiene and handwash standard",
      roleTitle: "Hygiene Leader",
      levelLabel: "Can coach others",
      evidence: "Can coach the standard and correct a miss.",
    },
  ],
};
