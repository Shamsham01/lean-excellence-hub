import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("LeanAI assistant platform shell integration", () => {
  it("mounts the assistant in PlatformShell rather than duplicating Coach cards", () => {
    const shell = read("src/components/platform/platform-shell.tsx");
    expect(shell).toContain("LeanAiAssistantShell");
    expect(shell).toContain("organisationId");
    expect(shell).toContain(
      "min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:overflow-y-auto",
    );

    const chrome = read("src/components/leanai/leanai-assistant-chrome.tsx");
    expect(chrome).toContain("leanai-assistant-open");
    expect(chrome).toContain("w-[min(100%,24rem)]");
    expect(chrome).toContain("SheetContent");
    expect(chrome).toContain('aria-label="Open LeanAI assistant"');

    const assistantShell = read(
      "src/components/leanai/leanai-assistant-shell.tsx",
    );
    expect(assistantShell).toContain("fallback={null}");
    expect(assistantShell.indexOf("{children}")).toBe(
      assistantShell.lastIndexOf("{children}"),
    );
    expect(assistantShell).not.toMatch(/fallback=\{[^}]*children/);

    const panel = read("src/components/leanai/leanai-assistant-panel.tsx");
    expect(panel).toContain('aria-label="LeanAI assistant"');
    expect(panel).toContain("Ask LeanAI");
    expect(panel).not.toContain("Message LeanAI");
    expect(panel).toContain("aria-live");
    expect(panel).toContain("leanai-assistant-input");
    expect(panel).toContain("LeanAiCoachCard");

    const home = read("src/app/(platform)/platform/page.tsx");
    const setup = read("src/app/(platform)/platform/setup/page.tsx");
    const suggestions = read(
      "src/app/(platform)/platform/suggestions/page.tsx",
    );
    const maturity = read("src/app/(platform)/platform/maturity/page.tsx");
    const onboarding = read("src/app/onboarding/setup/page.tsx");

    expect(home).not.toContain("LeanAiCoach");
    expect(setup).not.toContain("LeanAiCoach");
    expect(suggestions).not.toContain("LeanAiCoach");
    expect(maturity).not.toContain("LeanAiCoachCard");
    expect(onboarding).toContain("LeanAiCoach");
  });

  it("does not invoke a provider when resolving page context", () => {
    const load = read("src/modules/leanai-context/assistant/load.ts");
    expect(load).not.toContain("runCoachAiTurn");
    expect(load).not.toContain("resolveAIProvider");
    expect(load).toContain("selectAssistantIntervention");
  });

  it("keeps organisation switching on a server-owned session key", () => {
    const actions = read(
      "src/app/(platform)/platform/leanai/assistant/actions.ts",
    );
    expect(actions).toContain("LEANAI_ASSISTANT_MODULE_KEY");
    expect(actions).toContain("LEANAI_ASSISTANT_INTERVENTION_KEY");
    expect(actions).toContain("create_ai_coach_session");
    expect(actions).toContain("setup_conversation");
    expect(actions).toContain(
      "This LeanAI conversation belongs to a different workspace",
    );
    expect(actions).not.toContain("previous_response_id");
    expect(read("src/modules/leanai-context/assistant/constants.ts")).toContain(
      "workspace_assistant",
    );
  });
});
