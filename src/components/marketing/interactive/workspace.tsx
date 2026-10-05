"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ImprovementProgress } from "@/components/ui/improvement-progress";
import { MarketingWordmark } from "@/components/marketing/primitives";

import { ActionFlow } from "./action-flow";
import {
  DEMO_MANAGER,
  DEMO_SITE,
  DEMO_VISITOR,
  MODULE_NAV,
  type DemoScenarioId,
} from "./demo-model";
import { GembaActionCompose, GembaFlow } from "./gemba-flow";
import { MaturityFlow } from "./maturity-flow";
import { DemoNotificationBell, DemoNotificationCentre } from "./notifications";
import { ProblemSolvingFlow } from "./problem-solving-flow";
import { DemoScenarioSelector, DemoStatus } from "./primitives";
import {
  SuggestionActionCompose,
  SuggestionActionSuccess,
  SuggestionFlow,
} from "./suggestion-flow";
import { unreadCount, useDemoDispatch, useDemoState } from "./demo-store";

function workflowLabel(view: string, module: string) {
  if (view === "selector") {
    return "Choose a workflow";
  }
  if (view.includes("success")) {
    return "Ready";
  }
  if (view.includes("review")) {
    return "In review";
  }
  if (
    view.includes("form") ||
    view.includes("compose") ||
    view.includes("walk")
  ) {
    return "In progress";
  }
  if (module === "maturity") {
    return "Illustrative preview";
  }
  return "Workspace";
}

export function DemoWorkspace() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = canvasRef.current;
    if (node) {
      node.scrollTop = 0;
    }
  }, [state.view, state.perspective]);

  return (
    <section
      ref={setShell}
      className="leh-demo-workspace"
      data-testid="leh-demo-workspace"
      data-perspective={state.perspective}
      aria-label="LEH Interactive Workspace"
    >
      <div className="leh-demo-chrome">
        <div className="leh-demo-brand">
          <MarketingWordmark compact />
          <p className="leh-demo-product-name">LEH Interactive Workspace</p>
        </div>
        <p className="leh-demo-context">
          <span>{DEMO_SITE}</span>
          <span aria-hidden="true">·</span>
          <span>
            {state.perspective === "manager" ? DEMO_MANAGER : DEMO_VISITOR}
          </span>
        </p>
        <div className="leh-demo-chrome-tools">
          <DemoStatus tone={state.view === "selector" ? "neutral" : "accent"}>
            {workflowLabel(state.view, state.module)}
          </DemoStatus>
          <DemoNotificationBell />
          <button
            type="button"
            className="leh-demo-ghost leh-demo-reset"
            data-testid="leh-demo-reset"
            onClick={() => dispatch({ type: "reset" })}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Reset demo
          </button>
        </div>
      </div>

      <p className="leh-demo-banner">
        <span className="leh-demo-banner-label">DEMO WORKSPACE</span>
        <span>Example data · not customer records</span>
      </p>

      {state.perspective === "manager" ? (
        <p className="leh-demo-perspective" data-testid="leh-demo-perspective">
          Viewing as: {DEMO_MANAGER}
        </p>
      ) : null}

      <div className="leh-demo-shell-body">
        <nav className="leh-demo-nav" aria-label="Demo modules">
          {MODULE_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="leh-demo-nav-item"
              aria-current={state.module === item.id ? "page" : undefined}
              onClick={() => dispatch({ type: "set-module", module: item.id })}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div ref={canvasRef} className="leh-demo-canvas">
          {state.progress ? (
            <ImprovementProgress
              activeIndex={Math.min(
                2,
                Math.floor(
                  (state.progress.stepIndex / state.progress.stepCount) * 3,
                ),
              )}
              label={state.progress.label}
            />
          ) : null}
          <div
            className="leh-demo-stage"
            data-view={state.view}
            data-perspective={state.perspective}
          >
            <DemoCanvas />
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {state.progress?.label ?? state.liveMessage}
      </div>
      {unreadCount(state) > 0 ? (
        <div className="sr-only" aria-live="polite">
          {unreadCount(state)} unread notifications
        </div>
      ) : null}

      <DemoNotificationCentre container={shell} />
    </section>
  );
}

function DemoCanvas() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();

  if (state.view === "selector") {
    return (
      <DemoScenarioSelector
        onSelect={(id: DemoScenarioId) =>
          dispatch({ type: "select-scenario", scenario: id })
        }
      />
    );
  }

  if (state.view === "action-compose") {
    if (state.actionSource === "gemba") {
      return <GembaActionCompose />;
    }
    if (state.actionSource === "suggestion") {
      return <SuggestionActionCompose />;
    }
    return <ActionFlow />;
  }

  if (state.view === "action-success" && state.actionSource === "suggestion") {
    return <SuggestionActionSuccess />;
  }

  if (
    state.view === "lineage" &&
    state.gemba &&
    state.actionSource === "gemba"
  ) {
    return <GembaFlow />;
  }

  if (
    state.view.startsWith("suggestion") ||
    (state.view === "lineage" && state.actionSource === "suggestion")
  ) {
    return <SuggestionFlow />;
  }

  if (state.view.startsWith("gemba")) {
    return <GembaFlow />;
  }

  if (state.view.startsWith("action")) {
    return <ActionFlow />;
  }

  if (state.view === "problem-solving") {
    return <ProblemSolvingFlow />;
  }

  if (state.view.startsWith("maturity")) {
    return <MaturityFlow />;
  }

  return (
    <DemoScenarioSelector
      onSelect={(id) => dispatch({ type: "select-scenario", scenario: id })}
    />
  );
}
