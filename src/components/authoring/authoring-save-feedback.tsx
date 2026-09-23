"use client";

import {
  authoringSaveMessage,
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
