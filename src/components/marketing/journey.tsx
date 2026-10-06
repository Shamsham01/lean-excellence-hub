import { RotateCcw } from "lucide-react";

import {
  MarketingContainer,
  MarketingSection,
  SectionIntro,
  StatusChip,
} from "./primitives";

const STEPS: ReadonlyArray<{
  title: string;
  module: string;
  record: string;
  body: string;
  meta: string;
  state: {
    label: string;
    tone: "neutral" | "accent" | "warning" | "connected";
  };
}> = [
  {
    title: "Observe",
    module: "Gemba",
    record: "Finding · Packing cell",
    body: "Label station missing at point of use.",
    meta: "Captured on the walk · today",
    state: { label: "Captured", tone: "neutral" },
  },
  {
    title: "Act",
    module: "Actions",
    record: "ACT-1042",
    body: "Restore point-of-use labels before Friday.",
    meta: "Owner: area leader · from the finding",
    state: { label: "Due Friday", tone: "warning" },
  },
  {
    title: "Solve",
    module: "Problem Solving",
    record: "Case · standard drift",
    body: "Why did the standard drift after the last changeover?",
    meta: "Root cause analysis",
    state: { label: "In progress", tone: "accent" },
  },
  {
    title: "Improve",
    module: "Projects & Benefits",
    record: "Project · standard update",
    body: "Countermeasure implemented on the line.",
    meta: "Benefit forecast captured",
    state: { label: "Awaiting validation", tone: "neutral" },
  },
  {
    title: "Learn",
    module: "Training & Maturity",
    record: "Capability + maturity",
    body: "The organisation keeps the evidence, the method and the skill.",
    meta: "Skills + maturity updated",
    state: { label: "Connected", tone: "connected" },
  },
];

export function MarketingJourney() {
  return (
    <MarketingSection id="impact" className="marketing-process-section">
      <MarketingContainer wide>
        <SectionIntro
          kicker="From evidence to impact"
          title="A connected loop, not a pile of modules."
        >
          <p>
            Frontline evidence becomes owned work, structured solving, delivered
            improvement and organisational learning — with maturity as the
            connecting layer.
          </p>
        </SectionIntro>

        <div className="marketing-process">
          <figure className="marketing-process-surface">
            <div className="marketing-process-rail" aria-hidden="true">
              <span className="marketing-process-progress" />
            </div>
            <ol className="marketing-process-track" role="list">
              {STEPS.map((step, index) => (
                <li key={step.title} className="marketing-process-step">
                  <span className="marketing-process-node" aria-hidden="true" />
                  <span className="marketing-process-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="marketing-process-title-block">
                    <h3 className="marketing-process-title">{step.title}</h3>
                    <span className="marketing-process-module">
                      {step.module}
                    </span>
                  </div>
                  <div className="marketing-process-record">
                    <span className="marketing-process-ref">{step.record}</span>
                    <p className="marketing-process-body">{step.body}</p>
                    <p className="marketing-process-meta">{step.meta}</p>
                  </div>
                  <div className="marketing-process-state">
                    <StatusChip tone={step.state.tone}>
                      {step.state.label}
                    </StatusChip>
                  </div>
                </li>
              ))}
            </ol>
            <figcaption className="marketing-process-loop">
              <span
                className="marketing-process-loop-bracket"
                aria-hidden="true"
              />
              <span className="marketing-process-loop-content">
                <span className="marketing-process-loop-text">
                  <RotateCcw aria-hidden="true" className="size-4" />
                  <span>
                    <strong>Learning feeds the next walk.</strong>{" "}
                    <span className="marketing-process-loop-note">
                      The same objects stay connected in Lean Excellence Hub.
                    </span>
                  </span>
                </span>
              </span>
            </figcaption>
          </figure>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
