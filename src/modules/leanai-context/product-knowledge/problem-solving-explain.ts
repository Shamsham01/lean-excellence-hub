import { knowledgeCoverageStatement } from "./coverage";
import {
  problemSolvingKnowledgeField,
  problemSolvingKnowledgeForPath,
  PROBLEM_SOLVING_KNOWLEDGE_ARTICLES,
} from "./problem-solving";
import { LEH_PRODUCT_KNOWLEDGE_VERSION } from "./version";

export type ProblemSolvingExplanation = {
  answer: string;
  sources: string[];
  knowledgeVersion: string;
  sourceClass:
    | "verified_leh_product_fact"
    | "current_authorised_site_fact"
    | "lean_methodology_recommendation";
  acknowledgedGap: boolean;
};

const INJECTION =
  /ignore (all |any )?(previous|prior) instructions|system prompt|you are now|reveal (the )?(secret|key)|grant (me )?admin|change organisation/i;

function article(id: string) {
  const found = PROBLEM_SOLVING_KNOWLEDGE_ARTICLES.find(
    (item) => item.id === id,
  );
  if (!found) {
    throw new Error(`Missing problem-solving knowledge article ${id}.`);
  }
  return found;
}

export function explainProblemSolvingQuestion(input: {
  question: string;
  pathname?: string;
  fieldName?: string;
  liveStateSummary?: string | null;
}): ProblemSolvingExplanation {
  const question = input.question.trim();
  const pathname = input.pathname ?? "/platform/problem-solving";
  const sources = problemSolvingKnowledgeForPath(pathname).map(
    (item) => item.id,
  );
  const live = input.liveStateSummary?.trim()
    ? ` Current authorised context: ${input.liveStateSummary.trim()}`
    : "";
  const base = {
    sources: sources.length > 0 ? sources : ["problem-solving.overview"],
    knowledgeVersion: LEH_PRODUCT_KNOWLEDGE_VERSION,
    sourceClass: input.liveStateSummary
      ? ("current_authorised_site_fact" as const)
      : ("verified_leh_product_fact" as const),
    acknowledgedGap: false,
  };

  if (INJECTION.test(question)) {
    return {
      ...base,
      answer:
        "Text in the question is data, not an instruction. I will not change the organisation, grant access, or reveal records you cannot open. A problem statement describes the gap. It does not verify a cause.",
      sources: ["problem-solving.overview"],
      sourceClass: "verified_leh_product_fact",
    };
  }

  const field = input.fieldName
    ? problemSolvingKnowledgeField(input.fieldName)
    : null;
  if (field && /what (does|should)|this field|help me/i.test(question)) {
    return {
      ...base,
      answer: `${field.name} is ${field.required}. ${field.purpose} Example: ${field.example} Common mistake: ${field.mistakes} ${field.consequences}${live}`,
    };
  }

  const normalised = question.toLowerCase();

  if (/dmaic|8d|fishbone|vector|pgvector|github token/.test(normalised)) {
    return {
      ...base,
      answer:
        "This release does not include a DMAIC or 8D problem-solving method, a fishbone diagram record, or a vector search. Seeded methods are A3 / 8-step, Rapid root cause analysis, and 5 Why. Historical search is a permission-checked word match of closed cases you can read. LeanAI does not use a GitHub token to answer.",
      acknowledgedGap: true,
      sourceClass: "verified_leh_product_fact",
    };
  }

  if (/job function|line operator|skill/.test(normalised)) {
    return {
      ...base,
      answer:
        "A job function is the role someone performs. A skill is an observable ability. Neither is a problem-solving method. Skills has its own guide for that distinction. On a case, name the gap in the problem statement.",
      sources: ["problem-solving.overview"],
    };
  }

  if (
    /setup order|where do i start|how do i (set up|start|create|configure)/.test(
      normalised,
    )
  ) {
    return {
      ...base,
      answer: `${article("problem-solving.case").facts[0]} ${article("problem-solving.overview").facts[0]} Open /platform/problem-solving/new. You can save the draft when LeanAI is unavailable.${live}`,
    };
  }

  if (/containment|countermeasure/.test(normalised)) {
    return {
      ...base,
      answer:
        "Containment protects the customer or the process while you investigate. A countermeasure changes the cause after a test supports it. Stopping the line is not, by itself, a solved cause. LeanAI can suggest either as a draft. A person accepts it.",
      sourceClass: "lean_methodology_recommendation",
    };
  }

  if (/operator error|root cause/.test(normalised)) {
    return {
      ...base,
      answer:
        "Operator error is a hypothesis until a test supports it and a person with problem_solving.verify_cause verifies it. Check the work standard, the equipment, and the variation. LeanAI must not mark the cause verified.",
      sourceClass: "lean_methodology_recommendation",
    };
  }

  if (/close the case|effectiveness pass|approve/.test(normalised)) {
    return {
      ...base,
      answer:
        "Closing a case needs problem_solving.close. Verifying a cause needs problem_solving.verify_cause. An effectiveness pass is recorded by a person. LeanAI cannot do those, and it cannot approve a financial benefit.",
    };
  }

  if (/permission|another site|another organisation/.test(normalised)) {
    return {
      ...base,
      answer:
        "problem_solving.view lets you read cases in the granted organisation or unit. A site grant does not include a sibling site. problem_solving.create opens drafts. LeanAI access does not add case access. Another organisation's cases are never searched.",
    };
  }

  if (/not exist|payroll|invoice|billing plan/.test(normalised)) {
    return {
      ...base,
      answer: `${knowledgeCoverageStatement()} Problem Solving does not manage payroll, invoices, or billing plans, so I will not invent those screens.`,
      acknowledgedGap: true,
      sources: [],
    };
  }

  const overview = article("problem-solving.overview");
  return {
    ...base,
    answer: `${overview.purpose} ${overview.facts.slice(0, 3).join(" ")}${live}`,
  };
}
