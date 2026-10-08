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
    "An optional starting point for checking whether a workplace is sorted, set in order, clean enough to see problems, standardised, and sustained by the people who work there.",
  notes:
    "Adapt the categories, questions, scoring and threshold to how your organisation actually works. This template does not choose where the standard applies.",
  startingThresholdPercent: LEH_WORKPLACE_5S_STARTING_THRESHOLD,
  categories: [
    {
      name: "Sort",
      description: "Keep only what the work needs.",
      questions: [
        {
          prompt: "Are unused items removed from the work area?",
          questionType: "yes_no",
          guidance:
            "Look at the area as it is being used, not as it was prepared for the audit.",
        },
        {
          prompt: "Are items that should not stay here clearly separated?",
          questionType: "yes_no",
        },
        {
          prompt:
            "What is still present that the team does not need for today's work?",
          questionType: "short_text",
        },
        {
          prompt:
            "How consistently is sorting done as part of the normal shift?",
          questionType: "score",
          guidance:
            "Score the everyday habit, not a one-off tidy before the audit.",
        },
      ],
    },
    {
      name: "Set in Order",
      description: "A place for what remains, easy to find and return.",
      questions: [
        {
          prompt: "Does every needed item have a defined home location?",
          questionType: "yes_no",
        },
        {
          prompt:
            "Can someone unfamiliar find the required tools without searching?",
          questionType: "yes_no",
        },
        {
          prompt:
            "Where are items currently stored outside their defined location?",
          questionType: "short_text",
        },
        {
          prompt: "How clear are the location markers where the work happens?",
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
            "Is the area clean enough to see leaks, wear or contamination?",
          questionType: "yes_no",
        },
        {
          prompt: "Are cleaning responsibilities visible to the team?",
          questionType: "yes_no",
        },
        {
          prompt:
            "What contamination or wear is visible that should be addressed?",
          questionType: "short_text",
        },
        {
          prompt: "How well is the area maintained between planned cleans?",
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
            "Is the expected workplace condition documented where the work happens?",
          questionType: "yes_no",
        },
        {
          prompt:
            "Can the team explain the current standard without a distant document?",
          questionType: "yes_no",
        },
        {
          prompt: "Which part of the standard is unclear or not followed?",
          questionType: "short_text",
        },
      ],
    },
    {
      name: "Sustain",
      description: "The standard stays in place without a special performance.",
      questions: [
        {
          prompt:
            "Is the workplace condition checked on a rhythm the team recognises?",
          questionType: "yes_no",
        },
        {
          prompt: "Are deviations discussed with the people who do the work?",
          questionType: "yes_no",
        },
        {
          prompt: "What would help this standard stay in place?",
          questionType: "short_text",
        },
        {
          prompt:
            "How reliably is the standard maintained without a special audit?",
          questionType: "score",
        },
      ],
    },
  ],
};
