import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("NAV-CLICK-001 Suggestions navigation primitives", () => {
  it("uses AppLink on the suggestions hub New, Programmes, and Open queue controls", () => {
    const source = readSource(
      "src/app/(platform)/platform/suggestions/page.tsx",
    );

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="suggestions-new-link"');
    expect(source).toContain('data-testid="suggestions-programmes-link"');
    expect(source).toContain('data-testid="suggestions-open-queue-link"');
    expect(source).toContain('href="/platform/suggestions/new"');
    expect(source).toContain('href="/platform/suggestions/programmes"');
    expect(source).toContain('href="/platform/suggestions/review?queue=mine"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });

  it("uses AppLink for programme administration Back", () => {
    const source = readSource(
      "src/app/(platform)/platform/suggestions/programmes/page.tsx",
    );

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="suggestions-programmes-back-link"');
    expect(source).toContain('href="/platform/suggestions"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });

  it("uses AppLink for suggestion detail Back", () => {
    const source = readSource(
      "src/app/(platform)/platform/suggestions/[suggestionId]/page.tsx",
    );

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="suggestions-detail-back-link"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });

  it("opens a newly submitted suggestion with navigateTo instead of a push/refresh race", () => {
    const source = readSource(
      "src/components/suggestions/new-suggestion-form.tsx",
    );

    expect(source).toContain('from "@/lib/navigation/navigate"');
    expect(source).toContain(
      "navigateTo(`/platform/suggestions/${result.suggestionId}`)",
    );
    expect(source).not.toMatch(/router\.push\(/);
    expect(source).not.toMatch(/router\.refresh\(/);
    expect(source).not.toMatch(/from ["']next\/link["']/);
    expect(source).toContain(
      'data-testid="suggestion-configure-programmes-link"',
    );
    expect(source).toContain('data-testid="suggestion-assign-work-area-link"');
  });

  it("uses AppLink for review workspace View and Back links", () => {
    const source = readSource(
      "src/components/suggestions/review-workspace.tsx",
    );

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="review-view-suggestion"');
    expect(source).toContain('data-testid="review-back-to-queue"');
    expect(source).toContain("href={`/platform/suggestions/${suggestion.id}`}");
    expect(source).toContain('href="/platform/suggestions/review"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
    expect(source).toContain("router.refresh()");
  });

  it("keeps suggestion-to-action and suggestion-to-project success links as AppLink", () => {
    const source = readSource(
      "src/components/suggestions/suggestion-detail.tsx",
    );

    expect(source).toContain('data-testid="suggestion-open-created-action"');
    expect(source).toContain('data-testid="suggestion-open-created-project"');
    expect(source).toContain("Open action");
    expect(source).toContain("Open project");
    expect(source).toContain("navigateTo(`/platform/projects/${result.id}`)");
    expect(source).not.toMatch(/router\.push\(/);
  });
});
