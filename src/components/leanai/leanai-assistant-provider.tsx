"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

function readIsDesktop() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }
  return window.matchMedia("(min-width: 1024px)").matches;
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
  }>({
    organisationId: "",
    sessionId: null,
    messages: [],
    error: null,
  });
  const [sending, setSending] = useState(false);
  const [desktopOpen, setDesktopOpenState] = useState(() =>
    readStoredBoolean(LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY, true),
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(readIsDesktop);

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
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
    setDesktopOpenState(open);
    try {
      window.localStorage.setItem(
        LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY,
        open ? "1" : "0",
      );
    } catch {
      // Preference persistence is best-effort.
    }
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
    if (!storedSession) {
      return;
    }
    let cancelled = false;
    void loadLeanAiAssistantConversationAction({
      sessionId: storedSession,
    }).then((result) => {
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
        });
        return;
      }
      const clearedAt = readSessionValue(
        LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
        organisationId,
      );
      const visible = result.messages.filter((message) => {
        if (!clearedAt || !message.createdAt) {
          return !clearedAt;
        }
        return message.createdAt >= clearedAt;
      });
      setConversation({
        organisationId,
        sessionId: result.sessionId,
        messages: visible,
        error: null,
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
      }).then((result) => {
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
    setConversation({
      organisationId,
      sessionId,
      messages: [],
      error: null,
    });
    writeSessionValue(
      LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
      organisationId,
      new Date().toISOString(),
    );
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
