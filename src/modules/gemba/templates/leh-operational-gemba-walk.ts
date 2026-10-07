import {
  LEH_OPERATIONAL_GEMBA_WALK_DURATION_MINUTES,
  LEH_OPERATIONAL_GEMBA_WALK_KEY,
  LEH_OPERATIONAL_GEMBA_WALK_VERSION,
  type GembaQuickStartTemplate,
} from "./types";

/**
 * Optional organisation-neutral Gemba starting point.
 * Prompts ask for observation. They do not assert compliance.
 */
export const LEH_OPERATIONAL_GEMBA_WALK: GembaQuickStartTemplate = {
  key: LEH_OPERATIONAL_GEMBA_WALK_KEY,
  version: LEH_OPERATIONAL_GEMBA_WALK_VERSION,
  name: "LEH Operational Gemba Walk",
  description:
    "An optional starting point for a walk that looks at how work is actually happening: safety, people, quality, flow, standards and improvement.",
  notes:
    "Rewrite the prompts in your own language. This template does not decide who walks, when they walk, or which areas apply.",
  expectedDurationMinutes: LEH_OPERATIONAL_GEMBA_WALK_DURATION_MINUTES,
  sections: [
    {
      name: "Safety",
      description: "What can be seen about how people are kept safe here.",
      prompts: [
        {
          prompt:
            "What abnormal or unsafe condition is visible here right now?",
        },
        {
          prompt:
            "What is the team doing to keep people safe in this area today?",
        },
      ],
    },
    {
      name: "People",
      description: "What the team needs in order to do the work.",
      prompts: [
        {
          prompt: "What is preventing the team from working to standard today?",
        },
        {
          prompt: "What support does the team need?",
        },
      ],
    },
    {
      name: "Quality",
      description: "Defects, rework and uncertainty that are visible.",
      prompts: [
        {
          prompt: "Where is the team seeing defects, rework or uncertainty?",
        },
        {
          prompt: "What abnormal condition is visible here?",
        },
      ],
    },
    {
      name: "Flow / Delivery",
      description: "Where the work is waiting or being interrupted.",
      prompts: [
        {
          prompt: "Where is flow being interrupted?",
        },
        {
          prompt: "What is waiting, and why?",
        },
      ],
    },
    {
      name: "Standards",
      description:
        "Whether the current standard is usable where the work happens.",
      prompts: [
        {
          prompt: "Which standard is difficult to follow in this area today?",
        },
        {
          prompt: "What would make the standard easier to see and use?",
        },
      ],
    },
    {
      name: "Improvement",
      description:
        "What the team is already trying, and what should be looked at next.",
      prompts: [
        {
          prompt: "What improvement is the team already trying?",
        },
        {
          prompt: "What should be looked at next, based on what you can see?",
        },
      ],
    },
  ],
};
