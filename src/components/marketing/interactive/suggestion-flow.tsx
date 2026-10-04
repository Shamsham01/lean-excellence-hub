"use client";

import { type FormEvent, useId, useState } from "react";

import {
  AsyncActionButton,
  type AsyncActionPhase,
} from "@/components/ui/async-action-button";

import { runDemoWorkflow } from "./demo-progress";
import {
  ACTION_CREATE_STEPS,
  ACTION_FROM_SUGGESTION,
  ACTION_REF,
  REVIEW_STEPS,
  SUGGESTION_AREAS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_EXAMPLE,
  SUGGESTION_REF,
  SUGGESTION_SUBMIT_STEPS,
  type SuggestionDecision,
  type SuggestionDraft,
} from "./demo-model";
import { useDemoDispatch, useDemoState } from "./demo-store";
import {
  ContinuationCard,
  DemoField,
  DemoLineage,
  DemoMetaGrid,
  DemoRecordHeader,
  DemoStatus,
  DemoTimeline,
  SuccessState,
} from "./primitives";

function statusTone(status: string) {
  if (status === "Accepted" || status === "Submitted") {
    return "success" as const;
  }
  if (status === "Parked" || status === "More information") {
    return "warning" as const;
  }
  if (status === "Declined") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function timelineIndex(status: string, hasAction: boolean) {
  if (hasAction) {
    return 3;
  }
  if (status === "Accepted") {
    return 2;
  }
  if (status === "Submitted" || status === "More information") {
    return 1;
  }
  return 0;
}

export function SuggestionFlow() {
  const state = useDemoState();

  if (state.view === "suggestion-form") {
    return <SuggestionForm />;
  }
  if (state.view === "suggestion-success") {
    return <SuggestionSuccess />;
  }
  if (state.view === "suggestion-review") {
    return <SuggestionReview />;
  }
  if (state.view === "suggestion-record") {
    return <SuggestionRecord />;
  }
  if (state.view === "lineage") {
    return <SuggestionLineage />;
  }
  return null;
}

function SuggestionForm() {
  const dispatch = useDemoDispatch();
  const titleId = useId();
  const areaId = useId();
  const categoryId = useId();
  const opportunityId = useId();
  const benefitId = useId();
  const [draft, setDraft] = useState<SuggestionDraft>(SUGGESTION_EXAMPLE);
  const [phase, setPhase] = useState<AsyncActionPhase>("idle");
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.opportunity.trim()) {
      setError("Add a title and the problem or opportunity before submitting.");
      return;
    }

    setError(null);
    setPhase("loading");
    const done = await runDemoWorkflow(
      SUGGESTION_SUBMIT_STEPS,
      (_label, index) => {
        setProgressIndex(index);
        dispatch({
          type: "set-progress",
          progress: {
            label: SUGGESTION_SUBMIT_STEPS[index] ?? "Working",
            stepIndex: index,
            stepCount: SUGGESTION_SUBMIT_STEPS.length,
          },
        });
      },
    );
    if (!done) {
      setPhase("idle");
      return;
    }
    setPhase("success");
    dispatch({
      type: "submit-suggestion",
      record: {
        ...draft,
        id: SUGGESTION_REF,
        status: "Submitted",
        submittedBy: "Visitor",
        createdLabel: "Just now",
        decision: null,
      },
    });
  }

  return (
    <form
      className="leh-demo-form"
      data-testid="leh-demo-suggestion-form"
      onSubmit={onSubmit}
      noValidate
    >
      <p className="leh-demo-kicker">Submit an improvement idea</p>
      <h3>Capture what you saw on the line.</h3>
      <p className="leh-demo-lede">
        Pre-filled with a packing example. Edit anything, then submit.
      </p>

      <DemoField id={titleId} label="Idea">
        <input
          id={titleId}
          className="leh-demo-input"
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          required
        />
      </DemoField>

      <div className="leh-demo-form-row">
        <DemoField id={areaId} label="Area">
          <select
            id={areaId}
            className="leh-demo-input"
            value={draft.area}
            onChange={(event) =>
              setDraft((current) => ({ ...current, area: event.target.value }))
            }
          >
            {SUGGESTION_AREAS.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
        </DemoField>
        <DemoField id={categoryId} label="Category">
          <select
            id={categoryId}
            className="leh-demo-input"
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          >
            {SUGGESTION_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </DemoField>
      </div>

      <DemoField
        id={opportunityId}
        label="Problem / opportunity"
        hint="What is happening today?"
      >
        <textarea
          id={opportunityId}
          className="leh-demo-input leh-demo-textarea"
          value={draft.opportunity}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              opportunity: event.target.value,
            }))
          }
          required
        />
      </DemoField>

      <DemoField id={benefitId} label="Expected benefit">
        <textarea
          id={benefitId}
          className="leh-demo-input leh-demo-textarea"
          value={draft.benefit}
          onChange={(event) =>
            setDraft((current) => ({ ...current, benefit: event.target.value }))
          }
        />
      </DemoField>

      <div className="leh-demo-evidence">
        <p>Evidence</p>
        {draft.evidenceName ? (
          <div className="leh-demo-file">
            <span>{draft.evidenceName}</span>
            <button
              type="button"
              className="leh-demo-text-button"
              onClick={() =>
                setDraft((current) => ({ ...current, evidenceName: null }))
              }
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                evidenceName: "changeover-station.jpg",
              }))
            }
          >
            Add example photo
          </button>
        )}
        <p className="leh-demo-hint">
          Simulated selection only. Nothing is uploaded.
        </p>
      </div>

      {error ? (
        <p className="leh-demo-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="leh-demo-actions">
        <button
          type="button"
          className="leh-demo-ghost"
          onClick={() => {
            setDraft(SUGGESTION_EXAMPLE);
            setError(null);
          }}
        >
          Use example
        </button>
        <AsyncActionButton
          type="submit"
          phase={phase}
          progressIndex={progressIndex}
          idleLabel="Submit idea"
          loadingLabel="Submitting idea"
          successLabel="Submitted"
          data-testid="leh-demo-submit-idea"
        />
      </div>
    </form>
  );
}

function SuggestionSuccess() {
  const dispatch = useDemoDispatch();

  return (
    <SuccessState
      title="Idea submitted"
      reference={SUGGESTION_REF}
      body="Your idea is now visible and ready for review."
    >
      <div className="leh-demo-actions">
        <button
          type="button"
          className="leh-demo-ghost"
          onClick={() =>
            dispatch({ type: "set-view", view: "suggestion-record" })
          }
        >
          View record
        </button>
        <button
          type="button"
          className="leh-async-action"
          data-testid="leh-demo-see-review"
          onClick={() => {
            dispatch({ type: "set-perspective", perspective: "manager" });
            dispatch({ type: "set-view", view: "suggestion-review" });
          }}
        >
          See manager review
        </button>
      </div>
    </SuccessState>
  );
}

function SuggestionRecord() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const record = state.suggestion;
  if (!record) {
    return null;
  }

  const action = state.actions.find((item) => item.source === SUGGESTION_REF);

  return (
    <article
      className="leh-demo-record"
      data-testid="leh-demo-suggestion-record"
    >
      <DemoRecordHeader reference={record.id} title={record.title}>
        <DemoStatus tone={statusTone(record.status)}>
          {record.status}
        </DemoStatus>
      </DemoRecordHeader>
      <DemoMetaGrid
        items={[
          { label: "Submitted by", value: record.submittedBy },
          { label: "Area", value: record.area },
          { label: "Category", value: record.category },
          { label: "Created", value: record.createdLabel },
          {
            label: "Evidence",
            value: record.evidenceName ? "1 item" : "No evidence",
          },
        ]}
      />
      <p className="leh-demo-prose">{record.opportunity}</p>
      <div className="leh-demo-actions">
        {record.status === "Submitted" ? (
          <button
            type="button"
            className="leh-async-action"
            onClick={() => {
              dispatch({ type: "set-perspective", perspective: "manager" });
              dispatch({ type: "set-view", view: "suggestion-review" });
            }}
            data-testid="leh-demo-see-review"
          >
            See manager review
          </button>
        ) : null}
        {record.status === "Accepted" && !action ? (
          <button
            type="button"
            className="leh-async-action"
            onClick={() =>
              dispatch({ type: "start-action-compose", source: "suggestion" })
            }
          >
            Create action
          </button>
        ) : null}
        {action ? (
          <button
            type="button"
            className="leh-async-action"
            onClick={() => dispatch({ type: "set-view", view: "lineage" })}
          >
            View connected records
          </button>
        ) : null}
      </div>
      <DemoTimeline
        currentIndex={timelineIndex(record.status, Boolean(action))}
      />
    </article>
  );
}

function SuggestionReview() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const record = state.suggestion;
  const [phase, setPhase] = useState<AsyncActionPhase>("idle");
  const [progressIndex, setProgressIndex] = useState(0);

  if (!record) {
    return null;
  }

  async function decide(decision: SuggestionDecision) {
    setPhase("loading");
    const done = await runDemoWorkflow(REVIEW_STEPS, (_label, index) => {
      setProgressIndex(index);
      dispatch({
        type: "set-progress",
        progress: {
          label: REVIEW_STEPS[index] ?? "Working",
          stepIndex: index,
          stepCount: REVIEW_STEPS.length,
        },
      });
    });
    if (!done) {
      setPhase("idle");
      return;
    }
    setPhase("success");
    dispatch({ type: "decide-suggestion", decision });
  }

  return (
    <article
      className="leh-demo-record leh-demo-review"
      data-testid="leh-demo-suggestion-review"
    >
      <p className="leh-demo-kicker">Suggestion review</p>
      <DemoRecordHeader reference={record.id} title={record.title} />
      <DemoMetaGrid
        items={[
          { label: "Submitted by", value: record.submittedBy },
          { label: "Area", value: record.area },
          { label: "Idea", value: record.title },
        ]}
      />
      <p className="leh-demo-prose">{record.opportunity}</p>
      <fieldset className="leh-demo-decision">
        <legend>Decision</legend>
        <div className="leh-demo-decision-row">
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() => void decide("request-info")}
            disabled={phase !== "idle"}
          >
            Request more information
          </button>
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() => void decide("park")}
            disabled={phase !== "idle"}
          >
            Park
          </button>
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() => void decide("decline")}
            disabled={phase !== "idle"}
          >
            Decline
          </button>
        </div>
        <AsyncActionButton
          phase={phase}
          progressIndex={progressIndex}
          idleLabel="Accept"
          loadingLabel="Recording decision"
          successLabel="Accepted"
          data-testid="leh-demo-accept-suggestion"
          onClick={() => void decide("accept")}
        />
      </fieldset>
    </article>
  );
}

export function SuggestionActionCompose() {
  const dispatch = useDemoDispatch();
  const [title, setTitle] = useState(ACTION_FROM_SUGGESTION.title);
  const [owner, setOwner] = useState(ACTION_FROM_SUGGESTION.owner);
  const [due, setDue] = useState(ACTION_FROM_SUGGESTION.due);
  const [phase, setPhase] = useState<AsyncActionPhase>("idle");
  const [progressIndex, setProgressIndex] = useState(0);
  const titleId = useId();
  const ownerId = useId();
  const dueId = useId();

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
        id: ACTION_REF,
        title,
        owner,
        due,
        priority: "Medium",
        source: SUGGESTION_REF,
        status: "Open",
        sourceKind: "suggestion",
      },
    });
  }

  return (
    <form
      className="leh-demo-form"
      data-testid="leh-demo-action-compose"
      onSubmit={onSubmit}
    >
      <p className="leh-demo-kicker">Create action</p>
      <h3>Turn the accepted idea into owned work.</h3>
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
      <p className="leh-demo-hint">Source: {SUGGESTION_REF}</p>
      <AsyncActionButton
        type="submit"
        phase={phase}
        progressIndex={progressIndex}
        idleLabel="Create action"
        loadingLabel="Creating action"
        successLabel="Created"
        data-testid="leh-demo-create-action"
      />
    </form>
  );
}

function SuggestionLineage() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const action = state.actions.find((item) => item.source === SUGGESTION_REF);
  const suggestion = state.suggestion;
  if (!suggestion || !action) {
    return null;
  }

  return (
    <div className="leh-demo-stack">
      <SuccessState
        title={`${ACTION_REF} created`}
        reference={ACTION_REF}
        body="The suggestion now has an owned follow-up. This is the connected LEH loop."
      />
      <DemoLineage
        fromRef={suggestion.id}
        fromLabel="Suggestion"
        toRef={action.id}
        toLabel="Action"
        nextSteps={["Escalate to Problem Solving", "Create Project"]}
      />
      <ContinuationCard />
      <div className="leh-demo-actions">
        <button
          type="button"
          className="leh-demo-ghost"
          onClick={() => dispatch({ type: "try-another" })}
        >
          Try another workflow
        </button>
      </div>
    </div>
  );
}

export function SuggestionActionSuccess() {
  const dispatch = useDemoDispatch();

  return (
    <div className="leh-demo-stack">
      <SuccessState
        title={`${ACTION_REF} created`}
        reference={ACTION_REF}
        body="Assigned to Area Leader and visible in the action system."
      >
        <div className="leh-demo-actions">
          <button
            type="button"
            className="leh-async-action"
            onClick={() => dispatch({ type: "set-view", view: "lineage" })}
          >
            View connected records
          </button>
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() =>
              dispatch({ type: "set-view", view: "action-record" })
            }
          >
            Open action
          </button>
        </div>
      </SuccessState>
    </div>
  );
}
