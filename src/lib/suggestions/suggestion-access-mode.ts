export type SuggestionAccessMode = "portfolio" | "contributor" | "denied";

export function suggestionAccessMode(input: {
  canReadPortfolio: boolean;
  canSubmit: boolean;
  canViewWorkplace: boolean;
}): SuggestionAccessMode {
  if (input.canReadPortfolio) return "portfolio";
  if (input.canSubmit || input.canViewWorkplace) return "contributor";
  return "denied";
}
