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

const LeanAiAssistantContext =
  createContext<LeanAiAssistantContextValue | null>(null);

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // localStorage may be unavailable.
  }
  return fallback;
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
  const [search, setSearch] = useState(routerSearch);
  const [view, setView] = useState<LeanAiAssistantView | null>(null);
  const [viewLoading, setViewLoading] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);
  const [messages, setMessages] = useState<LeanAiAssistantChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [desktopOpen, setDesktopOpenState] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    setDesktopOpenState(
      readStoredBoolean(LEANAI_ASSISTANT_DESKTOP_OPEN_STORAGE_KEY, true),
    );
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setSearch(routerSearch);
  }, [routerSearch]);

  useEffect(() => {
    const syncFromWindow = () => {
      setSearch(window.location.search);
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
    setViewLoading(true);
    setViewError(null);
    void loadLeanAiAssistantViewAction({ pathname, search }).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setView(null);
        setViewError(result.error);
        setViewLoading(false);
        return;
      }
      if (result.view.organisationId !== organisationId) {
        setView(null);
        setViewError("The workspace organisation changed. Reload LeanAI.");
        setViewLoading(false);
        return;
      }
      setView(result.view);
      setViewLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [organisationId, pathname, search]);

  useEffect(() => {
    setMessages([]);
    setChatError(null);
    const storedSession = readSessionValue(
      LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
      organisationId,
    );
    setSessionId(storedSession);
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
        setSessionId(null);
        setMessages([]);
        writeSessionValue(
          LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
          organisationId,
          null,
        );
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
      setSessionId(result.sessionId);
      setMessages(visible);
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
        setChatError("Please ask a shorter question.");
        return;
      }
      const userMessage: LeanAiAssistantChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        source: "deterministic",
      };
      setMessages((current) => [...current, userMessage]);
      setSending(true);
      setChatError(null);
      void sendLeanAiAssistantMessageAction({
        pathname,
        search,
        message: trimmed,
        sessionId,
        idempotencyKey: crypto.randomUUID(),
      }).then((result) => {
        setSending(false);
        if (!result.ok) {
          setChatError(result.message);
          return;
        }
        setSessionId(result.sessionId);
        writeSessionValue(
          LEANAI_ASSISTANT_SESSION_STORAGE_PREFIX,
          organisationId,
          result.sessionId,
        );
        setMessages((current) => [
          ...current,
          {
            id: `local-assistant-${Date.now()}`,
            role: "assistant",
            content: result.envelope.message,
            createdAt: new Date().toISOString(),
            source: "ai",
          },
        ]);
      });
    },
    [organisationId, pathname, search, sending, sessionId],
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setChatError(null);
    writeSessionValue(
      LEANAI_ASSISTANT_CLEARED_AT_STORAGE_PREFIX,
      organisationId,
      new Date().toISOString(),
    );
  }, [organisationId]);

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
