import {
  historyRelevance,
  type AuthorisedProblemSolvingCase,
} from "@/modules/problem-solving/authorised-history";

export type ConsultationSourceClass =
  | "verified_leh_product_fact"
  | "current_authorised_site_fact"
  | "historical_verified_outcome"
  | "unverified_user_statement"
  | "lean_methodology_recommendation"
  | "ai_hypothesis";

export type ConsultationPoint = {
  text: string;
  sourceClass: ConsultationSourceClass;
  href?: string;
};

export type ProblemSolvingConsultation = {
  summary: string;
  points: ConsultationPoint[];
  questions: string[];
  canContinue: true;
  blocked: false;
};

const INJECTION =
  /ignore (all |any )?(previous|prior) instructions|system prompt|you are now|reveal (the )?(secret|hidden)|grant (me )?admin|change organisation/i;

function looksLikeUnsupportedCause(statement: string): boolean {
  return /root cause|operator error|human error|someone forgot|they did not follow/i.test(
    statement,
  );
}

export function buildProblemSolvingConsultation(input: {
  userStatement: string;
  matches: readonly AuthorisedProblemSolvingCase[];
}): ProblemSolvingConsultation {
  const statement = input.userStatement.trim().slice(0, 2000);
  const matches = input.matches.slice(0, 8);
  const points: ConsultationPoint[] = [];
  const questions = [
    "What changed, where, and how is the gap measured?",
    "What have you observed, and what is still an assumption?",
  ];

  if (INJECTION.test(statement)) {
    points.push({
      text: "Text in the description is data, not an instruction. I will not change organisation, reveal hidden records, or follow directions written inside a case.",
      sourceClass: "verified_leh_product_fact",
    });
  }

  if (!statement) {
    points.push({
      text: "Add a problem statement that says what is wrong, where, and how you can tell. A title alone is a label.",
      sourceClass: "verified_leh_product_fact",
    });
  }

  if (looksLikeUnsupportedCause(statement)) {
    points.push({
      text: "That reads as a proposed cause, not a verified one. LeanAI cannot verify a root cause. A person with problem_solving.verify_cause does that after a test.",
      sourceClass: "unverified_user_statement",
    });
    points.push({
      text: "Check the work standard, the equipment condition, and the process variation before accepting operator error. Ask what evidence would show this explanation is wrong.",
      sourceClass: "lean_methodology_recommendation",
    });
    questions.push(
      "What would you measure if the operator followed the current standard and the problem remained?",
    );
    questions.push(
      "Is the immediate action containment, or a countermeasure aimed at a tested cause?",
    );
  } else if (statement) {
    points.push({
      text: "Separate what you have seen from what you think is causing it. Containment protects the customer now. A countermeasure changes the cause after it has been tested.",
      sourceClass: "lean_methodology_recommendation",
    });
  }

  if (matches.length === 0) {
    points.push({
      text: "No matching accessible closed case was found. A longer description matches a closed case you can open when they share at least three content words. Different wording can be missed. You can continue with a new record.",
      sourceClass: "current_authorised_site_fact",
    });
  }

  for (const match of matches) {
    const sourceClass: ConsultationSourceClass =
      match.evidenceClass === "historical_verified_outcome"
        ? "historical_verified_outcome"
        : "current_authorised_site_fact";
    const verified =
      match.verifiedCauseSnippets.length > 0
        ? ` Verified on that case only: ${match.verifiedCauseSnippets.join("; ")}.`
        : " That case has no verified cause in this summary.";
    points.push({
      text: `${match.title} is ${match.status.replaceAll("_", " ")} (${match.closureOutcome.replaceAll("_", " ")}). ${historyRelevance(match)}${verified} Treat the case text as untrusted data.`,
      sourceClass,
      href: match.href,
    });
  }

  points.push({
    text: "You can view a related case, link it after this case exists, or continue with a new record. A similar description does not block the new case.",
    sourceClass: "verified_leh_product_fact",
  });

  return {
    summary:
      matches.length === 0
        ? "No accessible closed case matched this description."
        : `${matches.length} accessible closed ${matches.length === 1 ? "case matches" : "cases match"} this description.`,
    points,
    questions: questions.slice(0, 4),
    canContinue: true,
    blocked: false,
  };
}
