import { describe, expect, it } from "vitest";

import { buildHomeAttentionItems } from "@/modules/platform-shell/home-attention";

describe("buildHomeAttentionItems", () => {
  it("returns nothing when counts are zero or permissions are off", () => {
    expect(
      buildHomeAttentionItems({
        canReadActions: true,
        canReadSuggestions: true,
        canReadBenefits: true,
        overdueActions: 0,
        ideasAwaitingReview: 0,
        benefitsAwaitingValidation: 0,
      }),
    ).toEqual([]);

    expect(
      buildHomeAttentionItems({
        canReadActions: false,
        canReadSuggestions: false,
        canReadBenefits: false,
        overdueActions: 5,
        ideasAwaitingReview: 3,
        benefitsAwaitingValidation: 2,
      }),
    ).toEqual([]);
  });

  it("orders urgent overdue actions before other attention items", () => {
    expect(
      buildHomeAttentionItems({
        canReadActions: true,
        canReadSuggestions: true,
        canReadBenefits: true,
        overdueActions: 2,
        ideasAwaitingReview: 4,
        benefitsAwaitingValidation: 1,
      }).map((item) => item.id),
    ).toEqual(["overdue-actions", "suggestions-review", "benefits-validation"]);
  });
});
