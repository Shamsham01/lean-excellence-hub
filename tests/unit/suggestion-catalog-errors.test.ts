import { describe, expect, it } from "vitest";

import { toSuggestionCatalogErrorMessage } from "@/modules/suggestions/customer-errors";

describe("suggestion catalog customer errors", () => {
  it("maps referenced category deletion to friendly lifecycle guidance", () => {
    expect(
      toSuggestionCatalogErrorMessage(
        {
          message: "category is referenced by suggestions; deactivate instead",
        },
        "Unable to delete this category.",
      ),
    ).toBe(
      "This category has already been used by suggestions and cannot be deleted. Deactivate it instead to prevent future use.",
    );
  });

  it("hides raw database error codes", () => {
    expect(
      toSuggestionCatalogErrorMessage(
        { message: "55000: category is referenced" },
        "Unable to delete this category.",
      ),
    ).toBe("Unable to delete this category.");
  });

  it("maps duplicate programme code constraint to friendly guidance", () => {
    expect(
      toSuggestionCatalogErrorMessage(
        {
          message:
            'duplicate key value violates unique constraint "suggestion_programmes_org_code_key"',
        },
        "Unable to create this programme.",
      ),
    ).toBe(
      "A programme with this code already exists. Choose a different name or custom code.",
    );
  });

  it("maps duplicate category code constraint to friendly guidance", () => {
    expect(
      toSuggestionCatalogErrorMessage(
        {
          message:
            'duplicate key value violates unique constraint "suggestion_categories_org_code_key"',
        },
        "Unable to create this category.",
      ),
    ).toBe(
      "A category with this code already exists. Choose a different name or custom code.",
    );
  });
});
