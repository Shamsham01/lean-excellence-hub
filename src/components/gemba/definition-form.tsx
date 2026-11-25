"use client";

import { useActionState, type ReactNode } from "react";

export function DefinitionForm({
  action,
  children,
  className,
  confirmation,
}: {
  action: (data: FormData) => Promise<string | null>;
  children: ReactNode;
  className?: string;
  confirmation?: string;
}) {
  const [error, submit, pending] = useActionState(
    (_previous: string | null, data: FormData) => action(data),
    null,
  );
  return (
    <form
      action={submit}
      className={className}
      onSubmit={(event) => {
        if (pending || (confirmation && !window.confirm(confirmation)))
          event.preventDefault();
      }}
    >
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
