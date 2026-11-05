export type HomeAttentionItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "urgent" | "default";
};

export function buildHomeAttentionItems(input: {
  canReadActions: boolean;
  canReadSuggestions: boolean;
  canReadBenefits: boolean;
  overdueActions: number | null;
  ideasAwaitingReview: number | null;
  benefitsAwaitingValidation: number | null;
}): HomeAttentionItem[] {
  const items: HomeAttentionItem[] = [];

  if (
    input.canReadActions &&
    input.overdueActions != null &&
    input.overdueActions > 0
  ) {
    items.push({
      id: "overdue-actions",
      label: "Overdue actions",
      count: input.overdueActions,
      href: "/platform/actions",
      tone: "urgent",
    });
  }

  if (
    input.canReadSuggestions &&
    input.ideasAwaitingReview != null &&
    input.ideasAwaitingReview > 0
  ) {
    items.push({
      id: "suggestions-review",
      label: "Ideas awaiting review",
      count: input.ideasAwaitingReview,
      href: "/platform/suggestions",
      tone: "default",
    });
  }

  if (
    input.canReadBenefits &&
    input.benefitsAwaitingValidation != null &&
    input.benefitsAwaitingValidation > 0
  ) {
    items.push({
      id: "benefits-validation",
      label: "Benefits awaiting validation",
      count: input.benefitsAwaitingValidation,
      href: "/platform/benefits",
      tone: "default",
    });
  }

  return items;
}
