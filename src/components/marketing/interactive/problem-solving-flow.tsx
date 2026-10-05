"use client";

import { useId } from "react";

import { PROBLEM_EXAMPLE, PROBLEM_STAGES } from "./demo-model";
import { useDemoDispatch, useDemoState } from "./demo-store";
import { DemoField } from "./primitives";

export function ProblemSolvingFlow() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const defineId = useId();
  const currentId = useId();
  const causeId = useId();
  const problem = state.problem;
  const interactiveUntil = 2;
  const canAdvance = problem.stage < interactiveUntil;

  return (
    <div className="leh-demo-stack" data-testid="leh-demo-problem-solving">
      <p className="leh-demo-kicker">Problem solving</p>
      <h3>Stay with the problem until the cause is clear.</h3>
      <p className="leh-demo-lede">
        Methodology-neutral stages. This preview lets you work the first three.
      </p>
      <ol className="leh-demo-stages" aria-label="Problem-solving stages">
        {PROBLEM_STAGES.map((stage, index) => (
          <li
            key={stage}
            data-state={
              index < problem.stage
                ? "done"
                : index === problem.stage
                  ? "current"
                  : "idle"
            }
          >
            {stage}
          </li>
        ))}
      </ol>

      {problem.stage === 0 ? (
        <DemoField id={defineId} label="Define">
          <textarea
            id={defineId}
            className="leh-demo-input leh-demo-textarea"
            value={problem.define}
            onChange={(event) =>
              dispatch({
                type: "update-problem",
                patch: { define: event.target.value },
              })
            }
          />
        </DemoField>
      ) : null}

      {problem.stage === 1 ? (
        <DemoField id={currentId} label="Current condition">
          <textarea
            id={currentId}
            className="leh-demo-input leh-demo-textarea"
            value={problem.currentCondition}
            onChange={(event) =>
              dispatch({
                type: "update-problem",
                patch: { currentCondition: event.target.value },
              })
            }
          />
        </DemoField>
      ) : null}

      {problem.stage === 1 && !problem.assistantDismissed ? (
        <aside
          className="leh-demo-assistant"
          data-testid="leh-demo-leanai-prompt"
        >
          <p className="leh-demo-kicker">LeanAI</p>
          <p>Would you like help structuring the current condition?</p>
          <p className="leh-demo-hint">
            Assistance stays a prompt in this preview. It does not generate an
            answer or make a decision.
          </p>
          <div className="leh-demo-actions">
            <button
              type="button"
              className="leh-demo-ghost"
              onClick={() =>
                dispatch({
                  type: "update-problem",
                  patch: { assistantDismissed: true },
                })
              }
            >
              Continue without assistance
            </button>
          </div>
        </aside>
      ) : null}

      {problem.stage === 2 ? (
        <>
          <DemoField id={causeId} label="Cause">
            <textarea
              id={causeId}
              className="leh-demo-input leh-demo-textarea"
              value={problem.cause}
              onChange={(event) =>
                dispatch({
                  type: "update-problem",
                  patch: { cause: event.target.value },
                })
              }
            />
          </DemoField>
          <aside className="leh-demo-next">
            <p className="leh-demo-kicker">Suggested next step</p>
            <p>Verify root cause before assigning countermeasure.</p>
          </aside>
        </>
      ) : null}

      <div className="leh-demo-actions">
        {canAdvance ? (
          <button
            type="button"
            className="leh-async-action"
            data-testid="leh-demo-problem-next"
            onClick={() =>
              dispatch({
                type: "update-problem",
                patch: {
                  stage: (problem.stage + 1) as 1 | 2,
                  assistantDismissed:
                    problem.stage === 0 ? false : problem.assistantDismissed,
                },
              })
            }
          >
            Continue to {PROBLEM_STAGES[problem.stage + 1]}
          </button>
        ) : (
          <button
            type="button"
            className="leh-demo-ghost"
            onClick={() => dispatch({ type: "try-another" })}
          >
            Try another workflow
          </button>
        )}
        {problem.stage > 0 ? (
          <button
            type="button"
            className="leh-demo-text-button"
            onClick={() =>
              dispatch({
                type: "update-problem",
                patch: {
                  stage: (problem.stage - 1) as 0 | 1,
                  define: problem.define || PROBLEM_EXAMPLE.define,
                },
              })
            }
          >
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}
