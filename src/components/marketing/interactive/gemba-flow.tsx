"use client";

import { type FormEvent, useId, useState } from "react";

import {
  AsyncActionButton,
  type AsyncActionPhase,
} from "@/components/ui/async-action-button";

import { runDemoWorkflow, useDemoWorkflowSignal } from "./demo-progress";
import {
  ACTION_CREATE_STEPS,
  ACTION_FROM_GEMBA,
  GEMBA_ACTION_REF,
  GEMBA_FINDING_EXAMPLE,
  GEMBA_PROMPTS,
  GEMBA_REF,
} from "./demo-model";
import { useDemoDispatch, useDemoState } from "./demo-store";
import {
  DemoField,
  DemoLineage,
  DemoMetaGrid,
  DemoRecordHeader,
  DemoStatus,
  SuccessState,
} from "./primitives";

export function GembaFlow() {
  const state = useDemoState();

  if (state.view === "gemba-walk") {
    return <GembaWalk />;
  }
  if (state.view === "gemba-finding") {
    return <GembaFinding />;
  }
  if (state.view === "lineage" && state.gemba) {
    return <GembaLineage />;
  }
  return null;
}

function GembaWalk() {
  const dispatch = useDemoDispatch();
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<[string, string]>(["", ""]);

  const ready = started && answers[0] !== "" && answers[1] !== "";

  return (
    <div className="leh-demo-stack" data-testid="leh-demo-gemba">
      <p className="leh-demo-kicker">Gemba</p>
      <h3>Walk the packing cell.</h3>
      <p className="leh-demo-lede">
        Observe the workplace, answer two prompts, then record the finding.
      </p>
      {!started ? (
        <button
          type="button"
          className="leh-async-action"
          data-testid="leh-demo-start-gemba"
          onClick={() => setStarted(true)}
        >
          Start Gemba walk
        </button>
      ) : (
        <>
          <p className="leh-demo-chip-row">
            <DemoStatus tone="accent">Packing</DemoStatus>
            <span>In progress</span>
          </p>
          <ol className="leh-demo-prompts">
            {GEMBA_PROMPTS.map((prompt, index) => (
              <li key={prompt.question}>
                <p>{prompt.question}</p>
                <p className="leh-demo-hint">{prompt.hint}</p>
                <div className="leh-demo-choice">
                  {["Yes", "No"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="leh-demo-choice-button"
                      aria-pressed={answers[index] === option}
                      onClick={() =>
                        setAnswers((current) => {
                          const next: [string, string] = [
                            current[0],
                            current[1],
                          ];
                          if (index === 0 || index === 1) {
                            next[index] = option;
                          }
                          return next;
                        })
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="leh-async-action"
            disabled={!ready}
            onClick={() =>
              dispatch({
                type: "save-gemba",
                record: {
                  id: GEMBA_REF,
                  area: GEMBA_FINDING_EXAMPLE.area,
                  finding: GEMBA_FINDING_EXAMPLE.finding,
                  severity: GEMBA_FINDING_EXAMPLE.severity,
                  promptAnswers: answers,
                },
              })
            }
          >
            Record finding
          </button>
        </>
      )}
    </div>
  );
}

function GembaFinding() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const record = state.gemba;
  const [severity, setSeverity] = useState(record?.severity ?? "Issue");
  const action = state.actions.find((item) => item.source === GEMBA_REF);

  if (!record) {
    return null;
  }

  return (
    <article className="leh-demo-record" data-testid="leh-demo-gemba-finding">
      <DemoRecordHeader reference={record.id} title={record.finding}>
        <DemoStatus tone="warning">{severity}</DemoStatus>
      </DemoRecordHeader>
      <DemoMetaGrid
        items={[
          { label: "Area", value: record.area },
          { label: "Walk", value: "Packing · today" },
        ]}
      />
      <fieldset className="leh-demo-choice">
        <legend>Severity</legend>
        {(["Observation", "Issue", "Escalate"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="leh-demo-choice-button"
            aria-pressed={severity === option}
            onClick={() => setSeverity(option)}
          >
            {option}
          </button>
        ))}
      </fieldset>
      {action ? (
        <button
          type="button"
          className="leh-async-action"
          onClick={() => dispatch({ type: "set-view", view: "lineage" })}
        >
          View connected records
        </button>
      ) : (
        <button
          type="button"
          className="leh-async-action"
          onClick={() =>
            dispatch({ type: "start-action-compose", source: "gemba" })
          }
        >
          Create action
        </button>
      )}
    </article>
  );
}

export function GembaActionCompose() {
  const dispatch = useDemoDispatch();
  const workflowSignal = useDemoWorkflowSignal();
  const [title, setTitle] = useState(ACTION_FROM_GEMBA.title);
  const [owner, setOwner] = useState(ACTION_FROM_GEMBA.owner);
  const [due, setDue] = useState(ACTION_FROM_GEMBA.due);
  const [phase, setPhase] = useState<AsyncActionPhase>("idle");
  const [progressIndex, setProgressIndex] = useState(0);
  const titleId = useId();
  const ownerId = useId();
  const dueId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhase("loading");
    const done = await runDemoWorkflow(
      ACTION_CREATE_STEPS,
      (_label, index) => {
        setProgressIndex(index);
        dispatch({
          type: "set-progress",
          progress: {
            label: ACTION_CREATE_STEPS[index] ?? "Working",
            stepIndex: index,
            stepCount: ACTION_CREATE_STEPS.length,
          },
        });
      },
      workflowSignal,
    );
    if (!done) {
      setPhase("idle");
      return;
    }
    setPhase("success");
    dispatch({
      type: "create-action",
      record: {
        id: GEMBA_ACTION_REF,
        title,
        owner,
        due,
        priority: "High",
        source: GEMBA_REF,
        status: "Open",
        sourceKind: "gemba",
      },
    });
  }

  return (
    <form className="leh-demo-form" onSubmit={onSubmit}>
      <p className="leh-demo-kicker">Follow-up action</p>
      <h3>Own the finding.</h3>
      <DemoField id={titleId} label="Action">
        <input
          id={titleId}
          className="leh-demo-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </DemoField>
      <div className="leh-demo-form-row">
        <DemoField id={ownerId} label="Owner">
          <select
            id={ownerId}
            className="leh-demo-input"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            <option>Area Leader</option>
            <option>Site Supervisor</option>
            <option>CI Manager</option>
          </select>
        </DemoField>
        <DemoField id={dueId} label="Due">
          <select
            id={dueId}
            className="leh-demo-input"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          >
            <option>Friday</option>
            <option>Tomorrow</option>
            <option>Next week</option>
          </select>
        </DemoField>
      </div>
      <p className="leh-demo-hint">Source: {GEMBA_REF}</p>
      <AsyncActionButton
        type="submit"
        phase={phase}
        progressIndex={progressIndex}
        idleLabel="Create action"
        loadingLabel="Creating action"
        successLabel="Created"
        data-testid="leh-demo-gemba-create-action"
      />
    </form>
  );
}

function GembaLineage() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const action = state.actions.find((item) => item.source === GEMBA_REF);
  if (!state.gemba || !action) {
    return null;
  }

  return (
    <div className="leh-demo-stack">
      <SuccessState
        title="Finding converted"
        body="The Gemba observation now has an owned follow-up."
      />
      <DemoLineage
        fromRef={state.gemba.id}
        fromLabel="Gemba finding"
        toRef={action.id}
        toLabel="Action"
      />
      <button
        type="button"
        className="leh-demo-ghost"
        onClick={() => dispatch({ type: "try-another" })}
      >
        Try another workflow
      </button>
    </div>
  );
}
