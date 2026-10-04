"use client";

import {
  MarketingContainer,
  MarketingSection,
  SectionIntro,
} from "../primitives";
import { DemoProvider, useDemoDispatch } from "./demo-store";
import { DemoWorkspace } from "./workspace";

export function MarketingInteractiveExperience() {
  return (
    <DemoProvider>
      <MarketingSection
        id="try-leh"
        className="marketing-defer leh-demo-section"
      >
        <MarketingContainer wide>
          <SectionIntro
            kicker="Try LEH"
            title="Experience improvement, not another product tour."
          >
            <p>
              Submit an idea, create an action, run a Gemba observation or
              explore problem solving inside an interactive Lean Excellence Hub
              workspace.
            </p>
            <p className="mt-3 text-[0.95rem] text-muted-foreground">
              Nothing is saved. This workspace uses temporary example data.
            </p>
          </SectionIntro>
          <StartSuggestionControl />
          <div className="leh-demo-frame">
            <DemoWorkspace />
          </div>
        </MarketingContainer>
      </MarketingSection>
    </DemoProvider>
  );
}

function StartSuggestionControl() {
  const dispatch = useDemoDispatch();

  return (
    <div className="mt-6 mb-8">
      <button
        type="button"
        className="leh-async-action"
        data-testid="leh-demo-start-suggestion"
        onClick={() =>
          dispatch({ type: "select-scenario", scenario: "suggestion" })
        }
      >
        Start with a suggestion
      </button>
    </div>
  );
}
