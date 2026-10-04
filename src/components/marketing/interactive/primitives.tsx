"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  DEMO_SCENARIOS,
  SUGGESTION_TIMELINE,
  type DemoScenarioId,
} from "./demo-model";

export function DemoStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <span className={cn("leh-demo-status", `leh-demo-status-${tone}`)}>
      {children}
    </span>
  );
}

export function DemoRecordHeader({
  reference,
  title,
  children,
}: {
  reference: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="leh-demo-record-header">
      <p className="leh-demo-ref">{reference}</p>
      <h3 className="leh-demo-record-title">{title}</h3>
      {children}
    </div>
  );
}

export function DemoMetaGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="leh-demo-meta">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DemoTimeline({
  currentIndex,
  steps = SUGGESTION_TIMELINE,
}: {
  currentIndex: number;
  steps?: readonly string[];
}) {
  return (
    <ol className="leh-demo-timeline" aria-label="Record timeline">
      {steps.map((step, index) => (
        <li
          key={step}
          data-state={
            index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "idle"
          }
        >
          <span className="leh-demo-timeline-node" />
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function DemoLineage({
  fromRef,
  fromLabel,
  toRef,
  toLabel,
  nextSteps,
}: {
  fromRef: string;
  fromLabel: string;
  toRef: string;
  toLabel: string;
  nextSteps?: string[];
}) {
  return (
    <div className="leh-demo-lineage" data-testid="leh-demo-lineage">
      <p className="leh-demo-kicker">Connected records</p>
      <div className="leh-demo-lineage-from">
        <p className="leh-demo-ref">{fromRef}</p>
        <p>{fromLabel}</p>
      </div>
      <p className="leh-demo-lineage-verb">converted to</p>
      <div className="leh-demo-lineage-to">
        <p className="leh-demo-ref">{toRef}</p>
        <p>{toLabel}</p>
      </div>
      {nextSteps && nextSteps.length > 0 ? (
        <p className="leh-demo-lineage-next">Next: {nextSteps.join(" · ")}</p>
      ) : null}
    </div>
  );
}

export function SuccessState({
  title,
  reference,
  body,
  children,
}: {
  title: string;
  reference?: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="leh-demo-success" data-testid="leh-demo-success">
      <span className="leh-demo-success-mark" aria-hidden="true" />
      <h3>{title}</h3>
      {reference ? <p className="leh-demo-ref">{reference}</p> : null}
      <p>{body}</p>
      {children}
    </div>
  );
}

export function DemoField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="leh-demo-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="leh-demo-hint">{hint}</p> : null}
    </div>
  );
}

export function DemoScenarioSelector({
  onSelect,
}: {
  onSelect: (id: DemoScenarioId) => void;
}) {
  return (
    <div className="leh-demo-selector" data-testid="leh-demo-scenario-selector">
      <p className="leh-demo-kicker">Choose a workflow</p>
      <h3 className="leh-demo-selector-title">Where should we start?</h3>
      <p className="leh-demo-selector-copy">
        Suggestions is the flagship path. Other workflows are shorter previews
        of the same connected system.
      </p>
      <ul className="leh-demo-scenario-grid" role="list">
        {DEMO_SCENARIOS.map((scenario) => (
          <li key={scenario.id}>
            <button
              type="button"
              className="leh-demo-scenario"
              data-featured={scenario.featured ? "true" : undefined}
              data-testid={`leh-demo-scenario-${scenario.id}`}
              onClick={() => onSelect(scenario.id)}
            >
              <span className="leh-demo-scenario-top">
                <span>{scenario.title}</span>
                <span>{scenario.duration}</span>
              </span>
              <span className="leh-demo-scenario-summary">
                {scenario.summary}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContinuationCard() {
  return (
    <aside className="leh-demo-continue" data-testid="leh-demo-lite">
      <p className="leh-demo-kicker">Like this workflow?</p>
      <h3>Start with suggestions, then expand.</h3>
      <p>
        LEH Lite will make employee suggestions available to your organisation
        as a focused starter experience. Suggestions can later connect to
        Actions, Projects, Benefits and the full LEH improvement system.
      </p>
      <a className="leh-async-action leh-demo-link-action" href="/demo">
        Request a demo
      </a>
      <p className="leh-demo-planned">
        Later: send this experience to your inbox, or continue with Microsoft.
        Not available in this public preview.
      </p>
      <div className="leh-demo-planned-actions">
        <button type="button" className="leh-demo-ghost" disabled>
          Send this experience to my inbox
        </button>
        <button type="button" className="leh-demo-ghost" disabled>
          Continue with Microsoft
        </button>
      </div>
    </aside>
  );
}
