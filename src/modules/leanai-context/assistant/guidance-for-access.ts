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
      "LeanAI conversation is not enabled. Page guidance still describes only the access you have."
    );
  }
  if (!input.applicationAvailable) {
    return "LeanAI conversation is turned off in this environment. Page guidance still describes only the access you have.";
  }
  if (!input.organisationEnabled) {
    return "LeanAI conversation is turned off for this organisation. Page guidance still describes only the access you have.";
  }
  return "You do not have permission to use LeanAI conversation. Page guidance still describes only the access you have.";
}
