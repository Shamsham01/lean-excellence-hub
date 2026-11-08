import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLATFORM_KNOWLEDGE_COVERAGE,
  knowledgeCoverageStatement,
} from "@/modules/leanai-context/product-knowledge/coverage";
import { explainPlatformQuestion } from "@/modules/leanai-context/product-knowledge/explain-routed";
import { filterLiveStateSummaryForKnowledge } from "@/modules/leanai-context/product-knowledge/live-context";
import {
  PLATFORM_KNOWLEDGE_MODULE_REGISTRY,
  allPlatformKnowledgeFieldGaps,
} from "@/modules/leanai-context/product-knowledge/registry";
import { SUGGESTION_STATUSES } from "@/lib/suggestions/status";
import { ACTION_STATUSES } from "@/lib/actions/status";
import { LEH_PRODUCT_KNOWLEDGE_VERSION } from "@/modules/leanai-context/product-knowledge/version";

const root = process.cwd();

describe("platform product knowledge bundle", () => {
  it("has no audited field gaps across registered modules", () => {
    const gaps = allPlatformKnowledgeFieldGaps();
    for (const entry of PLATFORM_KNOWLEDGE_MODULE_REGISTRY) {
      expect(gaps[entry.module], entry.module).toEqual([]);
    }
  });

  it("tracks release version and honest coverage statement", () => {
    expect(LEH_PRODUCT_KNOWLEDGE_VERSION).toBe("2026-11-08");
    expect(knowledgeCoverageStatement()).toMatch(/first-wave/);
    const complete = PLATFORM_KNOWLEDGE_COVERAGE.filter(
      (row) => row.status === "complete",
    ).map((row) => row.module);
    expect(complete).toEqual(
      expect.arrayContaining([
        "skills",
        "problem_solving",
        "maturity",
        "suggestions",
        "actions",
        "training",
      ]),
    );
  });

  it("matches suggestion and action status contracts in bundle text", () => {
    const gaps = PLATFORM_KNOWLEDGE_MODULE_REGISTRY.flatMap((entry) =>
      entry.fieldGaps(),
    );
    const suggestionBundle = readFileSync(
      path.join(
        root,
        "src/modules/leanai-context/product-knowledge/suggestions.ts",
      ),
      "utf8",
    );
    expect(suggestionBundle).toContain("SUGGESTION_STATUSES");
    expect(suggestionBundle).toMatch(/SUGGESTION_STATUSES\.join\(/);

    const actionsBundle = readFileSync(
      path.join(root, "src/modules/leanai-context/product-knowledge/actions.ts"),
      "utf8",
    );
    expect(actionsBundle).toContain("ACTION_STATUSES");
    expect(actionsBundle).toMatch(/ACTION_STATUSES\.join\(/);
    expect(gaps).toEqual([]);
  });
});

describe("explainPlatformQuestion", () => {
  it("routes maturity and suggestions deterministically", () => {
    const maturity = explainPlatformQuestion({
      question: "What does this field do?",
      pathname: "/platform/maturity/models",
      fieldName: "Assessment type",
    });
    expect(maturity.module).toBe("maturity");
    expect(maturity.acknowledgedGap).toBe(false);
    expect(maturity.answer).toMatch(/self or formal/i);

    const suggestions = explainPlatformQuestion({
      question: "Help me with this field",
      pathname: "/platform/suggestions/programmes",
      fieldName: "Category",
    });
    expect(suggestions.module).toBe("suggestions");
    expect(suggestions.answer).toMatch(/organisation level/i);
  });

  it("acknowledges unsupported capabilities instead of inventing them", () => {
    const billing = explainPlatformQuestion({
      question: "What is my card number on file?",
      pathname: "/platform/settings/billing",
    });
    expect(billing.acknowledgedGap).toBe(true);
    expect(billing.answer).toMatch(/does not have|gap/i);
  });

  it("falls back to coverage statement for unknown routes", () => {
    const unknown = explainPlatformQuestion({
      question: "What is Schedule?",
      pathname: "/platform/schedule",
    });
    expect(unknown.acknowledgedGap).toBe(true);
    expect(unknown.answer).toMatch(/release-matched|bundle/i);
  });
});

describe("permission-filtered live context", () => {
  it("redacts sensitive live lines without manage permission", () => {
    const filtered = filterLiveStateSummaryForKnowledge({
      module: "maturity",
      summary: "Published levels: 3\nDraft count: 2 unpublished criteria",
      permissions: { "maturity.read": true },
    });
    expect(filtered).toMatch(/Published levels/);
    expect(filtered).not.toMatch(/Draft count/);
  });

  it("keeps draft detail when the member can manage", () => {
    const filtered = filterLiveStateSummaryForKnowledge({
      module: "maturity",
      summary: "Published levels: 3\nDraft count: 2 unpublished criteria",
      permissions: {
        "maturity.read": true,
        "maturity.models.manage": true,
      },
    });
    expect(filtered).toMatch(/Draft count/);
  });

  it("marks explanations that used live context", () => {
    const answer = explainPlatformQuestion({
      question: "What should I see?",
      pathname: "/platform/actions",
      liveStateSummary: "Open actions: 4",
      permissions: { "actions.read": true, "actions.update": true },
    });
    expect(answer.usedLiveContext).toBe(true);
    expect(answer.answer).toMatch(/Open actions|follow-up/i);
  });
});
