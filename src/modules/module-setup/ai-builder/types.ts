export const MODULE_SETUP_BUILDER_INTERVENTION_KEY = "setup_builder" as const;

export const MODULE_SETUP_BUILDER_MAX_MESSAGE_CHARS = 2000;
export const MODULE_SETUP_BUILDER_MAX_TURNS = 20;
export const MODULE_SETUP_BUILDER_HISTORY_WINDOW = 6;

export type ModuleSetupBuilderIntent = "answer" | "propose" | "refine";

export type ModuleSetupBuilderRequestIntent =
  ModuleSetupBuilderIntent | "retry";

export type ModuleSetupBuilderFocus =
  { kind: "whole" } | { kind: "section"; sectionIndex: number };

export type ModuleSetupDiscoveryQuestion = {
  question: string;
  suggestedAnswers: string[];
};

export type ModuleSetupBuilderProposalStatus = "none" | "valid" | "invalid";

export type ModuleSetupBuilderUserTurn = {
  id: string;
  role: "user";
  text: string;
  createdAt: string;
};

export type ModuleSetupBuilderAssistantTurn = {
  id: string;
  role: "assistant";
  message: string;
  createdAt: string;
  responseStatus: "ok" | "invalid_response";
  phase: "discovery" | "proposal";
  intent: ModuleSetupBuilderIntent;
  focus: ModuleSetupBuilderFocus | null;
  questions: ModuleSetupDiscoveryQuestion[];
  changeSummary: string[];
  proposalStatus: ModuleSetupBuilderProposalStatus;
  proposalIssues: string[];
  proposalRevision: number | null;
};

export type ModuleSetupBuilderTurn =
  ModuleSetupBuilderUserTurn | ModuleSetupBuilderAssistantTurn;

export type ModuleSetupBuilderCurrentProposal<TProposal> = {
  messageId: string;
  revision: number;
  createdAt: string;
  proposal: TProposal;
  sectionCount: number;
  itemCount: number;
  changeSummary: string[];
};

export type ModuleSetupBuilderConversationState<TProposal> = {
  sessionId: string;
  turns: ModuleSetupBuilderTurn[];
  understanding: Record<string, string | null> | null;
  pendingQuestions: ModuleSetupDiscoveryQuestion[];
  currentProposal: ModuleSetupBuilderCurrentProposal<TProposal> | null;
  lastTurnInvalid: boolean;
  userTurnCount: number;
  latestMessageAt: string | null;
};
