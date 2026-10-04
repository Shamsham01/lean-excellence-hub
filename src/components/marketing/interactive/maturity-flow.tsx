"use client";

import {
  MATURITY_PILLARS,
  MATURITY_QUESTIONS,
  type MaturityAnswer,
} from "./demo-model";
import { useDemoDispatch, useDemoState } from "./demo-store";

const LEVELS: MaturityAnswer[] = [1, 2, 3, 4, 5];

function pillarScores(answers: Array<MaturityAnswer | null>) {
  const value = (index: number) => answers[index] ?? 1;
  const operations = Number(((value(0) + value(2)) / 2).toFixed(1));
  const discipline = Number(((value(1) + value(3)) / 2).toFixed(1));
  const capability = value(4);
  const people = value(4);
  const leadership = Number(
    ((value(0) + value(1) + value(2) + value(3) + value(4)) / 5).toFixed(1),
  );

  return {
    Operations: operations,
    People: people,
    "Improvement discipline": discipline,
    Capability: capability,
    Leadership: leadership,
  } as const;
}

export function MaturityFlow() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();

  if (state.view === "maturity-result") {
    return <MaturityResult />;
  }

  const question = MATURITY_QUESTIONS[state.maturity.index];
  if (!question) {
    return null;
  }

  return (
    <div className="leh-demo-stack" data-testid="leh-demo-maturity">
      <p className="leh-demo-kicker">Illustrative preview</p>
      <h3>Mini maturity snapshot</h3>
      <p className="leh-demo-lede">
        Five questions only. This is not the LEH Operational Excellence Standard
        and it is not a validated site assessment.
      </p>
      <p className="leh-demo-progress-count">
        Question {state.maturity.index + 1} of {MATURITY_QUESTIONS.length}
      </p>
      <p className="leh-demo-question">{question.prompt}</p>
      <div
        className="leh-demo-scale"
        role="group"
        aria-label="Score from 1 to 5"
      >
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className="leh-demo-scale-button"
            data-testid={`leh-demo-maturity-${level}`}
            onClick={() => dispatch({ type: "answer-maturity", answer: level })}
          >
            {level}
          </button>
        ))}
      </div>
      <p className="leh-demo-hint">
        1 = not established · 5 = systematically sustained
      </p>
    </div>
  );
}

function MaturityResult() {
  const state = useDemoState();
  const dispatch = useDemoDispatch();
  const scores = pillarScores(state.maturity.answers);

  return (
    <div className="leh-demo-stack" data-testid="leh-demo-maturity-result">
      <p className="leh-demo-kicker">Illustrative preview</p>
      <h3>Current preview profile</h3>
      <p className="leh-demo-lede">
        Scores are produced from this five-question walkthrough. They are not a
        substitute for the 60-question Standard.
      </p>
      <ul className="leh-demo-pillars" role="list">
        {MATURITY_PILLARS.map((pillar) => (
          <li key={pillar}>
            <div>
              <p>{pillar}</p>
              <p className="leh-demo-pillar-score">
                {scores[pillar].toFixed(1)}
              </p>
            </div>
            <div
              className="leh-demo-pillar-bar"
              style={{
                ["--leh-demo-score" as string]: String(scores[pillar] / 5),
              }}
            />
          </li>
        ))}
      </ul>
      <div className="leh-demo-actions">
        <a className="leh-async-action leh-demo-link-action" href="#maturity">
          Explore the full maturity system
        </a>
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
