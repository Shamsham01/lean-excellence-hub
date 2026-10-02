"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { AUTHORING_STEP_CHANGE_EVENT } from "@/lib/authoring/authoring-query";
import {
  loadLeanAiAssistantConversationAction,
  loadLeanAiAssistantViewAction,
  sendLeanAiAssistantMessageAction,
} from "@/app/(platform)/platform/leanai/assistant/actions";
import {
  LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
  LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY,
  LEANAI_ASSISTANT_MAX_MESSAGE_CHARS,
  LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
} from "@/modules/leanai-context/assistant/constants";
import { parseConversationBoundary } from "@/modules/leanai-context/assistant/conversation-boundary";
import type {
  LeanAiAssistantChatMessage,
  LeanAiAssistantView,
} from "@/modules/leanai-context/assistant/types";

type LeanAiAssistantContextValue = {
  organisationId: string;
  view: LeanAiAssistantView | null;
  viewLoading: boolean;
  viewError: string | null;
  messages: LeanAiAssistantChatMessage[];
  sessionId: string | null;
  sending: boolean;
  chatError: string | null;
  desktopOpen: boolean;
  mobileOpen: boolean;
  isDesktop: boolean;
  setDesktopOpen: (open: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  sendMessage: (text: string) => void;
  clearConversation: () => void;
};

const EMPTY_MESSAGES: LeanAiAssistantChatMessage[] = [];

const LeanAiAssistantContext =
  createContext<LeanAiAssistantContextValue | null>(null);

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const value = window.localStorage.getItem(key);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // localStorage may be unavailable.
  }
  return fallback;
}

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const desktopOpenListeners = new Set<() => void>();

function subscribeDesktopOpen(onStoreChange: () => void) {
  desktopOpenListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    desktopOpenListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getDesktopOpenSnapshot() {
  return readStoredBoolean(LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY, true);
}

function setDesktopOpenPreference(open: boolean) {
  try {
    window.localStorage.setItem(
      LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY,
      open ? "1" : "0",
    );
  } catch {
    // Preference persistence is best-effort.
  }
  desktopOpenListeners.forEach((listener) => listener());
}

function subscribeDesktopMedia(onStoreChange: () => void) {
  const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getIsDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function readSessionValue(
  prefix: string,
  organisationId: string,
): string | null {
  try {
    return window.sessionStorage.getItem(`${prefix}${organisationId}`);
  } catch {
    return null;
  }
}

function writeSessionValue(
  prefix: string,
  organisationId: string,
  value: string | null,
) {
  try {
    const key = `${prefix}${organisationId}`;
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage may be unavailable.
  }
}

function readConversationStartedAt(organisationId: string): string | null {
  const stored = readSessionValue(
    LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
    organisationId,
  );
  const parsed = parseConversationBoundary(stored);
  if (parsed.kind === "valid") {
    return parsed.startedAt;
  }
  if (parsed.kind === "invalid") {
    const startedAt = new Date().toISOString();
    writeSessionValue(
      LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
      organisationId,
      startedAt,
    );
    return startedAt;
  }
  return null;
}

export function LeanAiAssistantProvider({
  organisationId,
  children,
}: {
  organisationId: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/platform";
  const searchParams = useSearchParams();
  const routerSearch = searchParams?.toString()
    ? `?${searchParams.toString()}`
    : "";
  const [authoringLocation, setAuthoringLocation] = useState<{
    pathname: string;
    search: string;
  } | null>(null);
  const search =
    authoringLocation?.pathname === pathname
      ? authoringLocation.search
      : routerSearch;
  const routeKey = `${organisationId}|${pathname}|${search}`;

  const [loadedView, setLoadedView] = useState<{
    key: string;
    view: LeanAiAssistantView | null;
    error: string | null;
  }>({ key: "", view: null, error: null });
  const [conversation, setConversation] = useState<{
    organisationId: string;
    sessionId: string | null;
    messages: LeanAiAssistantChatMessage[];
    error: string | null;
    startedAt: string | null;
  }>({
    organisationId: "",
    sessionId: null,
    messages: [],
    error: null,
    startedAt: null,
  });
  const [sending, setSending] = useState(false);
  const conversationGenerationRef = useRef(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopOpen = useSyncExternalStore(
    subscribeDesktopOpen,
    getDesktopOpenSnapshot,
    () => true,
  );
  const isDesktop = useSyncExternalStore(
    subscribeDesktopMedia,
    getIsDesktopSnapshot,
    () => true,
  );

  const viewLoading = loadedView.key !== routeKey;
  const view = loadedView.view;
  const viewError = loadedView.key === routeKey ? loadedView.error : null;
  const messages =
    conversation.organisationId === organisationId
      ? conversation.messages
      : EMPTY_MESSAGES;
  const sessionId =
    conversation.organisationId === organisationId
      ? conversation.sessionId
      : null;
  const chatError =
    conversation.organisationId === organisationId ? conversation.error : null;

  useEffect(() => {
    const syncFromWindow = () => {
      setAuthoringLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };
    window.addEventListener(AUTHORING_STEP_CHANGE_EVENT, syncFromWindow);
    window.addEventListener("popstate", syncFromWindow);
    return () => {
      window.removeEventListener(AUTHORING_STEP_CHANGE_EVENT, syncFromWindow);
      window.removeEventListener("popstate", syncFromWindow);
    };
  }, []);

  const setDesktopOpen = useCallback((open: boolean) => {
    setDesktopOpenPreference(open);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadLeanAiAssistantViewAction({ pathname, search }).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setLoadedView({ key: routeKey, view: null, error: result.error });
        return;
      }
      if (result.view.organisationId !== organisationId) {
        setLoadedView({
          key: routeKey,
          view: null,
          error: "The workspace organisation changed. Reload LeanAI.",
        });
        return;
      }
      setLoadedView({ key: routeKey, view: result.view, error: null });
    });
    return () => {
      cancelled = true;
    };
  }, [organisationId, pathname, routeKey, search]);

  useEffect(() => {
    const storedSession = readSessionValue(
      LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
      organisationId,
    );
    const startedAt = readConversationStartedAt(organisationId);
    if (!storedSession) {
      return;
    }
    let cancelled = false;
    void loadLeanAiAssistantConversationAction(
      startedAt
        ? { sessionId: storedSession, conversationStartedAt: startedAt }
        : { sessionId: storedSession },
    ).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        writeSessionValue(
          LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
          organisationId,
          null,
        );
        setConversation({
          organisationId,
          sessionId: null,
          messages: [],
          error: null,
          startedAt,
        });
        return;
      }
      setConversation({
        organisationId,
        sessionId: result.sessionId,
        messages: result.messages,
        error: null,
        startedAt,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [organisationId]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) {
        return;
      }
      if (trimmed.length > LEANAI_ASSISTANT_MAX_MESSAGE_CHARS) {
        setConversation((current) => ({
          ...current,
          organisationId,
          error: "Please ask a shorter question.",
        }));
        return;
      }
      const generation = conversationGenerationRef.current;
      const startedAtForSend = readConversationStartedAt(organisationId);
      const userMessage: LeanAiAssistantChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        source: "deterministic",
      };
      setConversation((current) => ({
        organisationId,
        sessionId:
          current.organisationId === organisationId
            ? current.sessionId
            : sessionId,
        startedAt:
          current.organisationId === organisationId
            ? current.startedAt
            : startedAtForSend,
        messages: [
          ...(current.organisationId === organisationId
            ? current.messages
            : []),
          userMessage,
        ],
        error: null,
      }));
      setSending(true);
      void sendLeanAiAssistantMessageAction({
        pathname,
        search,
        message: trimmed,
        sessionId,
        idempotencyKey: crypto.randomUUID(),
        ...(startedAtForSend
          ? { conversationStartedAt: startedAtForSend }
          : {}),
      }).then((result) => {
        if (conversationGenerationRef.current !== generation) {
          setSending(false);
          return;
        }
        setSending(false);
        if (!result.ok) {
          setConversation((current) => ({
            ...current,
            organisationId,
            error: result.message,
          }));
          return;
        }
        writeSessionValue(
          LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
          organisationId,
          result.sessionId,
        );
        setConversation((current) => ({
          organisationId,
          sessionId: result.sessionId,
          startedAt:
            current.organisationId === organisationId
              ? current.startedAt
              : startedAtForSend,
          messages: [
            ...(current.organisationId === organisationId
              ? current.messages
              : []),
            {
              id: `local-assistant-${Date.now()}`,
              role: "assistant",
              content: result.envelope.message,
              createdAt: new Date().toISOString(),
              source: "ai",
            },
          ],
          error: null,
        }));
      });
    },
    [organisationId, pathname, search, sending, sessionId],
  );

  const clearConversation = useCallback(() => {
    conversationGenerationRef.current += 1;
    const startedAt = new Date().toISOString();
    writeSessionValue(
      LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
      organisationId,
      startedAt,
    );
    setSending(false);
    setConversation({
      organisationId,
      sessionId,
      messages: [],
      error: null,
      startedAt,
    });
  }, [organisationId, sessionId]);

  const value = useMemo<LeanAiAssistantContextValue>(
    () => ({
      organisationId,
      view,
      viewLoading,
      viewError,
      messages,
      sessionId,
      sending,
      chatError,
      desktopOpen,
      mobileOpen,
      isDesktop,
      setDesktopOpen,
      setMobileOpen,
      sendMessage,
      clearConversation,
    }),
    [
      organisationId,
      view,
      viewLoading,
      viewError,
      messages,
      sessionId,
      sending,
      chatError,
      desktopOpen,
      mobileOpen,
      isDesktop,
      setDesktopOpen,
      sendMessage,
      clearConversation,
    ],
  );

  return (
    <LeanAiAssistantContext.Provider value={value}>
      {children}
    </LeanAiAssistantContext.Provider>
  );
}

export function useLeanAiAssistant() {
  const value = useContext(LeanAiAssistantContext);
  if (!value) {
    throw new Error(
      "useLeanAiAssistant must be used within LeanAiAssistantProvider",
    );
  }
  return value;
}
