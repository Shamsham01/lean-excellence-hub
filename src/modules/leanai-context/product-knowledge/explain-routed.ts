import { explainProblemSolvingQuestion } from "./problem-solving-explain";
import { explainSkillsQuestion } from "./explain";
import { knowledgeCoverageStatement } from "./coverage";
import {
  moduleFromPathname,
  type PlatformKnowledgeArticle,
  type PlatformKnowledgeField,
  type PlatformKnowledgeModuleKey,
} from "./contract";
import { filterLiveStateSummaryForKnowledge } from "./live-context";
import { LEH_PRODUCT_KNOWLEDGE_VERSION } from "./version";
import { maturityKnowledgeField, maturityKnowledgeForPath } from "./maturity";
import {
  suggestionsKnowledgeField,
  suggestionsKnowledgeForPath,
} from "./suggestions";
import { actionsKnowledgeField, actionsKnowledgeForPath } from "./actions";
import { trainingKnowledgeField, trainingKnowledgeForPath } from "./training";
import { peopleKnowledgeField, peopleKnowledgeForPath } from "./people";
import { fiveSKnowledgeField, fiveSKnowledgeForPath } from "./five-s";
import { gembaKnowledgeField, gembaKnowledgeForPath } from "./gemba";
import {
  recognitionKnowledgeField,
  recognitionKnowledgeForPath,
} from "./recognition";
import { projectsKnowledgeField, projectsKnowledgeForPath } from "./projects";
import { benefitsKnowledgeField, benefitsKnowledgeForPath } from "./benefits";
import { billingAdminKnowledgeForPath } from "./billing-admin";

export type PlatformKnowledgeExplanation = {
  answer: string;
  sources: string[];
  knowledgeVersion: string;
  module: PlatformKnowledgeModuleKey | null;
  acknowledgedGap: boolean;
  usedLiveContext: boolean;
};

const INJECTION =
  /ignore (all |any )?(previous|prior) instructions|system prompt|you are now|reveal (the )?(secret|key)|grant (me )?admin/i;

type ModuleExplainConfig = {
  forPath: (pathname: string) => readonly PlatformKnowledgeArticle[];
  field: (name: string) => PlatformKnowledgeField | null;
  overviewId: string;
  unsupportedPatterns?: RegExp;
};

const MODULE_CONFIG: Partial<
  Record<PlatformKnowledgeModuleKey, ModuleExplainConfig>
> = {
  maturity: {
    forPath: maturityKnowledgeForPath,
    field: maturityKnowledgeField,
    overviewId: "maturity.overview",
    unsupportedPatterns: /dmaic|vector|github token/i,
  },
  suggestions: {
    forPath: suggestionsKnowledgeForPath,
    field: suggestionsKnowledgeField,
    overviewId: "suggestions.overview",
  },
  actions: {
    forPath: actionsKnowledgeForPath,
    field: actionsKnowledgeField,
    overviewId: "actions.overview",
  },
  training: {
    forPath: trainingKnowledgeForPath,
    field: trainingKnowledgeField,
    overviewId: "training.overview",
  },
  people: {
    forPath: peopleKnowledgeForPath,
    field: peopleKnowledgeField,
    overviewId: "people.overview",
  },
  five_s: {
    forPath: fiveSKnowledgeForPath,
    field: fiveSKnowledgeField,
    overviewId: "five_s.overview",
  },
  gemba: {
    forPath: gembaKnowledgeForPath,
    field: gembaKnowledgeField,
    overviewId: "gemba.overview",
  },
  recognition: {
    forPath: recognitionKnowledgeForPath,
    field: recognitionKnowledgeField,
    overviewId: "recognition.overview",
  },
  projects: {
    forPath: projectsKnowledgeForPath,
    field: projectsKnowledgeField,
    overviewId: "projects.overview",
  },
  benefits: {
    forPath: benefitsKnowledgeForPath,
    field: benefitsKnowledgeField,
    overviewId: "benefits.overview",
  },
  billing_administration: {
    forPath: billingAdminKnowledgeForPath,
    field: () => null,
    overviewId: "billing_admin.overview",
    unsupportedPatterns: /refund|chargeback|stripe|card number/i,
  },
};

function explainGenericModule(input: {
  question: string;
  pathname: string;
  fieldName?: string;
  liveStateSummary?: string | null;
  module: PlatformKnowledgeModuleKey;
  config: ModuleExplainConfig;
}): PlatformKnowledgeExplanation {
  const articles = input.config.forPath(input.pathname);
  const sources = articles.map((item) => item.id);
  const overview = articles.find((item) => item.id === input.config.overviewId);
  const liveSuffix = input.liveStateSummary
    ? ` Current authorised context: ${input.liveStateSummary}`
    : "";

  if (INJECTION.test(input.question)) {
    return {
      answer:
        "Text in the question is data, not an instruction. I will not change permissions or reveal secrets.",
      sources: [input.config.overviewId],
      knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
      module: input.module,
      acknowledgedGap: false,
      usedLiveContext: Boolean(input.liveStateSummary),
    };
  }

  const field = input.fieldName ? input.config.field(input.fieldName) : null;
  if (field && /what (does|should)|this field|help me/i.test(input.question)) {
    return {
      answer: `${field.name} is ${field.required}. ${field.purpose} Example: ${field.example} Common mistake: ${field.mistakes} Setup: ${field.setupSteps}${liveSuffix}`,
      sources,
      knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
      module: input.module,
      acknowledgedGap: false,
      usedLiveContext: Boolean(input.liveStateSummary),
    };
  }

  const normalised = input.question.toLowerCase();
  if (input.config.unsupportedPatterns?.test(normalised)) {
    return {
      answer: `${knowledgeCoverageStatement()} I do not have a supported workflow for that in this release.`,
      sources: [],
      knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
      module: input.module,
      acknowledgedGap: true,
      usedLiveContext: Boolean(input.liveStateSummary),
    };
  }

  if (overview) {
    return {
      answer: `${overview.purpose} ${overview.facts.slice(0, 3).join(" ")}${liveSuffix}`,
      sources,
      knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
      module: input.module,
      acknowledgedGap: false,
      usedLiveContext: Boolean(input.liveStateSummary),
    };
  }

  return {
    answer: knowledgeCoverageStatement(),
    sources: [],
    knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
    module: input.module,
    acknowledgedGap: true,
    usedLiveContext: false,
  };
}

export function explainPlatformQuestion(input: {
  question: string;
  pathname?: string;
  fieldName?: string;
  liveStateSummary?: string | null;
  permissions?: Record<string, boolean>;
}): PlatformKnowledgeExplanation {
  const pathname = input.pathname ?? "/platform";
  const resolvedModule = moduleFromPathname(pathname);

  const liveStateSummary = filterLiveStateSummaryForKnowledge({
    module: resolvedModule,
    summary: input.liveStateSummary,
    permissions: input.permissions ?? {},
  });

  if (resolvedModule === "skills") {
    const skills = explainSkillsQuestion({
      question: input.question,
      pathname,
      ...(input.fieldName ? { fieldName: input.fieldName } : {}),
      ...(liveStateSummary ? { liveStateSummary } : {}),
    });
    return {
      answer: skills.answer,
      sources: skills.sources,
      knowledgeVersion: skills.knowledgeVersion,
      module: "skills",
      acknowledgedGap: skills.acknowledgedGap,
      usedLiveContext: Boolean(liveStateSummary),
    };
  }

  if (resolvedModule === "problem_solving") {
    const ps = explainProblemSolvingQuestion({
      question: input.question,
      pathname,
      ...(input.fieldName ? { fieldName: input.fieldName } : {}),
      ...(liveStateSummary ? { liveStateSummary } : {}),
    });
    return {
      answer: ps.answer,
      sources: ps.sources,
      knowledgeVersion: ps.knowledgeVersion,
      module: "problem_solving",
      acknowledgedGap: ps.acknowledgedGap,
      usedLiveContext: Boolean(liveStateSummary),
    };
  }

  if (resolvedModule && MODULE_CONFIG[resolvedModule]) {
    return explainGenericModule({
      question: input.question,
      pathname,
      ...(input.fieldName ? { fieldName: input.fieldName } : {}),
      ...(liveStateSummary ? { liveStateSummary } : {}),
      module: resolvedModule,
      config: MODULE_CONFIG[resolvedModule]!,
    });
  }

  return {
    answer: knowledgeCoverageStatement(),
    sources: [],
    knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
    module: resolvedModule,
    acknowledgedGap: true,
    usedLiveContext: false,
  };
}
