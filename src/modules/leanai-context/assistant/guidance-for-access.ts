const ADMINISTRATION_PROMPT =
  /recommend a setup|publish|create |invite |set up|deploy|configure the organisation/i;

export function starterPromptsForAccess(input: {
  prompts: readonly string[];
  canAdministerPage: boolean;
}): string[] {
  if (input.canAdministerPage) {
    return [...input.prompts];
  }

  const explanatory = input.prompts.filter(
    (prompt) => !ADMINISTRATION_PROMPT.test(prompt),
  );
  if (explanatory.length > 0) {
    return explanatory;
  }

  return [
    "What can I view with my access?",
    "What is the difference between a job function and a permission?",
  ];
}

export function conversationUnavailableCopy(input: {
  eligible: boolean;
  eligibilityMessage: string | null;
  applicationAvailable: boolean;
  organisationEnabled: boolean;
  canUseConversation: boolean;
}): string | null {
  if (
    input.eligible &&
    input.applicationAvailable &&
    input.organisationEnabled &&
    input.canUseConversation
  ) {
    return null;
  }

  if (!input.eligible) {
    return (
      input.eligibilityMessage ??
      "LeanAI chat is unavailable until subscription access can be verified."
    );
  }
  if (!input.applicationAvailable) {
    return "LeanAI chat is off because AI is not configured in this environment. Setup guidance on this page still works.";
  }
  if (!input.organisationEnabled) {
    return "LeanAI chat is off for this organisation. An administrator can turn it on in AI settings.";
  }
  return "Your role does not include LeanAI chat (ai.use). Ask an administrator to grant access.";
}

/**
 * Single follow-up action when chat is unavailable (panel stays collapsed by default).
 */
export function leanAiConversationUnavailableCta(input: {
  eligible: boolean;
  eligibilityDenied?: boolean;
  applicationAvailable: boolean;
  organisationEnabled: boolean;
  canUseConversation: boolean;
}): { label: string; href: string } | null {
  if (
    input.eligible &&
    input.applicationAvailable &&
    input.organisationEnabled &&
    input.canUseConversation
  ) {
    return null;
  }
  if (!input.eligible && input.eligibilityDenied) {
    return { label: "Review subscription", href: "/platform/settings/billing" };
  }
  if (!input.eligible) {
    return {
      label: "Review billing state",
      href: "/platform/settings/billing",
    };
  }
  if (!input.applicationAvailable) {
    return null;
  }
  if (!input.organisationEnabled) {
    return { label: "Open AI settings", href: "/platform/settings/ai" };
  }
  return { label: "Manage people access", href: "/platform/settings/people" };
}
