"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Layers } from "lucide-react";

import { StatusChip } from "./primitives";

type ChipTone = "neutral" | "accent" | "warning" | "success" | "connected";

const PERSPECTIVES: ReadonlyArray<{
  value: string;
  scope: string;
  role: string;
  focus: string;
  context: ReadonlyArray<string>;
  question: string;
  records: ReadonlyArray<{
    module: string;
    title: string;
    meta: string;
    state: { label: string; tone: ChipTone };
  }>;
}> = [
  {
    value: "opex",
    scope: "Organisation",
    role: "Operational Excellence leadership",
    focus:
      "See maturity, activity and results together — the system, not a toolkit.",
    context: ["Organisation", "All sites"],
    question: "Where is the system maturing, and where is it drifting?",
    records: [
      {
        module: "Maturity",
        title: "Standard work · latest self-assessment",
        meta: "LEH Operational Excellence Standard",
        state: { label: "Assessed", tone: "accent" },
      },
      {
        module: "Projects & Benefits",
        title: "Benefit forecasts across sites",
        meta: "Forecast and realisation kept separate",
        state: { label: "Awaiting validation", tone: "neutral" },
      },
      {
        module: "Actions",
        title: "Overdue actions by site",
        meta: "Each one traceable to its source",
        state: { label: "Rolled up", tone: "connected" },
      },
    ],
  },
  {
    value: "site",
    scope: "Site",
    role: "Site leadership",
    focus:
      "Keep Gemba, 5S, actions and benefits visible at the site that owns them.",
    context: ["Organisation", "North plant"],
    question: "What needs attention at this site this week?",
    records: [
      {
        module: "Gemba",
        title: "Packing cell walk",
        meta: "Findings converted into owned actions",
        state: { label: "Linked", tone: "connected" },
      },
      {
        module: "5S",
        title: "Assembly line audit",
        meta: "Scored against the site standard",
        state: { label: "Scored", tone: "accent" },
      },
      {
        module: "Actions",
        title: "Point-of-use labels restored",
        meta: "ACT-1042 · area leader",
        state: { label: "Due Friday", tone: "warning" },
      },
    ],
  },
  {
    value: "area",
    scope: "Area",
    role: "Area leadership",
    focus:
      "Own the findings and actions in your area, with a line from observation to close-out.",
    context: ["North plant", "Packing cell"],
    question: "Which findings in my area are still open, and who owns them?",
    records: [
      {
        module: "Actions",
        title: "Label station missing at point of use",
        meta: "From a Gemba finding · owner assigned",
        state: { label: "Open", tone: "warning" },
      },
      {
        module: "Problem Solving",
        title: "Standard drift after changeover",
        meta: "Root cause analysis",
        state: { label: "In progress", tone: "accent" },
      },
      {
        module: "5S",
        title: "Shadow board replaced",
        meta: "Closed out from the last audit",
        state: { label: "Closed", tone: "success" },
      },
    ],
  },
  {
    value: "frontline",
    scope: "Team",
    role: "Frontline teams",
    focus:
      "Raise ideas, take part in Gemba and 5S, and see that improvement work does not disappear.",
    context: ["Packing cell", "My contributions"],
    question: "What happened to the idea I raised?",
    records: [
      {
        module: "Suggestions",
        title: "Label printer moved to the line",
        meta: "Reviewed by the area leader",
        state: { label: "Converted to action", tone: "connected" },
      },
      {
        module: "Gemba",
        title: "Walk I took part in",
        meta: "Findings I raised stay visible",
        state: { label: "Visible", tone: "neutral" },
      },
      {
        module: "Training & Skills",
        title: "Changeover standard",
        meta: "Recorded on the skills matrix",
        state: { label: "Trained", tone: "success" },
      },
    ],
  },
];

export function MarketingAudiencePerspectives() {
  return (
    <TabsPrimitive.Root
      className="marketing-perspectives"
      defaultValue="opex"
      orientation="vertical"
    >
      <TabsPrimitive.List
        aria-label="Perspectives"
        className="marketing-perspective-rail"
      >
        {PERSPECTIVES.map((perspective) => (
          <TabsPrimitive.Trigger
            key={perspective.value}
            className="marketing-perspective-tab"
            value={perspective.value}
          >
            <span className="marketing-perspective-scope">
              {perspective.scope}
            </span>
            <span className="marketing-perspective-role">
              {perspective.role}
            </span>
            <span className="marketing-perspective-focus">
              {perspective.focus}
            </span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {PERSPECTIVES.map((perspective) => (
        <TabsPrimitive.Content
          key={perspective.value}
          className="marketing-perspective-panel"
          forceMount
          value={perspective.value}
        >
          <div className="marketing-perspective-frame">
            <div className="marketing-perspective-chrome">
              <ol className="marketing-perspective-context" aria-label="Scope">
                {perspective.context.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <StatusChip tone="accent">{perspective.scope} scope</StatusChip>
            </div>
            <div className="marketing-perspective-body">
              <p className="marketing-perspective-question">
                {perspective.question}
              </p>
              <ul className="marketing-perspective-records" role="list">
                {perspective.records.map((record) => (
                  <li key={record.title}>
                    <span className="marketing-perspective-module">
                      {record.module}
                    </span>
                    <span className="marketing-perspective-record-title">
                      {record.title}
                    </span>
                    <span className="marketing-perspective-record-meta">
                      {record.meta}
                    </span>
                    <StatusChip tone={record.state.tone}>
                      {record.state.label}
                    </StatusChip>
                  </li>
                ))}
              </ul>
              <p className="marketing-perspective-footer">
                <Layers aria-hidden="true" className="size-3.5" />
                Illustrative records. Every perspective reads the same connected
                objects, scoped by organisation, site, area and role.
              </p>
            </div>
          </div>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
