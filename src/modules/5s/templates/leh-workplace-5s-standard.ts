import {
  LEH_WORKPLACE_5S_STANDARD_KEY,
  LEH_WORKPLACE_5S_STANDARD_VERSION,
  LEH_WORKPLACE_5S_STARTING_THRESHOLD,
  type FiveSQuickStartTemplate,
} from "./types";

/**
 * Optional LEH starting point for workplace organisation.
 * It is not a prescribed 5S methodology. The deployed copy is an
 * organisation-owned draft.
 */
export const LEH_WORKPLACE_5S_STANDARD: FiveSQuickStartTemplate = {
  key: LEH_WORKPLACE_5S_STANDARD_KEY,
  version: LEH_WORKPLACE_5S_STANDARD_VERSION,
  name: "LEH Workplace 5S Standard",
  description:
    "An optional starting point for checking whether a manufacturing workplace is sorted, set in order, clean enough to see problems, standardised, and sustained by the people who work there.",
  notes:
    "Adapt the categories, questions, scoring scale and pass threshold to how your organisation actually works. Every question is scored on the default 1 to 5 scale (1 is 0%, 5 is 100%). The 80% figure is the pass threshold, not the scoring range. Not applicable is off. This template does not choose where the standard applies.",
  startingThresholdPercent: LEH_WORKPLACE_5S_STARTING_THRESHOLD,
  scoringScale: { min: 1, max: 5, step: 1 },
  categories: [
    {
      name: "Sort",
      description: "Keep only what the work needs.",
      questions: [
        {
          prompt:
            "How consistently are unused tools and materials removed from the line-side area?",
          questionType: "score",
          guidance:
            "Look at the area as it is being used, not only as it was prepared for an audit.",
        },
        {
          prompt:
            "How well does the team keep obsolete parts and packaging out of active workstations?",
          questionType: "score",
        },
        {
          prompt:
            "How clear is red-tag or quarantine discipline for items awaiting a decision?",
          questionType: "score",
        },
        {
          prompt:
            "How reliably is sorting maintained through a normal shift changeover?",
          questionType: "score",
        },
      ],
    },
    {
      name: "Set in Order",
      description: "A place for what remains, easy to find and return.",
      questions: [
        {
          prompt:
            "How easy is it for a new starter to find every item needed for today's build?",
          questionType: "score",
        },
        {
          prompt:
            "How consistently are tools returned to their marked homes after use?",
          questionType: "score",
        },
        {
          prompt:
            "How visible are location labels and shadow boards at the point of use?",
          questionType: "score",
        },
        {
          prompt:
            "How well does the team keep walkways and access routes unobstructed?",
          questionType: "score",
        },
      ],
    },
    {
      name: "Shine",
      description: "Clean enough to see abnormal conditions.",
      questions: [
        {
          prompt:
            "How clean is the area so that oil, debris, or product contamination is spotted quickly?",
          questionType: "score",
        },
        {
          prompt:
            "How consistently are cleaning tasks completed to the posted standard?",
          questionType: "score",
        },
        {
          prompt:
            "How well are cleaning tools stored and ready where the work happens?",
          questionType: "score",
        },
        {
          prompt:
            "How reliably is the shine standard held between planned deep cleans?",
          questionType: "score",
        },
      ],
    },
    {
      name: "Standardise",
      description: "The expected condition is visible where the work happens.",
      questions: [
        {
          prompt:
            "How visible are the expected workplace standards at the point of use?",
          questionType: "score",
        },
        {
          prompt:
            "How consistently does the team follow the agreed methods without reminders?",
          questionType: "score",
        },
        {
          prompt:
            "How clear are visual controls for normal versus abnormal conditions?",
          questionType: "score",
        },
        {
          prompt:
            "How well are standard work updates communicated to everyone on the shift?",
          questionType: "score",
        },
      ],
    },
    {
      name: "Sustain",
      description: "The standard stays in place without a special performance.",
      questions: [
        {
          prompt:
            "How regularly does the team self-check against the 5S standard without prompting?",
          questionType: "score",
        },
        {
          prompt:
            "How consistently are gaps discussed and owned by the people doing the work?",
          questionType: "score",
        },
        {
          prompt:
            "How reliably is the standard maintained week on week, not only before an audit?",
          questionType: "score",
        },
        {
          prompt:
            "How well do leaders reinforce good 5S habits during routine gemba?",
          questionType: "score",
        },
      ],
    },
  ],
};
