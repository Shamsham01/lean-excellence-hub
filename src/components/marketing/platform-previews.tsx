import type { ReactNode } from "react";

import {
  MarketingContainer,
  MarketingSection,
  PreviewCaption,
  SectionIntro,
  StatusChip,
} from "./primitives";

function PreviewFrame({
  id,
  title,
  children,
  caption,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  caption: string;
  className?: string;
}) {
  return (
    <figure id={id} className={className}>
      <div className="marketing-preview">
        <div className="marketing-preview-chrome">
          <p className="marketing-preview-title">{title}</p>
        </div>
        <div className="marketing-preview-body">{children}</div>
      </div>
      <PreviewCaption>{caption}</PreviewCaption>
    </figure>
  );
}

function MetaRow({ items }: { items: string[] }) {
  return (
    <p className="marketing-preview-meta">
      {items.map((item, index) => (
        <span key={item}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {item}
        </span>
      ))}
    </p>
  );
}

function MaturityPreview() {
  const pillars = [
    "Operations",
    "Health & Safety",
    "Quality & Technical",
    "Engineering",
    "People & Leadership",
  ] as const;
  const levels = ["1", "2", "3", "4", "5"] as const;

  return (
    <PreviewFrame
      id="maturity"
      title="Maturity"
      className="marketing-platform-maturity"
      caption="Illustrative LEH Operational Excellence Standard structure. Not an assessment result and not evidence-linked scoring."
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="accent">Draft</StatusChip>
        <StatusChip>Optional starting point</StatusChip>
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        LEH Operational Excellence Standard
      </p>
      <MetaRow items={["5 pillars", "30 criteria", "60 scored questions"]} />
      <div
        className="marketing-heatmap"
        role="img"
        aria-label="Pillar and level framework grid"
      >
        <div className="marketing-heatmap-head">
          <span>Pillar</span>
          {levels.map((level, column) => (
            <span key={level} data-band={column + 1}>
              {level}
            </span>
          ))}
        </div>
        {pillars.map((pillar, row) => (
          <div key={pillar} className="marketing-heatmap-row">
            <span>{pillar}</span>
            {levels.map((level, column) => (
              <span
                key={level}
                className="marketing-heatmap-cell"
                data-active={row === 0 && column === 2 ? "true" : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Levels 1–5 are the framework scale. Highlighted cell is an example
        authoring focus, not a scored site.
      </p>
    </PreviewFrame>
  );
}

function GembaPreview() {
  return (
    <PreviewFrame
      id="gemba"
      title="Gemba"
      caption="Illustrative walk. Observations become owned follow-up in the same system."
    >
      <MetaRow items={["Packing cell", "In progress", "Today"]} />
      <div className="marketing-preview-record">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="warning">Issue</StatusChip>
          <span className="text-xs text-muted-foreground">Finding</span>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">
          Pallet labels not at point of use after changeover.
        </p>
        <MetaRow items={["Area leader", "Due Friday", "Follow-up ACT-1042"]} />
      </div>
    </PreviewFrame>
  );
}

function FiveSPreview() {
  const categories = [
    { name: "Sort", state: "Pass" },
    { name: "Set", state: "Finding" },
    { name: "Shine", state: "Pass" },
    { name: "Standardise", state: "Pass" },
    { name: "Sustain", state: "Overdue" },
  ] as const;

  return (
    <PreviewFrame
      id="five-s"
      title="5S"
      caption="Illustrative audit board. Adherence, findings and overdue sustainment — not a percentage trophy."
    >
      <MetaRow items={["Goods-in", "Scheduled audit", "Site supervisor"]} />
      <ul className="marketing-adherence" role="list">
        {categories.map((category) => (
          <li key={category.name}>
            <span>{category.name}</span>
            <StatusChip
              tone={
                category.state === "Pass"
                  ? "success"
                  : category.state === "Overdue"
                    ? "warning"
                    : "neutral"
              }
            >
              {category.state}
            </StatusChip>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-foreground">
        Finding: shadow board incomplete on bay 2. Corrective action owned.
      </p>
    </PreviewFrame>
  );
}

function SuggestionsPreview() {
  return (
    <PreviewFrame
      id="suggestions"
      title="Suggestions"
      caption="Illustrative idea progressing through review. Count is not the point — conversion and feedback are."
    >
      <p className="text-sm font-medium text-foreground">
        SUG-018 · Move changeover kit to the line-side cupboard.
      </p>
      <MetaRow items={["Frontline operator", "Workplace organisation"]} />
      <ol className="marketing-workflow" role="list">
        <li data-done="true">Submitted</li>
        <li data-done="true">In review</li>
        <li data-current="true">Accepted</li>
        <li>Action</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Decision: accept and convert. Feedback visible to the contributor.
      </p>
    </PreviewFrame>
  );
}

function ProblemSolvingPreview() {
  const stages = [
    "Define",
    "Current",
    "Cause",
    "Countermeasure",
    "Check",
    "Sustain",
  ] as const;

  return (
    <PreviewFrame
      id="problem-solving"
      title="Problem Solving"
      className="marketing-platform-wide"
      caption="Illustrative case. Methodology-neutral stages — the organisation chooses A3, 8D, DMAIC or its own method."
    >
      <p className="text-sm font-medium text-foreground">
        Why do labels leave the station after every SKU changeover?
      </p>
      <MetaRow
        items={[
          "Source: Gemba walk",
          "Owner: CI manager",
          "Containment in place",
        ]}
      />
      <ol className="marketing-stages" role="list">
        {stages.map((stage, index) => (
          <li
            key={stage}
            data-current={index === 2 ? "true" : undefined}
            data-done={index < 2 ? "true" : undefined}
          >
            {stage}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-foreground">
        Current stage: root cause analysis. Countermeasures wait until the cause
        is verified.
      </p>
    </PreviewFrame>
  );
}

function ActionsPreview() {
  const actions = [
    {
      ref: "ACT-1042",
      title: "Restore point-of-use labels",
      owner: "Area leader",
      due: "Friday",
      status: "Open",
      overdue: false,
      source: "Gemba",
    },
    {
      ref: "ACT-1038",
      title: "Complete bay 2 shadow board",
      owner: "Site supervisor",
      due: "Yesterday",
      status: "Overdue",
      overdue: true,
      source: "5S",
    },
    {
      ref: "ACT-1021",
      title: "Verify changeover standard",
      owner: "CI manager",
      due: "Next week",
      status: "In progress",
      overdue: false,
      source: "Problem solving",
    },
  ] as const;

  return (
    <PreviewFrame
      id="actions"
      title="Actions"
      caption="Illustrative action system. One accountable list across Gemba, 5S, suggestions and problem solving."
    >
      <ul className="marketing-action-list" role="list">
        {actions.map((action) => (
          <li
            key={action.ref}
            data-overdue={action.overdue ? "true" : undefined}
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {action.ref} · {action.title}
              </p>
              <MetaRow
                items={[action.owner, `Due ${action.due}`, action.source]}
              />
            </div>
            <StatusChip tone={action.overdue ? "warning" : "neutral"}>
              {action.status}
            </StatusChip>
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

function ProjectsBenefitsPreview() {
  return (
    <PreviewFrame
      id="projects-benefits"
      title="Projects & Benefits"
      caption="Illustrative project. Forecast and realisation stay separate. No invented financial result."
    >
      <p className="text-sm font-medium text-foreground">
        PRJ-07 · Restore changeover standard on packing.
      </p>
      <MetaRow
        items={["CI manager", "Implementation", "Source: problem-solving case"]}
      />
      <dl className="marketing-benefit-pair">
        <div>
          <dt>Forecast benefit</dt>
          <dd>Shorter changeover recovery · qualitative</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>
            <StatusChip tone="accent">Awaiting validation</StatusChip>
          </dd>
        </div>
      </dl>
    </PreviewFrame>
  );
}

function TrainingSkillsPreview() {
  const skills = ["5S audit", "Gemba", "Problem solving"] as const;
  const rows = [
    ["Area leader", "Meets", "Meets", "Gap"],
    ["Site supervisor", "Meets", "Gap", "Not assessed"],
    ["Frontline team", "Gap", "Meets", "Not required"],
  ] as const;

  return (
    <PreviewFrame
      id="training-skills"
      title="Training & Skills"
      className="marketing-platform-wide"
      caption="Illustrative capability matrix. Gaps and requirements, not a course catalogue."
    >
      <div className="marketing-matrix-scroll">
        <table className="marketing-matrix">
          <caption className="sr-only">
            Example skills matrix for three roles
          </caption>
          <thead>
            <tr>
              <th scope="col">Role</th>
              {skills.map((skill) => (
                <th key={skill} scope="col">
                  {skill}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                <th scope="row">{row[0]}</th>
                {row.slice(1).map((cell, cellIndex) => (
                  <td
                    key={`${row[0]}-${skills[cellIndex]}`}
                    data-state={cell.toLowerCase()}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Planned training can close a gap. Competence stays visible against the
        role requirement.
      </p>
    </PreviewFrame>
  );
}

export function MarketingPlatform() {
  return (
    <MarketingSection
      id="platform"
      className="marketing-defer border-y border-border bg-surface"
    >
      <MarketingContainer wide>
        <SectionIntro
          kicker="The platform"
          title="One connected improvement system."
        >
          <p>
            Each area is useful on its own. Together they are how Operational
            Excellence actually runs: evidence in, actions owned, problems
            solved, benefits validated, capability built.
          </p>
        </SectionIntro>
        <div className="marketing-platform-grid mt-10">
          <MaturityPreview />
          <GembaPreview />
          <FiveSPreview />
          <SuggestionsPreview />
          <ProblemSolvingPreview />
          <ActionsPreview />
          <ProjectsBenefitsPreview />
          <TrainingSkillsPreview />
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
