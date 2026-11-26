"use client";

import { useSearchParams } from "next/navigation";

import {
  AUTHORING_SAVED_PARAM,
  authoringSaveMessage,
  parseAuthoringSavedKey,
  type AuthoringSavedKey,
} from "@/lib/authoring/authoring-query";

type AuthoringSaveFeedbackProps = {
  savedKey?: AuthoringSavedKey | null;
  message?: string | null;
  className?: string;
};

export function AuthoringSaveFeedback({
  savedKey = null,
  message: messageProp = null,
  className,
}: AuthoringSaveFeedbackProps) {
  const message =
    messageProp ?? (savedKey ? authoringSaveMessage(savedKey) : null);

  if (!message) {
    return null;
  }

  return (
    <p
      className={className ?? "text-sm text-success"}
      role="status"
      data-testid="authoring-save-feedback"
    >
      {message}
    </p>
  );
}

/** Live query feedback for pages whose mutation already revalidated the data. */
export function LiveAuthoringSaveFeedback({
  savedKey,
  ...props
}: AuthoringSaveFeedbackProps) {
  const searchParams = useSearchParams();
  return (
    <AuthoringSaveFeedback
      {...props}
      savedKey={
        searchParams
          ? parseAuthoringSavedKey(searchParams.get(AUTHORING_SAVED_PARAM))
          : (savedKey ?? null)
      }
    />
  );
}
