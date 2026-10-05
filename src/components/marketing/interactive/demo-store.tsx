"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import {
  GEMBA_REF,
  SUGGESTION_REF,
  type ActionRecord,
  type DemoActionSource,
  type DemoModule,
  type DemoNotification,
  type DemoPerspective,
  type DemoProgress,
  type DemoScenarioId,
  type DemoView,
  type GembaRecord,
  type MaturityAnswer,
  type MaturityState,
  type ProblemSolvingState,
  type SuggestionDecision,
  type SuggestionRecord,
  PROBLEM_EXAMPLE,
} from "./demo-model";

export type DemoState = {
  view: DemoView;
  module: DemoModule;
  perspective: DemoPerspective;
  suggestion: SuggestionRecord | null;
  actions: ActionRecord[];
  selectedActionId: string | null;
  gemba: GembaRecord | null;
  problem: ProblemSolvingState;
  maturity: MaturityState;
  notifications: DemoNotification[];
  notificationsOpen: boolean;
  progress: DemoProgress | null;
  actionSource: DemoActionSource | null;
  liveMessage: string;
};

type DemoAction =
  | { type: "reset" }
  | { type: "try-another" }
  | { type: "select-scenario"; scenario: DemoScenarioId }
  | { type: "set-module"; module: DemoModule }
  | { type: "set-view"; view: DemoView }
  | { type: "set-perspective"; perspective: DemoPerspective }
  | { type: "set-progress"; progress: DemoProgress | null }
  | { type: "set-live-message"; message: string }
  | { type: "submit-suggestion"; record: SuggestionRecord }
  | { type: "decide-suggestion"; decision: SuggestionDecision }
  | { type: "start-action-compose"; source: DemoActionSource }
  | { type: "create-action"; record: ActionRecord }
  | { type: "select-action"; id: string }
  | { type: "update-action-status"; id: string; status: ActionRecord["status"] }
  | { type: "save-gemba"; record: GembaRecord }
  | {
      type: "set-gemba-view";
      view: Extract<DemoView, "gemba-walk" | "gemba-finding">;
    }
  | { type: "update-problem"; patch: Partial<ProblemSolvingState> }
  | { type: "answer-maturity"; answer: MaturityAnswer }
  | { type: "open-notifications" }
  | { type: "close-notifications" }
  | { type: "focus-notification"; id: string };

const initialProblem: ProblemSolvingState = {
  stage: 0,
  define: PROBLEM_EXAMPLE.define,
  currentCondition: PROBLEM_EXAMPLE.currentCondition,
  cause: PROBLEM_EXAMPLE.cause,
  assistantDismissed: false,
};

const initialMaturity: MaturityState = {
  index: 0,
  answers: [null, null, null, null, null],
};

export const initialDemoState: DemoState = {
  view: "selector",
  module: "home",
  perspective: "visitor",
  suggestion: null,
  actions: [],
  selectedActionId: null,
  gemba: null,
  problem: initialProblem,
  maturity: initialMaturity,
  notifications: [],
  notificationsOpen: false,
  progress: null,
  actionSource: null,
  liveMessage: "",
};

function notification(
  sequence: number,
  kind: DemoNotification["kind"],
  title: string,
  body: string,
  meta: string,
  objectType: DemoNotification["objectType"],
  objectRef: string,
): DemoNotification {
  return {
    id: `${kind}-${sequence}`,
    kind,
    title,
    body,
    meta,
    objectType,
    objectRef,
    unread: true,
    createdLabel: "Just now",
  };
}

function scenarioStart(
  scenario: DemoScenarioId,
): Pick<DemoState, "view" | "module" | "perspective" | "actionSource"> {
  switch (scenario) {
    case "suggestion":
      return {
        view: "suggestion-form",
        module: "suggestions",
        perspective: "visitor",
        actionSource: "suggestion",
      };
    case "gemba":
      return {
        view: "gemba-walk",
        module: "gemba",
        perspective: "visitor",
        actionSource: "gemba",
      };
    case "action":
      return {
        view: "action-compose",
        module: "actions",
        perspective: "visitor",
        actionSource: "standalone",
      };
    case "problem-solving":
      return {
        view: "problem-solving",
        module: "problem-solving",
        perspective: "visitor",
        actionSource: null,
      };
    case "maturity":
      return {
        view: "maturity-questions",
        module: "maturity",
        perspective: "visitor",
        actionSource: null,
      };
  }
}

function viewForNotification(
  item: DemoNotification,
  state: DemoState,
): Pick<DemoState, "view" | "module" | "perspective" | "selectedActionId"> {
  if (item.objectType === "suggestion") {
    return {
      view:
        item.kind === "suggestion-accepted" &&
        state.suggestion?.status === "Accepted"
          ? "suggestion-record"
          : "suggestion-record",
      module: "suggestions",
      perspective: "visitor",
      selectedActionId: state.selectedActionId,
    };
  }

  if (item.objectType === "action") {
    const matchingAction = state.actions.some(
      (action) => action.id === item.objectRef,
    );
    return {
      view: "action-record",
      module: "actions",
      perspective: "visitor",
      selectedActionId: matchingAction
        ? item.objectRef
        : (state.selectedActionId ?? state.actions[0]?.id ?? null),
    };
  }

  if (item.objectType === "gemba") {
    return {
      view: "gemba-finding",
      module: "gemba",
      perspective: "visitor",
      selectedActionId: state.selectedActionId,
    };
  }

  return {
    view: "maturity-result",
    module: "maturity",
    perspective: "visitor",
    selectedActionId: state.selectedActionId,
  };
}

function suggestionStatusFromDecision(
  decision: SuggestionDecision,
): SuggestionRecord["status"] {
  switch (decision) {
    case "accept":
      return "Accepted";
    case "park":
      return "Parked";
    case "decline":
      return "Declined";
    case "request-info":
      return "More information";
  }
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "reset":
      return { ...initialDemoState };
    case "try-another":
      return {
        ...state,
        view: "selector",
        module: "home",
        perspective: "visitor",
        progress: null,
        notificationsOpen: false,
        actionSource: null,
        liveMessage: "Choose another workflow.",
      };
    case "select-scenario":
      return {
        ...state,
        ...scenarioStart(action.scenario),
        progress: null,
        notificationsOpen: false,
        liveMessage: "",
      };
    case "set-module": {
      if (action.module === "home") {
        return {
          ...state,
          module: "home",
          view: "selector",
          perspective: "visitor",
          notificationsOpen: false,
        };
      }

      const scenario = (
        {
          suggestions: "suggestion",
          gemba: "gemba",
          actions: "action",
          "problem-solving": "problem-solving",
          maturity: "maturity",
        } as const
      )[action.module];

      if (action.module === "suggestions" && state.suggestion) {
        return {
          ...state,
          module: "suggestions",
          view: "suggestion-record",
          notificationsOpen: false,
        };
      }

      if (action.module === "actions" && state.actions.length > 0) {
        return {
          ...state,
          module: "actions",
          view: state.actions.length > 1 ? "action-list" : "action-record",
          selectedActionId:
            state.selectedActionId ?? state.actions[0]?.id ?? null,
          notificationsOpen: false,
        };
      }

      if (action.module === "gemba" && state.gemba) {
        return {
          ...state,
          module: "gemba",
          view: "gemba-finding",
          notificationsOpen: false,
        };
      }

      if (
        action.module === "maturity" &&
        state.maturity.answers.every(Boolean)
      ) {
        return {
          ...state,
          module: "maturity",
          view: "maturity-result",
          notificationsOpen: false,
        };
      }

      return {
        ...state,
        ...scenarioStart(scenario),
        notificationsOpen: false,
      };
    }
    case "set-view":
      return { ...state, view: action.view, notificationsOpen: false };
    case "set-perspective":
      return { ...state, perspective: action.perspective };
    case "set-progress":
      return { ...state, progress: action.progress };
    case "set-live-message":
      return { ...state, liveMessage: action.message };
    case "submit-suggestion":
      return {
        ...state,
        suggestion: action.record,
        view: "suggestion-success",
        module: "suggestions",
        perspective: "visitor",
        progress: null,
        liveMessage: `${SUGGESTION_REF} submitted and ready for review.`,
        notifications: [
          notification(
            state.notifications.length + 1,
            "suggestion-submitted",
            "New suggestion submitted",
            `${SUGGESTION_REF} · ${action.record.title}`,
            `${action.record.area} · Just now`,
            "suggestion",
            SUGGESTION_REF,
          ),
          ...state.notifications,
        ],
      };
    case "decide-suggestion": {
      if (!state.suggestion) {
        return state;
      }

      const nextStatus = suggestionStatusFromDecision(action.decision);
      const accepted = action.decision === "accept";
      const nextNotifications = accepted
        ? [
            notification(
              state.notifications.length + 1,
              "suggestion-accepted",
              "Suggestion accepted",
              `${SUGGESTION_REF} · ${state.suggestion.title}`,
              `${state.suggestion.area} · Just now`,
              "suggestion",
              SUGGESTION_REF,
            ),
            ...state.notifications,
          ]
        : state.notifications;

      return {
        ...state,
        suggestion: {
          ...state.suggestion,
          status: nextStatus,
          decision: action.decision,
        },
        view: accepted ? "suggestion-record" : "suggestion-record",
        progress: null,
        liveMessage: accepted
          ? `${SUGGESTION_REF} accepted.`
          : `${SUGGESTION_REF} updated to ${nextStatus}.`,
        notifications: nextNotifications,
      };
    }
    case "start-action-compose":
      return {
        ...state,
        view: "action-compose",
        module: "actions",
        actionSource: action.source,
        notificationsOpen: false,
      };
    case "create-action": {
      const notificationBase = state.notifications.length;
      const assigned = notification(
        notificationBase + 1,
        "action-assigned",
        `Action assigned to ${action.record.owner}`,
        `${action.record.id} · ${action.record.title}`,
        `${action.record.owner} · Due ${action.record.due}`,
        "action",
        action.record.id,
      );
      const created = notification(
        notificationBase + 2,
        "action-created",
        "Action created",
        `${action.record.id} · ${action.record.title}`,
        `${action.record.source} · Just now`,
        "action",
        action.record.id,
      );

      return {
        ...state,
        actions: [
          action.record,
          ...state.actions.filter((item) => item.id !== action.record.id),
        ],
        selectedActionId: action.record.id,
        view:
          action.record.sourceKind === "standalone" ? "action-list" : "lineage",
        module: "actions",
        progress: null,
        actionSource: action.record.sourceKind,
        liveMessage: `${action.record.id} created.`,
        notifications: [created, assigned, ...state.notifications],
      };
    }
    case "select-action":
      return {
        ...state,
        selectedActionId: action.id,
        view: "action-record",
        module: "actions",
        notificationsOpen: false,
      };
    case "update-action-status":
      return {
        ...state,
        actions: state.actions.map((item) =>
          item.id === action.id ? { ...item, status: action.status } : item,
        ),
        liveMessage: `${action.id} is now ${action.status}.`,
      };
    case "save-gemba":
      return {
        ...state,
        gemba: action.record,
        view: "gemba-finding",
        module: "gemba",
        liveMessage: `${GEMBA_REF} finding recorded.`,
      };
    case "set-gemba-view":
      return { ...state, view: action.view, module: "gemba" };
    case "update-problem":
      return {
        ...state,
        problem: { ...state.problem, ...action.patch },
        module: "problem-solving",
        view: "problem-solving",
      };
    case "answer-maturity": {
      const answers = [...state.maturity.answers];
      answers[state.maturity.index] = action.answer;
      const nextIndex = state.maturity.index + 1;
      const complete = nextIndex >= answers.length;

      return {
        ...state,
        maturity: {
          index: complete ? state.maturity.index : nextIndex,
          answers,
        },
        view: complete ? "maturity-result" : "maturity-questions",
        module: "maturity",
        liveMessage: complete
          ? "Illustrative maturity preview complete."
          : `Question ${nextIndex + 1} of ${answers.length}.`,
      };
    }
    case "open-notifications":
      return { ...state, notificationsOpen: true };
    case "close-notifications":
      return { ...state, notificationsOpen: false };
    case "focus-notification": {
      const item = state.notifications.find((entry) => entry.id === action.id);
      if (!item) {
        return state;
      }

      return {
        ...state,
        notifications: state.notifications.map((entry) =>
          entry.id === action.id ? { ...entry, unread: false } : entry,
        ),
        notificationsOpen: false,
        ...viewForNotification(item, state),
      };
    }
    default:
      return state;
  }
}

const DemoStateContext = createContext<DemoState | null>(null);
const DemoDispatchContext = createContext<Dispatch<DemoAction> | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  const value = useMemo(() => state, [state]);

  return (
    <DemoStateContext.Provider value={value}>
      <DemoDispatchContext.Provider value={dispatch}>
        {children}
      </DemoDispatchContext.Provider>
    </DemoStateContext.Provider>
  );
}

export function useDemoState(): DemoState {
  const state = useContext(DemoStateContext);
  if (!state) {
    throw new Error("useDemoState must be used within DemoProvider");
  }
  return state;
}

export function useDemoDispatch(): Dispatch<DemoAction> {
  const dispatch = useContext(DemoDispatchContext);
  if (!dispatch) {
    throw new Error("useDemoDispatch must be used within DemoProvider");
  }
  return dispatch;
}

export function primaryCreatedAction(state: DemoState): ActionRecord | null {
  return (
    state.actions.find((item) => item.id === state.selectedActionId) ??
    state.actions[0] ??
    null
  );
}

export function unreadCount(state: DemoState): number {
  return state.notifications.filter((item) => item.unread).length;
}

export { SUGGESTION_REF };
