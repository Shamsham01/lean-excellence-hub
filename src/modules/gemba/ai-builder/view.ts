import type { ModuleSetupBuilderSnapshot } from "@/modules/module-setup/ai-builder/snapshot";
import type { ModuleSetupBuilderConversationState } from "@/modules/module-setup/ai-builder/types";

import { GEMBA_UNDERSTANDING_FIELDS, type GembaBuilderProposal } from "./types";

export function gembaBuilderSnapshot(
  conversation: ModuleSetupBuilderConversationState<GembaBuilderProposal>,
): ModuleSetupBuilderSnapshot {
  const understanding = GEMBA_UNDERSTANDING_FIELDS.flatMap(([key, label]) => {
    const value = conversation.understanding?.[key];
    return value ? [{ label, value }] : [];
  });
  const proposal = conversation.currentProposal;
  return {
    turns: conversation.turns.map((turn) =>
      turn.role === "user"
        ? { id: turn.id, role: "user", text: turn.text }
        : {
            id: turn.id,
            role: "assistant",
            message: turn.message,
            questions: turn.questions,
            proposalStatus: turn.proposalStatus,
            proposalIssues: turn.proposalIssues,
            responseStatus: turn.responseStatus,
          },
    ),
    pendingQuestions: conversation.pendingQuestions,
    lastTurnInvalid: conversation.lastTurnInvalid,
    understanding,
    proposal: proposal
      ? {
          messageId: proposal.messageId,
          revision: proposal.revision,
          name: proposal.proposal.name,
          description: proposal.proposal.description,
          thresholdPercent: null,
          changeSummary: proposal.changeSummary,
          sections: proposal.proposal.sections.map((section) => ({
            name: section.name,
            description: section.description,
            items: section.prompts.map((prompt) => ({
              prompt: prompt.prompt,
              typeLabel: null,
            })),
          })),
        }
      : null,
  };
}
