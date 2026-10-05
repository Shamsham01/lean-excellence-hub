"use client";

import { type FormEvent, useId, useState } from "react";

import {
  AsyncActionButton,
  type AsyncActionPhase,
} from "@/components/ui/async-action-button";

import { runDemoWorkflow } from "./demo-progress";
import {
  ACTION_CREATE_STEPS,
  ACTION_DUES,
  ACTION_OWNERS,
  ACTION_REF,
  STANDALONE_ACTION,
  STANDALONE_ACTION_REF,
  type ActionStatus,
} from "./demo-model";
import { useDemoDispatch, useDemoState } from "./demo-store";
import {
  DemoField,
  DemoMetaGrid,
  DemoRecordHeader,
  DemoStatus,
  SuccessState,
} from "./primitives";

function statusTone(status: ActionStatus) {
  if (status === "Complete") {
    return "success" as const;
  }
  if (status === "In progress") {
    return "accent" as const;
  }
  return "neutral" as const;
}

export function ActionFlow() {
  const state = useDemoState();

  if (state.view === "action-compose" && state.actionSource === "standalone") {
    return <StandaloneActionCompose />;
  }
  if (state.view === "action-list") {
    return <ActionList />;
  }
  if (state.view === "action-record" || state.view === "action-success") {
    return <ActionDetail />;
  }
  return null;
}

function StandaloneActionCompose() {
  const dispatch = useDemoDispatch();
  const [title, setTitle] = useState(STANDALONE_ACTION.title);
  const [owner, setOwner] = useState(STANDALONE_ACTION.owner);
  const [due, setDue] = useState(STANDALONE_ACTION.due);
  const [priority, setPriority] = useState(STANDALONE_ACTION.priority);
  const [status, setStatus] = useState(STANDALONE_ACTION.status);
  const [phase, setPhase] = useState<AsyncActionPhase>("idle");
  const [progressIndex, setProgressIndex] = useState(0);
  const titleId = useId();
  const ownerId = useId();
  const dueId = useId();
  const priorityId = useId();
  const statusId = useId();
  const sourceId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhase("loading");
    const done = await runDemoWorkflow(ACTION_CREATE_STEPS, (_label, index) => {
      setProgressIndex(index);
      dispatch({
        type: "set-progress",
        progress: {
          label: ACTION_CREATE_STEPS[index] ?? "Working",
          stepIndex: index,
          stepCount: ACTION_CREATE_STEPS.length,
        },
      });
    });
    if (!done) {
      setPhase("idle");
      return;
    }
    setPhase("success");
    dispatch({
      type: "create-action",
      record: {
        id: STANDALONE_ACTION_REF,
        title,
        owner,
        due,
        priority,
        source: "Standalone",
        status,
        sourceKind: "standalone",
      },
    });
  }

  return (
    <form
      className="leh-demo-form"
      data-testid="leh-demo-standalone-action"
      onSubmit={onSubmit}
    >
      <p className="leh-demo-kicker">Actions</p>
      <h3>Create an owned action.</h3>
      <DemoField id={titleId} label="Action">
        <input
          id={titleId}
          className="leh-demo-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
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
            {ACTION_OWNERS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </DemoField>
        <DemoField id={dueId} label="Due date">
          <select
            id={dueId}
            className="leh-demo-input"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          >
            {ACTION_DUES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </DemoField>
      </div>
      <div className="leh-demo-form-row">
        <DemoField id={priorityId} label="Priority">
          <select
            id={priorityId}
            className="leh-demo-input"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as typeof priority)
            }
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </DemoField>
        <DemoField id={statusId} label="Status">
          <select
            id={statusId}
            className="leh-demo-input"
            value={status}
            onChange={(event) => setStatus(event.target.value as ActionStatus)}
          >
            <option>Open</option>
            <option>In progress</option>
            <option>Complete</option>
          </select>
        </DemoField>
      </div>
      <DemoField id={sourceId} label="Source">
        <input
          id={sourceId}
          className="leh-demo-input"
          value="Standalone"
          readOnly
        />
      </DemoField>
      <AsyncActionButton
        type="submit"
        phase={phase}
        progressIndex={progressIndex}
        idleLabel="Create action"
        loadingLabel="Creating action"
        successLabel="Created"
        data-testid="leh-demo-standalone-create"
      />
    </form>
  );
}

function ActionList() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();

  return (
    <div className="leh-demo-stack" data-testid="leh-demo-action-list">
      <p className="leh-demo-kicker">Action register</p>
      <h3>Accountability stays visible.</h3>
      <ul className="leh-demo-action-list" role="list">
        {state.actions.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="leh-demo-action-row"
              onClick={() =>
                dispatch({ type: "select-action", id: item.id })
              }
            >
              <span>
                <span className="leh-demo-ref">{item.id}</span>
                <span>{item.title}</span>
                <span className="leh-demo-hint">
                  {item.owner} · Due {item.due} · {item.source}
                </span>
              </span>
              <DemoStatus tone={statusTone(item.status)}>
                {item.status}
              </DemoStatus>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionDetail() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const record =
    state.actions.find((item) => item.id === state.selectedActionId) ??
    state.actions[0];
  if (!record) {
    return null;
  }

  const statuses: ActionStatus[] = ["Open", "In progress", "Complete"];

  return (
    <article className="leh-demo-record" data-testid="leh-demo-action-record">
      {state.view === "action-success" ? (
        <SuccessState
          title={`${record.id} created`}
          reference={record.id}
          body="The owner, due date and source are now visible in the register."
        />
      ) : null}
      <DemoRecordHeader reference={record.id} title={record.title}>
        <DemoStatus tone={statusTone(record.status)}>
          {record.status}
        </DemoStatus>
      </DemoRecordHeader>
      <DemoMetaGrid
        items={[
          { label: "Owner", value: record.owner },
          { label: "Due", value: record.due },
          { label: "Priority", value: record.priority },
          { label: "Source", value: record.source },
        ]}
      />
      <fieldset className="leh-demo-choice">
        <legend>Status</legend>
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            className="leh-demo-choice-button"
            aria-pressed={record.status === status}
            data-testid={`leh-demo-action-status-${status.toLowerCase().replace(" ", "-")}`}
            onClick={() =>
              dispatch({
                type: "update-action-status",
                id: record.id,
                status,
              })
            }
          >
            {status}
          </button>
        ))}
      </fieldset>
      <div className="leh-demo-actions">
        {state.actions.length > 1 || record.sourceKind === "standalone" ? (
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() => dispatch({ type: "set-view", view: "action-list" })}
          >
            View list
          </button>
        ) : null}
        <button
          type="button"
          className="leh-demo-ghost"
          onClick={() => dispatch({ type: "try-another" })}
        >
          Try another workflow
        </button>
      </div>
    </article>
  );
}
