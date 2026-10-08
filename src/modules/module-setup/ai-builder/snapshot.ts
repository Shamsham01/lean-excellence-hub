export type ModuleSetupBuilderSnapshot = {
  turns: Array<
    | { id: string; role: "user"; text: string }
    | {
        id: string;
        role: "assistant";
        message: string;
        questions: Array<{ question: string; suggestedAnswers: string[] }>;
        proposalStatus: "none" | "valid" | "invalid";
        proposalIssues: string[];
        responseStatus: "ok" | "invalid_response";
      }
  >;
  pendingQuestions: Array<{ question: string; suggestedAnswers: string[] }>;
  lastTurnInvalid: boolean;
  understanding: Array<{ label: string; value: string }>;
  proposal: {
    messageId: string;
    revision: number;
    name: string;
    description: string;
    thresholdPercent: number | null;
    changeSummary: string[];
    sections: Array<{
      name: string;
      description: string | null;
      items: Array<{ prompt: string; typeLabel: string | null }>;
    }>;
  } | null;
};
