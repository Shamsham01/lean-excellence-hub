import { coachProductKnowledgeFor } from "@/modules/leanai-context/coach/product-knowledge";

import {
  MATURITY_AUTHORING_STEP_LABELS,
  type MaturityAuthoringStep,
} from "./constants";
import type {
  AssistantPageDefinition,
  AssistantRouteIdentity,
  AssistantTerminologyEntry,
} from "./types";

const PROGRAMME_MEANING =
  "A Suggestion Programme is the improvement initiative or campaign under which a suggestion is submitted. Examples of kinds of programmes include Continuous Improvement, Cost Reduction, or Community Improvement.";

const CATEGORY_MEANING =
  "A category is a reusable organisation-level classification describing what kind of idea it is, such as Safety, Quality, Technology, Community, Automation, Cost, or Sustainability. Categories are not children of a programme.";

function maturityStepStarters(step: MaturityAuthoringStep | null): string[] {
  switch (step) {
    case "levels":
      return [
        "Explain maturity levels.",
        "How many levels should I use?",
        "Guide me through this page",
      ];
    case "pillars":
      return ["What is a pillar?", "Recommend pillars", "Review my structure"];
    case "criteria":
      return [
        "What is a criterion?",
        "What makes a good criterion?",
        "Suggest criteria for this pillar",
      ];
    case "questions":
      return [
        "Help me write questions",
        "What makes a good maturity question?",
        "Review what I have so far",
      ];
    case "review":
      return [
        "What is missing?",
        "Review this framework structure",
        "Is this framework ready?",
      ];
    case "publish":
      return [
        "Is it ready?",
        "What happens after publishing?",
        "What should I check before publishing?",
      ];
    case "scopes":
      return [
        "What is assessment scope?",
        "Which scopes should I enable?",
        "Guide me through this page",
      ];
    case "details":
    default:
      return [
        "What is a Maturity Framework?",
        "What should I fill in here?",
        "Guide me through this page",
      ];
  }
}

function definitionFor(
  identity: AssistantRouteIdentity,
): AssistantPageDefinition {
  const knowledge = coachProductKnowledgeFor(identity.module);

  if (identity.workflow === "programme_configuration") {
    return {
      module: "suggestions",
      workflow: identity.workflow,
      pageTitle: "Suggestions configuration",
      contextLabel: "Suggestions · Configuration",
      summary:
        "Configure Suggestion Programmes and the organisation-level category catalogue used when people submit ideas.",
      terminology: [
        { term: "Programme", meaning: PROGRAMME_MEANING },
        { term: "Category", meaning: CATEGORY_MEANING },
      ],
      starterPrompts: [
        "What is a programme?",
        "What are categories?",
        "Recommend a setup",
        "Guide me through this page",
      ],
      facts: [
        "A programme is the campaign people submit under. It is not a category.",
        "Categories are maintained as a separate organisation-level catalogue.",
        "People cannot submit ideas until an active programme has a published version.",
        "LeanAI will not publish a programme for you.",
      ],
    };
  }

  if (identity.workflow === "suggestions_overview") {
    return {
      module: "suggestions",
      workflow: identity.workflow,
      pageTitle: "Suggestions",
      contextLabel: "Suggestions",
      summary:
        "Capture, review, and implement improvement ideas. Submissions require an active published Suggestion Programme.",
      terminology: [
        { term: "Programme", meaning: PROGRAMME_MEANING },
        { term: "Category", meaning: CATEGORY_MEANING },
      ],
      starterPrompts: [
        "What is a Suggestion Programme?",
        "What is the difference between a Programme and Category?",
        "What should I do next?",
      ],
      facts: knowledge.facts,
    };
  }

  if (identity.workflow === "maturity_authoring") {
    const step = identity.authoringStep ?? "details";
    const stepLabel = MATURITY_AUTHORING_STEP_LABELS[step];
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: `Maturity framework · ${stepLabel}`,
      contextLabel: `Maturity · ${stepLabel}`,
      summary: maturityStepSummary(step),
      terminology: maturityTerminology(step),
      starterPrompts: maturityStepStarters(step),
      facts: [
        ...knowledge.facts,
        "Authoring tabs change the current LeanAI page context. Conversation history is kept, but the live page is this step.",
        "LeanAI does not publish, delete, or rewrite the framework. An authorised person applies changes in Maturity authoring.",
      ],
    };
  }

  if (
    identity.workflow === "maturity_overview" ||
    identity.workflow === "maturity_models"
  ) {
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel:
        identity.workflow === "maturity_models"
          ? "Maturity · Frameworks"
          : "Maturity",
      summary: knowledge.summary,
      terminology: [
        {
          term: "Maturity Framework",
          meaning:
            "The published standard of pillars, criteria, levels, and questions used to assess operational excellence.",
        },
        {
          term: "Pillar",
          meaning:
            "A major theme of the framework, such as Leadership or Delivery. Pillars group criteria.",
        },
        {
          term: "Criterion",
          meaning:
            "A specific capability inside a pillar that questions measure.",
        },
      ],
      starterPrompts: [
        "What is a Maturity Framework?",
        "What should I do next?",
        "Is this setup complete?",
      ],
      facts: knowledge.facts,
    };
  }

  if (identity.workflow === "structure") {
    return {
      module: "sites",
      workflow: identity.workflow,
      pageTitle: "Organisation structure",
      contextLabel: "Organisation · Structure",
      summary:
        "Design how your sites, departments, areas and teams are organised. LeanAI can recommend a structure; you apply changes on this page.",
      terminology: [
        {
          term: "Organisation unit",
          meaning:
            "A place or team in the hierarchy, such as a department, area or team. Units keep stable identifiers and are archived rather than deleted.",
        },
        {
          term: "Site",
          meaning:
            "A billable security boundary such as a plant, factory or location. Site creation is not a routine unit-type choice on this page.",
        },
      ],
      starterPrompts: [
        "Recommend a structure",
        "Explain organisational units",
        "How should I structure my organisation?",
        "What should go under this site?",
      ],
      facts: [
        ...knowledge.facts,
        "LeanAI may recommend a structure conversationally. Hierarchy changes stay human-approved actions on this page.",
      ],
    };
  }

  return {
    module: identity.module,
    workflow: identity.workflow,
    pageTitle: identity.pageTitle,
    contextLabel: defaultContextLabel(identity),
    summary: knowledge.summary,
    terminology: defaultTerminology(identity),
    starterPrompts: [
      "What is this page for?",
      "What should I do next?",
      "Is this setup complete?",
      "Guide me through this page",
    ],
    facts: knowledge.facts,
  };
}

function maturityStepSummary(step: MaturityAuthoringStep): string {
  switch (step) {
    case "details":
      return "Name and describe this Maturity Framework so teams recognise the standard they will assess against.";
    case "scopes":
      return "Choose which organisational scopes this framework can assess, such as site or team.";
    case "levels":
      return "Define the maturity scale. Levels describe increasing capability, not job grades.";
    case "pillars":
      return "Pillars are the major themes of the framework. They should cover how this organisation wants to measure operational excellence.";
    case "criteria":
      return "Criteria sit under pillars and describe specific capabilities that questions will measure.";
    case "questions":
      return "Questions should be observable and scorable against the levels. LeanAI can help draft them; you review and save.";
    case "review":
      return "Check structure completeness before publishing: levels, pillars, criteria, and measurable questions.";
    case "publish":
      return "Publishing makes this version the operational standard. LeanAI will not publish it for you.";
  }
}

function maturityTerminology(
  step: MaturityAuthoringStep,
): AssistantTerminologyEntry[] {
  const shared: AssistantTerminologyEntry[] = [
    {
      term: "Pillar",
      meaning:
        "A major theme of the framework. A pillar groups related criteria; it is not itself a scored question.",
    },
    {
      term: "Criterion",
      meaning:
        "A specific capability under a pillar. Each criterion should have measurable questions.",
    },
    {
      term: "Level",
      meaning:
        "A step on the maturity scale describing increasing capability. Levels are not organisation units or job titles.",
    },
  ];
  if (step === "questions") {
    return [
      ...shared,
      {
        term: "Question",
        meaning:
          "An observable prompt scored against the levels. Prefer evidence over opinion.",
      },
    ];
  }
  return shared;
}

function defaultContextLabel(identity: AssistantRouteIdentity): string {
  switch (identity.workflow) {
    case "platform_home":
      return "Workspace";
    case "organisation_setup":
      return "Organisation · Setup";
    case "organisation_profile":
      return "Organisation · Profile";
    case "structure":
      return "Organisation · Structure";
    case "job_functions":
      return "People · Job functions";
    case "people":
      return "People";
    case "five_s":
      return "5S";
    case "gemba":
      return "Gemba";
    case "training":
      return "Training";
    case "skills":
      return "Skills";
    case "recognition":
      return "Recognition";
    case "lean_ai_settings":
      return "LeanAI · Settings";
    default:
      return identity.pageTitle;
  }
}

function defaultTerminology(
  identity: AssistantRouteIdentity,
): AssistantTerminologyEntry[] {
  const knowledge = coachProductKnowledgeFor(identity.module);
  return [
    {
      term: identity.pageTitle,
      meaning: knowledge.summary,
    },
  ];
}

export function assistantPageDefinitionFor(
  identity: AssistantRouteIdentity,
): AssistantPageDefinition {
  return definitionFor(identity);
}

export { PROGRAMME_MEANING, CATEGORY_MEANING };
