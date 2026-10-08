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

  if (identity.workflow === "maturity_assessment") {
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: "Maturity assessment",
      contextLabel: "Maturity · Assessment",
      summary:
        "Score the current criterion against the published framework. LeanAI can explain guidance and evidence; it will not choose or save a score.",
      terminology: [
        {
          term: "Criterion",
          meaning:
            "A specific capability under a pillar. Each criterion contains scored questions and optional evidence.",
        },
        {
          term: "Required response",
          meaning:
            "A question that must be answered or marked N/A before the assessment can be completed or submitted.",
        },
      ],
      starterPrompts: [
        "Guide me through this assessment",
        "Explain this criterion",
        "What evidence should I look for?",
        "Help me score this objectively",
        "What is still incomplete?",
      ],
      facts: [
        ...knowledge.facts,
        "LeanAI must not choose or save a maturity score. The assessor records the score in the workspace.",
        "Framework scoring guidance, criterion guidance, and level descriptors are authoritative. LeanAI explains them; it does not replace them.",
      ],
    };
  }

  if (identity.workflow === "maturity_template_preview") {
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: "Maturity Quick Start template",
      contextLabel: "Maturity · Quick Start",
      summary:
        "Preview a curated LEH starting-point framework. Using it creates an organisation-owned draft that you can edit. LeanAI will not deploy or publish it.",
      terminology: [
        {
          term: "Quick Start template",
          meaning:
            "A product-owned starting-point framework. Using it copies the content into your organisation as an editable draft.",
        },
        {
          term: "Organisation-owned draft",
          meaning:
            "The copy created for your organisation. Later updates to the built-in LEH template do not change this copy.",
        },
      ],
      starterPrompts: [
        "Is Quick Start right for us?",
        "Explain this framework",
        "Which parts should we customise?",
        "How should we adapt this to our organisation?",
      ],
      facts: [
        ...knowledge.facts,
        "The LEH Operational Excellence Standard is a recommended starting point, not a mandatory methodology. It assesses operating-system behaviours such as workplace organisation, Gemba, daily management and improvement participation, not whether particular LEH modules are in use.",
        "Use this template creates a draft only. A person must publish it later.",
        "LeanAI must not deploy or publish the template.",
      ],
    };
  }

  if (identity.workflow === "maturity_builder") {
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel: "Maturity · Build with LeanAI",
      summary:
        "Describe how your organisation assesses operations. The builder proposes levels, pillars, criteria and scored questions for you to review and refine. Nothing is saved until you create a draft, and only a person can publish it.",
      terminology: [
        {
          term: "LeanAI proposal",
          meaning:
            "An unsaved suggestion shown for review. It is not a framework until you choose Create draft framework.",
        },
        {
          term: "Draft framework",
          meaning:
            "An organisation-owned, editable framework version. Assessments cannot use it until someone publishes it.",
        },
        {
          term: "Refine",
          meaning:
            "Ask the builder to change one part of the proposal, such as a pillar or criterion, while keeping the rest.",
        },
      ],
      starterPrompts: [
        "How should I describe our framework?",
        "How many maturity levels should we use?",
        "What makes a good scored question?",
        "When should I use Quick Start instead?",
      ],
      facts: [
        ...knowledge.facts,
        "The builder conversation happens in the main page. This assistant explains the process; it does not change the proposal.",
        "Creating a draft is an explicit human action. Publishing happens later in the framework editor.",
        "LEH is the engine, not the methodology: the framework should reflect the organisation's own standards.",
        "Quick Start and manual setup remain available at any time.",
      ],
    };
  }

  if (identity.workflow === "maturity_models") {
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel: "Maturity · Frameworks",
      summary:
        "Start from an LEH template, build a framework with LeanAI, or create one manually. Every route creates an editable draft that a person publishes.",
      terminology: [
        {
          term: "Maturity Framework",
          meaning:
            "The published standard of pillars, criteria, levels, and questions used to assess operational excellence.",
        },
        {
          term: "Quick Start",
          meaning:
            "A curated LEH starting-point framework. It is optional, editable, and deploys as a draft.",
        },
        {
          term: "Criterion",
          meaning:
            "A specific capability inside a pillar that questions measure.",
        },
      ],
      starterPrompts: [
        "Is Quick Start right for us?",
        "Explain this framework",
        "Which parts should we customise?",
        "How should we adapt this to our organisation?",
      ],
      facts: [
        ...knowledge.facts,
        "You can start manually, deploy the LEH Operational Excellence Standard as a draft, or use Build with LeanAI to translate your own framework into a draft.",
        "Quick Start is a starting point, not the one correct Lean system.",
        "LeanAI must not deploy or publish a framework.",
      ],
    };
  }

  if (identity.workflow === "maturity_overview") {
    return {
      module: "maturity",
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel: "Maturity",
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
        "Is Quick Start right for us?",
        "What should I do next?",
        "Is this setup complete?",
      ],
      facts: knowledge.facts,
    };
  }

  if (
    identity.workflow === "five_s_setup" ||
    identity.workflow === "gemba_setup"
  ) {
    const moduleLabel = identity.workflow === "five_s_setup" ? "5S" : "Gemba";
    return {
      module: identity.module,
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel: `${moduleLabel} · Setup`,
      summary: `Choose Manual, LEH Quick Start, or Build with LeanAI for ${moduleLabel}. Each path creates an organisation-owned draft. LeanAI proposes. You review and decide.`,
      terminology: [
        {
          term: "Draft",
          meaning:
            "An organisation-owned configuration that is not operational until a person publishes it.",
        },
      ],
      starterPrompts: [
        "Which setup path should we use?",
        "What does Quick Start create?",
        "Does LeanAI publish anything?",
      ],
      facts: [
        ...knowledge.facts,
        "Manual, Quick Start, and LeanAI all stop at an editable draft.",
        "LeanAI must not publish, choose applicability, or overwrite an existing standard.",
        "The person selects the organisational units the draft applies to.",
      ],
    };
  }

  if (
    identity.workflow === "five_s_quick_start" ||
    identity.workflow === "gemba_quick_start"
  ) {
    return {
      module: identity.module,
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel:
        identity.workflow === "five_s_quick_start"
          ? "5S · Quick Start"
          : "Gemba · Quick Start",
      summary:
        "Preview an optional LEH starting point. Using it creates an organisation-owned draft you can edit. Nothing is published until you publish it.",
      terminology: [
        {
          term: "Quick Start",
          meaning:
            "A source-controlled starting point. Deploying it copies the content into your organisation as a draft.",
        },
      ],
      starterPrompts: [
        "Is this starting point right for us?",
        "What will deploying do?",
        "Can we change the questions afterwards?",
      ],
      facts: [
        ...knowledge.facts,
        "Quick Start is a starting point, not a prescribed Lean method.",
        "Use this starting point creates a draft only.",
        "LeanAI must not deploy the template or choose where it applies.",
      ],
    };
  }

  if (
    identity.workflow === "five_s_builder" ||
    identity.workflow === "gemba_builder"
  ) {
    return {
      module: identity.module,
      workflow: identity.workflow,
      pageTitle: identity.pageTitle,
      contextLabel:
        identity.workflow === "five_s_builder"
          ? "5S · Build with LeanAI"
          : "Gemba · Build with LeanAI",
      summary:
        "Describe how your organisation works. LeanAI proposes a draft for review. Nothing is saved until you create a draft, and only a person can publish it.",
      terminology: [
        {
          term: "Proposal",
          meaning:
            "An unsaved suggestion stored with your conversation. It becomes configuration only when you create a draft.",
        },
      ],
      starterPrompts: [
        "What should I tell the builder?",
        "When should I use Quick Start instead?",
        "Does creating a draft publish it?",
      ],
      facts: [
        ...knowledge.facts,
        "Opening the builder does not call a model. A message or Propose draft does.",
        "Create draft re-reads the trusted proposal. The browser copy is not authoritative.",
        "LeanAI must not publish, assign owners, or choose organisational applicability.",
        "Manual setup and LEH Quick Start remain available.",
      ],
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
    case "five_s_setup":
      return "5S · Setup";
    case "five_s_quick_start":
      return "5S · Quick Start";
    case "five_s_builder":
      return "5S · Build with LeanAI";
    case "gemba":
      return "Gemba";
    case "gemba_setup":
      return "Gemba · Setup";
    case "gemba_quick_start":
      return "Gemba · Quick Start";
    case "gemba_builder":
      return "Gemba · Build with LeanAI";
    case "training":
      return "Training";
    case "skills":
      return "Skills";
    case "recognition":
      return "Recognition";
    case "lean_ai_settings":
      return "LeanAI · Settings";
    case "maturity_template_preview":
      return "Maturity · Quick Start";
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
